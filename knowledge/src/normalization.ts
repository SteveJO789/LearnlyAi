import {
  mkdirSync,
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { AcquisitionArtifact, NormalizedUnit } from "./domain.js";
import { normalizeEpub, type ExtractedUnit } from "./epub-normalizer.js";
import { normalizeOpenLogic } from "./open-logic-normalizer.js";
import { SourceProcessingError } from "./source-processing-error.js";
import { isSiyavulaSource, loadSourceRegistry, normalizerVersion } from "./source-processing-policy.js";
import { validateSourceProcessing } from "./source-processing-validation.js";
import { compileJsonSchema, validateWithSchema } from "./schema-validation.js";

function normalizeArtifact(root: string, artifact: AcquisitionArtifact): NormalizedUnit[] {
  const bytes = readFileSync(join(root, ...artifact.raw_path.split("/")));
  let extracted: ExtractedUnit[];
  if (isSiyavulaSource(artifact.source_id)) {
    extracted = normalizeEpub(bytes);
  } else if (artifact.source_id === "open-logic-project") {
    extracted = normalizeOpenLogic(bytes, artifact.filename);
  } else {
    throw new SourceProcessingError("SOURCE_UNSUPPORTED", `No normalizer for source: ${artifact.source_id}`);
  }

  return extracted.map((unit) => ({
    source_id: artifact.source_id,
    artifact_id: artifact.artifact_id,
    locator: unit.locator,
    title: unit.title,
    content: unit.content,
    math: unit.math,
    language: "en",
    content_format: unit.content_format,
    ...(unit.assets ? { assets: unit.assets } : {}),
    ...(unit.normalization_warnings ? { normalization_warnings: unit.normalization_warnings } : {}),
    provenance: {
      artifact_sha256: artifact.sha256,
      raw_path: artifact.raw_path,
      source_url: artifact.source_url,
      license_status: artifact.license_status,
      parser_version: normalizerVersion(artifact.source_id),
    },
  }));
}

function outputPath(stagingRoot: string, unit: NormalizedUnit, index: number): string {
  return join(
    stagingRoot,
    unit.source_id,
    unit.artifact_id,
    `${String(index + 1).padStart(5, "0")}.json`,
  );
}

export interface NormalizationResult {
  artifactCount: number;
  recordCount: number;
}

export function normalizeAcquiredArtifacts(
  knowledgeRoot: string,
  options: { artifactId?: string; documentPrefix?: string } = {},
): NormalizationResult {
  const root = resolve(knowledgeRoot);
  const sources = loadSourceRegistry(root);
  const state = validateSourceProcessing(root, sources, { includeNormalized: Boolean(options.artifactId) });
  if (!state.valid || !state.manifest) {
    throw new SourceProcessingError(
      state.issues.some((item) => item.keyword === "rawArtifactChecksum")
        ? "RAW_ARTIFACT_MODIFIED"
        : "ACQUISITION_INVALID",
      `Acquisition validation failed: ${state.issues.map((item) => `${item.file}${item.path} ${item.message}`).join("; ")}`,
    );
  }

  if (options.documentPrefix && !options.artifactId) throw new Error("--document-prefix requires --artifact-id");
  const artifacts = options.artifactId
    ? state.manifest.artifacts.filter((artifact) => artifact.artifact_id === options.artifactId)
    : state.manifest.artifacts;
  if (options.artifactId && !artifacts.length) throw new Error(`Unknown artifact: ${options.artifactId}`);
  // Scoped normalization is append-only: never invalidate existing locator filenames/reviews.
  if (options.artifactId && existsSync(join(root, "normalized", artifacts[0]!.source_id, options.artifactId))) {
    throw new Error("Artifact is already normalized; scoped normalization never overwrites existing evidence");
  }

  const validator = compileJsonSchema(join(root, "schemas", "normalized-unit.schema.json"));
  const normalized = artifacts.map((artifact) => ({ artifact, units: normalizeArtifact(root, artifact)
    .filter((unit) => !options.documentPrefix || unit.locator.document?.startsWith(options.documentPrefix)) }));
  if (normalized.some(({ units }) => !units.length)) throw new Error("Normalization scope selected no records");
  for (const { artifact, units } of normalized) {
    units.forEach((unit, index) => {
      const issues = validateWithSchema(validator, unit, `${artifact.artifact_id}/${index + 1}`);
      if (issues.length > 0) {
        throw new SourceProcessingError(
          "NORMALIZATION_FAILED",
          `Normalizer produced an invalid record: ${issues.map((item) => `${item.path} ${item.message}`).join("; ")}`,
        );
      }
    });
  }

  const normalizedRoot = join(root, "normalized");
  const stagingRoot = join(root, `.knowledge-normalized-${process.pid}`);
  rmSync(stagingRoot, { recursive: true, force: true });
  mkdirSync(stagingRoot, { recursive: true });
  try {
    writeFileSync(join(stagingRoot, ".gitkeep"), "", "utf8");
    for (const { units } of normalized) {
      units.forEach((unit, index) => {
        const path = outputPath(stagingRoot, unit, index);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
      });
    }
    if (options.artifactId) {
      const artifact = artifacts[0]!;
      mkdirSync(join(normalizedRoot, artifact.source_id), { recursive: true });
      renameSync(join(stagingRoot, artifact.source_id, artifact.artifact_id), join(normalizedRoot, artifact.source_id, artifact.artifact_id));
      rmSync(stagingRoot, { recursive: true, force: true });
    } else {
      rmSync(normalizedRoot, { recursive: true, force: true });
      renameSync(stagingRoot, normalizedRoot);
    }
  } catch (error) {
    rmSync(stagingRoot, { recursive: true, force: true });
    throw error;
  }

  const finalState = validateSourceProcessing(root, sources);
  if (!finalState.valid) {
    throw new SourceProcessingError(
      "NORMALIZATION_FAILED",
      `Normalized output failed provenance validation: ${finalState.issues.map((item) => `${item.file}${item.path} ${item.message}`).join("; ")}`,
    );
  }

  return {
    artifactCount: artifacts.length,
    recordCount: normalized.reduce((total, item) => total + item.units.length, 0),
  };
}
