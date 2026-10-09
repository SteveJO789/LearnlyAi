import {
  mkdirSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { toCanonicalKnowledgeDocument } from "./canonical-document.js";
import type {
  KnowledgeValidationResult,
  LoadedKnowledgeDocument,
  SourceManifest,
  SourceRecord,
  ValidationIssue,
} from "./domain.js";
import { KnowledgeParseError, parseKnowledgeMarkdown } from "./markdown-frontmatter.js";
import {
  compileJsonSchema,
  validateCanonicalDocument,
  validateSourceManifest,
} from "./schema-validation.js";
import { validateSourceProcessing } from "./source-processing-validation.js";
import { readVerifiedAssets } from "./verified-assets.js";
import { validateCuratedDocument } from "./curation.js";
import type { VerifiedAsset } from "./curation-domain.js";
import { validateSourcePilot } from "./source-pilot.js";

function listMarkdownFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listMarkdownFiles(absolutePath));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(absolutePath);
  }

  return files.sort();
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function sourceMap(manifest: SourceManifest): Map<string, SourceRecord> {
  return new Map(manifest.sources.map((source) => [source.source_id, source]));
}

export function validateKnowledge(knowledgeRoot: string): KnowledgeValidationResult {
  const root = resolve(knowledgeRoot);
  const sourceManifestPath = join(root, "manifest", "sources.json");
  const sourceSchemaPath = join(root, "schemas", "source.schema.json");
  const knowledgeSchemaPath = join(root, "schemas", "knowledge.schema.json");
  const conceptsPath = join(root, "concepts");
  const issues: ValidationIssue[] = [];
  const documents: LoadedKnowledgeDocument[] = [];

  let rawManifest: unknown;
  try {
    rawManifest = readJson(sourceManifestPath);
  } catch (error) {
    return {
      valid: false,
      issues: [{
        file: relative(root, sourceManifestPath),
        path: "",
        keyword: "parse",
        message: error instanceof Error ? error.message : "could not parse source manifest",
      }],
      documents,
      productionDocuments: [],
    };
  }

  let sourceValidator;
  let knowledgeValidator;
  try {
    sourceValidator = compileJsonSchema(sourceSchemaPath);
    knowledgeValidator = compileJsonSchema(knowledgeSchemaPath);
  } catch (error) {
    return {
      valid: false,
      issues: [{
        file: "schemas",
        path: "",
        keyword: "schema",
        message: error instanceof Error ? error.message : "could not compile schemas",
      }],
      documents,
      productionDocuments: [],
    };
  }

  const manifestResult = validateSourceManifest(
    rawManifest,
    sourceValidator,
    relative(root, sourceManifestPath),
  );
  issues.push(...manifestResult.issues);
  const sources = manifestResult.manifest ? sourceMap(manifestResult.manifest) : new Map<string, SourceRecord>();
  let assets = new Map<string,VerifiedAsset>();
  try {
    const processing = validateSourceProcessing(root, sources);
    issues.push(...processing.issues);
    const registry = readVerifiedAssets(root,processing.manifest?.artifacts ?? [],processing.normalizedRecords);
    issues.push(...registry.issues);
    assets = registry.assets;
  } catch (error) {
    issues.push({
      file: "acquisition",
      path: "",
      keyword: "sourceProcessing",
      message: error instanceof Error ? error.message : "could not validate source-processing state",
    });
  }

  let markdownFiles: string[] = [];
  try {
    if (!statSync(conceptsPath).isDirectory()) throw new Error("concepts path is not a directory");
    markdownFiles = listMarkdownFiles(conceptsPath);
    if (existsSync(join(root,"curation/drafts"))) markdownFiles.push(...listMarkdownFiles(join(root,"curation/drafts")));
  } catch (error) {
    issues.push({
      file: "concepts",
      path: "",
      keyword: "filesystem",
      message: error instanceof Error ? error.message : "could not read concepts directory",
    });
  }

  for (const sourcePath of markdownFiles) {
    const relativePath = relative(root, sourcePath);
    try {
      const parsed = parseKnowledgeMarkdown(readFileSync(sourcePath, "utf8"));
      const document = toCanonicalKnowledgeDocument(parsed);
      documents.push({ sourcePath, relativePath, document });
      issues.push(...validateCanonicalDocument(document, knowledgeValidator, sources, relativePath));
      issues.push(...validateCuratedDocument(root,document,assets,relativePath));
      issues.push(...validateSourcePilot(root,document,relativePath));
    } catch (error) {
      issues.push({
        file: relativePath,
        path: "",
        keyword: error instanceof KnowledgeParseError ? "frontmatter" : "parse",
        message: error instanceof Error ? error.message : "could not parse knowledge document",
      });
    }
  }

  const productionDocuments = documents.filter(({ document, relativePath }) => document.status === "reviewed"
    && !relativePath.replaceAll("\\","/").startsWith("curation/drafts/"));
  return { valid: issues.length === 0, issues, documents, productionDocuments };
}

function outputRelativePath(document: LoadedKnowledgeDocument): string {
  return document.relativePath.replace(/\.md$/u, ".json");
}

export function buildKnowledge(knowledgeRoot: string): KnowledgeValidationResult {
  const root = resolve(knowledgeRoot);
  const result = validateKnowledge(root);
  if (!result.valid) return result;

  const buildPath = join(root, "build");
  const stagingPath = join(root, `.knowledge-build-${process.pid}`);
  rmSync(stagingPath, { recursive: true, force: true });
  mkdirSync(stagingPath, { recursive: true });

  try {
    for (const loaded of result.productionDocuments) {
      const outputPath = join(stagingPath, outputRelativePath(loaded));
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, `${JSON.stringify(loaded.document, null, 2)}\n`, "utf8");
    }

    rmSync(buildPath, { recursive: true, force: true });
    renameSync(stagingPath, buildPath);
  } catch (error) {
    rmSync(stagingPath, { recursive: true, force: true });
    throw error;
  }

  return result;
}
