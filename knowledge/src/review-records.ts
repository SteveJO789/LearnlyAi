import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { compileJsonSchema, validateWithSchema } from "./schema-validation.js";

export interface ReviewRecord {
  schema_version: "1.0"; review_id: string; source_id: string; artifact_id: string;
  artifact_sha256: string; normalized_unit: string; source_document: string;
  chapter: string; section: string; asset_locator: string; asset_kind: "math_image" | "image";
  latex: string; plain_text: string; review_status: "verified" | "needs_correction" | "skipped";
  reviewer: string; reviewed_at: string;
}

export function reviewId(artifactId: string, document: string, section: string, asset: string): string {
  return createHash("sha256").update(JSON.stringify([artifactId,document,section,asset])).digest("hex");
}

export function readReviewRecords(root: string): ReviewRecord[] {
  const directory = join(root,"reviews/records");
  if (!existsSync(directory)) return [];
  const validator = compileJsonSchema(join(root,"schemas/review-record.schema.json"));
  return readdirSync(directory).filter((filename) => /^[a-f0-9]{64}\.json$/.test(filename)).sort().map((filename) => {
    const record = JSON.parse(readFileSync(join(directory,filename),"utf8")) as ReviewRecord;
    const issues = validateWithSchema(validator,record,`reviews/records/${filename}`);
    if (record.review_id !== filename.slice(0,-5) || record.review_id !== reviewId(record.artifact_id,record.source_document,record.section,record.asset_locator)) {
      throw new Error(`Review identity mismatch: ${filename}`);
    }
    if (issues.length) throw new Error(issues.map((item) => `${item.file}${item.path}: ${item.message}`).join("; "));
    return record;
  });
}

export function saveReviewRecord(root: string, record: ReviewRecord): void {
  const issues = validateWithSchema(compileJsonSchema(join(root,"schemas/review-record.schema.json")),record,"reviews/records");
  if (issues.length) throw new Error(issues.map((item) => `${item.path}: ${item.message}`).join("; "));
  const path = join(root,"reviews/records",`${record.review_id}.json`);
  mkdirSync(dirname(path),{recursive:true});
  const tempPath = `${path}.${randomUUID()}.tmp`;
  writeFileSync(tempPath,`${JSON.stringify(record,null,2)}\n`,{encoding:"utf8",flag:"wx"});
  renameSync(tempPath,path);
}
