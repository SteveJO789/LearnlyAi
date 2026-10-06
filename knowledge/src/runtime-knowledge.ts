import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { toCanonicalKnowledgeDocument } from "./canonical-document.js";
import { parseKnowledgeMarkdown } from "./markdown-frontmatter.js";
import { compileJsonSchema, validateCanonicalDocument, validateSourceManifest } from "./schema-validation.js";

const CONCEPT_ID = "physics.electricity.electric-circuits.ohms-law";
const AUTHORING_PATH = "concepts/physics/electricity/ohms-law.md";
const PROMOTION_PATH = `reviews/document-history/${CONCEPT_ID}/20261001T104541Z/promotion.json`;
// Pin the already approved pilot. A future promotion requires an explicit runtime release change.
const APPROVED_SHA256 = "5a31af726815c9a1c154a19d615f7405a776f7fd567a4665c3bdec13618ee0eb";
const SCHEMA_PREFIX = "https://learnlyai.local/schemas/";
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const readJson = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, "utf8"));

/** Generate only the pinned reviewed release; never read raw/, normalized/, or build/. */
export function runtimeKnowledgeFiles(knowledgeRoot: string): Map<string, string> {
  const root = resolve(knowledgeRoot);
  const bytes = readFileSync(join(root, AUTHORING_PATH));
  const promotion = readJson(join(root, PROMOTION_PATH));
  const promotionHashes = promotion.sha256 as { promoted?: string } | undefined;
  const document = toCanonicalKnowledgeDocument(parseKnowledgeMarkdown(bytes.toString("utf8")));
  if (createHash("sha256").update(bytes).digest("hex") !== APPROVED_SHA256
    || promotionHashes?.promoted !== APPROVED_SHA256 || promotion.target !== AUTHORING_PATH
    || promotion.concept_id !== CONCEPT_ID || promotion.promoted_version !== "0.2.0"
    || document.id !== CONCEPT_ID || document.version !== "0.2.0" || document.status !== "reviewed"
    || JSON.stringify(document.review) !== JSON.stringify(promotion.review)) {
    throw new Error("Runtime Knowledge must match the pinned reviewed Ohm's Law 0.2.0 promotion.");
  }
  const manifestResult = validateSourceManifest(readJson(join(root, "manifest/sources.json")),
    compileJsonSchema(join(root, "schemas/source.schema.json")), "manifest/sources.json");
  if (!manifestResult.manifest || manifestResult.issues.length) {
    throw new Error(`Runtime source registry validation failed: ${json(manifestResult.issues)}`);
  }
  const sources = new Map(manifestResult.manifest.sources.map((source) => [source.source_id, source]));
  const validator = compileJsonSchema(join(root, "schemas/knowledge.schema.json"));
  const issues = validateCanonicalDocument(document, validator, sources, AUTHORING_PATH);
  if (issues.length) throw new Error(`Runtime Knowledge validation failed: ${json(issues)}`);

  // Authoring provenance stays in Git. Teaching sections/formulas/examples/identity remain unchanged.
  const runtime = { ...document };
  delete runtime.curation;
  runtime.sections = (document.sections as Array<{ slug: string }>).filter((section) => section.slug !== "detailed-provenance");
  const runtimeIssues = validateCanonicalDocument(runtime, validator, sources, "runtime-knowledge");
  if (runtimeIssues.length) throw new Error(`Runtime projection validation failed: ${json(runtimeIssues)}`);
  const sourceIds = new Set((document.source_refs as Array<{ source_id: string }>).map((ref) => ref.source_id));
  const selectedSources = [...sourceIds].sort().map((id) => sources.get(id)!);
  const files = new Map<string, string>([
    [`build/${AUTHORING_PATH.replace(/\.md$/u, ".json")}`, json(runtime)],
    ["manifest/sources.json", json({ schema_version: "1.0", sources: selectedSources })],
    ["NOTICE.md", `# Runtime Knowledge attribution\n\nOhm's Law 0.2.0: Thai teaching adaptation authored by LearnlyAI.\nDerived from Siyavula Physical Sciences Grade 11, Chapter 11, section 11.2\nand its worked example; adapted, translated and curated by LearnlyAI.\nOriginal material: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).\nSource identity, publisher URL and license are retained in manifest/sources.json\nand the original section locators in the concept's source_refs.\n\nThis generated package preserves the approved 2026-10-01 teaching material.\nIt contains no source books or normalized evidence.\n`],
  ]);
  // Include the exact transitive contract closure, even optional referenced contracts.
  const pending = ["knowledge.schema.json", "source.schema.json"];
  while (pending.length) {
    const name = pending.shift()!;
    if (files.has(`schemas/${name}`)) continue;
    if (!/^[a-z-]+\.schema\.json$/u.test(name)) throw new Error("Unexpected runtime schema reference.");
    const schemaBytes = readFileSync(join(root, "schemas", name), "utf8").replaceAll("\r\n", "\n");
    files.set(`schemas/${name}`, schemaBytes);
    const visit = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (key === "$ref" && typeof child === "string" && !child.startsWith("#")) {
          if (!child.startsWith(SCHEMA_PREFIX)) throw new Error("Runtime schemas must resolve locally.");
          pending.push(child.slice(SCHEMA_PREFIX.length).split("#")[0]!);
        } else visit(child);
      }
    };
    visit(JSON.parse(schemaBytes));
  }
  return new Map([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

/** Validate before replacing generated output; no timestamps or machine paths in the package. */
export function prepareRuntimeKnowledge(knowledgeRoot: string, outputRoot: string): Map<string, string> {
  const files = runtimeKnowledgeFiles(knowledgeRoot);
  const output = resolve(outputRoot);
  const root = resolve(knowledgeRoot);
  const inside = (parent: string, child: string): boolean => {
    const path = relative(parent, child);
    return path === "" || (!path.startsWith("..") && !isAbsolute(path));
  };
  if (inside(output, root) || inside(root, output)) {
    throw new Error("Runtime output must be separate from Knowledge authoring content.");
  }
  const staging = `${output}.staging`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  try {
    for (const [path, content] of files) {
      mkdirSync(dirname(join(staging, path)), { recursive: true });
      writeFileSync(join(staging, path), content, "utf8");
    }
    rmSync(output, { recursive: true, force: true });
    renameSync(staging, output);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  return files;
}
