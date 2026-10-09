import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AcquisitionArtifact, NormalizedUnit, ValidationIssue } from "./domain.js";
import type { VerifiedAsset } from "./curation-domain.js";
import { calculateSha256 } from "./acquisition.js";
import { compileJsonSchema, validateWithSchema } from "./schema-validation.js";
import { readReviewRecords } from "./review-records.js";

export function assetFingerprint(asset: VerifiedAsset): string {
  return calculateSha256(Buffer.from(JSON.stringify(asset)));
}

export function readVerifiedAssets(
  root: string, artifacts: AcquisitionArtifact[], units: NormalizedUnit[],
): { assets: Map<string, VerifiedAsset>; issues: ValidationIssue[] } {
  const file = "verified-assets/registry.json";
  const assets = new Map<string, VerifiedAsset>();
  const issues: ValidationIssue[] = [];
  if (!existsSync(join(root, file))) return { assets, issues };
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(join(root, file), "utf8")); }
  catch (error) {
    return { assets, issues: [{file,path:"",keyword:"parse",message:String(error)}] };
  }
  issues.push(...validateWithSchema(compileJsonSchema(join(root,"schemas/verified-assets.schema.json")),raw,file));
  if (issues.length) return { assets, issues };
  const registry = raw as {assets:VerifiedAsset[]};
  registry.assets.forEach((asset, index) => {
    const report = (path: string, message: string): void => {
      issues.push({file,path:`/assets/${index}/${path}`,keyword:"verifiedAssetProvenance",message});
    };
    if (assets.has(asset.asset_id)) report("asset_id", "must be unique");
    assets.set(asset.asset_id, asset);
    const artifact = artifacts.find((entry) => entry.artifact_id === asset.artifact_id && entry.source_id === asset.source_id);
    if (!artifact || artifact.sha256 !== asset.artifact_sha256) report("artifact_sha256", "must identify the acquired source artifact exactly");
    const unit = units.find((entry) => entry.artifact_id === asset.artifact_id && entry.source_id === asset.source_id
      && entry.locator.document === asset.source_document && entry.locator.chapter === asset.locator.chapter
      && entry.locator.section === asset.locator.section
      && entry.assets?.some((entryAsset) => entryAsset.archive_path === asset.original_asset_reference
        && entryAsset.kind === (asset.kind === "equation" ? "math_image" : "image")));
    if (!unit) report("locator", "must resolve to a normalized unit containing the original asset of the declared kind");
  });
  // Human review actions are authoritative; pending registry entries are only a
  // selection inventory. The UI writes exclusively to reviews/, never this file.
  for (const record of readReviewRecords(root)) {
    for (const asset of assets.values()) {
      if (record.artifact_id === asset.artifact_id && record.source_id === asset.source_id
        && record.artifact_sha256 === asset.artifact_sha256 && record.source_document === asset.source_document
        && record.chapter === asset.locator.chapter && record.section === asset.locator.section
        && record.asset_locator === asset.original_asset_reference
        && record.asset_kind === (asset.kind === "equation" ? "math_image" : "image")) {
        asset.transcription = record.plain_text || null;
        asset.latex = record.latex || null;
        asset.verification = {
          status: record.review_status === "verified" ? "verified" : record.review_status === "needs_correction" ? "rejected" : "pending",
          reviewer: record.reviewer, verified_at: record.reviewed_at.slice(0,10),
          method: record.review_status === "verified" ? "human_transcription" : null,
        };
      }
    }
  }
  return { assets, issues };
}
