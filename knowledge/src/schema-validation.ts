import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createRequire } from "node:module";

import { Ajv2020, type AnySchema, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

import type { SourceManifest, SourceRecord, ValidationIssue } from "./domain.js";

const require = createRequire(import.meta.url);
const addFormats: typeof import("ajv-formats").default = require("ajv-formats");

function pointerPath(error: ErrorObject, prefix: string): string {
  const params = error.params as Record<string, unknown>;
  let path = `${prefix}${error.instancePath}`;

  if (error.keyword === "required" && typeof params.missingProperty === "string") {
    path += `/${params.missingProperty.replaceAll("~", "~0").replaceAll("/", "~1")}`;
  }
  if (error.keyword === "additionalProperties" && typeof params.additionalProperty === "string") {
    path += `/${params.additionalProperty.replaceAll("~", "~0").replaceAll("/", "~1")}`;
  }

  return path;
}

export function validateWithSchema(
  validate: ValidateFunction,
  value: unknown,
  file: string,
  prefix = "",
): ValidationIssue[] {
  if (validate(value)) return [];

  return (validate.errors ?? []).map((error) => ({
    file,
    path: pointerPath(error, prefix),
    keyword: error.keyword,
    message: error.message ?? "must satisfy the schema",
  }));
}

export function compileJsonSchema(schemaPath: string): ValidateFunction {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as AnySchema;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  // Resolve shared contracts locally; schema IDs never trigger network access.
  for (const filename of readdirSync(dirname(schemaPath))) {
    if (filename.endsWith(".schema.json") && filename !== basename(schemaPath)) {
      ajv.addSchema(JSON.parse(readFileSync(join(dirname(schemaPath), filename), "utf8")) as AnySchema);
    }
  }
  return ajv.compile(schema);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateSourceManifest(
  value: unknown,
  sourceValidator: ValidateFunction,
  file: string,
): { issues: ValidationIssue[]; manifest?: SourceManifest } {
  const issues: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return {
      issues: [{ file, path: "", keyword: "type", message: "source manifest must be an object" }],
    };
  }

  if (value.schema_version !== "1.0") {
    issues.push({ file, path: "/schema_version", keyword: "const", message: "must equal 1.0" });
  }
  if (!Array.isArray(value.sources)) {
    issues.push({ file, path: "/sources", keyword: "type", message: "must be an array" });
    return { issues };
  }

  const sourceIds = new Set<string>();
  value.sources.forEach((source, index) => {
    issues.push(...validateWithSchema(sourceValidator, source, file, `/sources/${index}`));
    if (!isRecord(source) || typeof source.source_id !== "string") return;
    if (sourceIds.has(source.source_id)) {
      issues.push({
        file,
        path: `/sources/${index}/source_id`,
        keyword: "uniqueSourceId",
        message: `must be unique: ${source.source_id}`,
      });
    }
    sourceIds.add(source.source_id);
  });

  return {
    issues,
    manifest: issues.length === 0 ? value as SourceManifest : undefined,
  };
}

function pushIssue(
  issues: ValidationIssue[],
  file: string,
  path: string,
  keyword: string,
  message: string,
): void {
  issues.push({ file, path, keyword, message });
}

export function validateCanonicalDocument(
  document: Record<string, unknown>,
  knowledgeValidator: ValidateFunction,
  sources: ReadonlyMap<string, SourceRecord>,
  file: string,
): ValidationIssue[] {
  const issues = validateWithSchema(knowledgeValidator, document, file);
  const sourceRefs = Array.isArray(document.source_refs) ? document.source_refs : [];
  const reviewed = document.status === "reviewed";

  sourceRefs.forEach((reference, index) => {
    if (!isRecord(reference) || typeof reference.source_id !== "string") return;
    const source = sources.get(reference.source_id);
    if (!source) {
      pushIssue(
        issues,
        file,
        `/source_refs/${index}/source_id`,
        "sourceReference",
        `must reference an existing source: ${reference.source_id}`,
      );
      return;
    }

    if (!reviewed) return;
    if (source.rag_permission_status === "do_not_ingest") {
      pushIssue(
        issues,
        file,
        `/source_refs/${index}/source_id`,
        "productionSourcePermission",
        `reviewed documents cannot reference do_not_ingest source: ${reference.source_id}`,
      );
    }
    if (
      reference.usage === "content_source"
      && source.rag_permission_status !== "allowed"
      && source.rag_permission_status !== "internally_authored"
    ) {
      pushIssue(
        issues,
        file,
        `/source_refs/${index}/usage`,
        "productionContentPermission",
        `content_source requires allowed or internally_authored permission: ${reference.source_id}`,
      );
    }
  });

  if (isRecord(document.review) && document.review.content_status !== document.status) {
    pushIssue(
      issues,
      file,
      "/review/content_status",
      "reviewStatusConsistency",
      "must match the document status",
    );
  }

  if (reviewed) {
    const review = isRecord(document.review) ? document.review : {};
    if (review.math_physics_reviewed !== true) {
      pushIssue(issues, file, "/review/math_physics_reviewed", "productionReview", "must be true");
    }
    if (review.language_reviewed !== true) {
      pushIssue(issues, file, "/review/language_reviewed", "productionReview", "must be true");
    }
    if (typeof review.reviewer !== "string" || review.reviewer.trim().length === 0) {
      pushIssue(issues, file, "/review/reviewer", "productionReview", "is required for reviewed documents");
    }
    if (typeof review.reviewed_at !== "string" || review.reviewed_at.trim().length === 0) {
      pushIssue(issues, file, "/review/reviewed_at", "productionReview", "is required for reviewed documents");
    }
  }

  const formulaIds = Array.isArray(document.formula_ids) ? document.formula_ids : [];
  const formulas = Array.isArray(document.formulas) ? document.formulas : [];
  if (formulaIds.length !== formulas.length) {
    pushIssue(
      issues,
      file,
      "/formulas",
      "formulaReference",
      "must contain one structured formula for every formula_id",
    );
  } else {
    formulaIds.forEach((formulaId, index) => {
      const formula = formulas[index];
      if (isRecord(formula) && formula.id !== formulaId) {
        pushIssue(issues, file, `/formulas/${index}/id`, "formulaReference", `must equal ${String(formulaId)}`);
      }
    });
  }

  return issues;
}
