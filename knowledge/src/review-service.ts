import { readFileSync, readdirSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import type { AcquisitionArtifact, NormalizedAsset, NormalizedUnit } from "./domain.js";
import { unzipControlled } from "./archive.js";
import { calculateSha256 } from "./acquisition.js";
import { loadSourceRegistry } from "./source-processing-policy.js";
import { validateSourceProcessing } from "./source-processing-validation.js";
import { readReviewRecords, reviewId, saveReviewRecord, type ReviewRecord } from "./review-records.js";
import { renderEvidence } from "./review-renderer.js";

export const REVIEW_ARTIFACT_ID = "siyavula-physical-sciences-g11-en-ccby-3d893a4364f5";
export const REVIEW_CONCEPTS = ["electric-current","potential-difference","resistance","ohms-law","series-resistance","parallel-resistance","simple-circuit-topology","simple-dc-circuit-analysis","electrical-power","electrical-energy"] as const;
export type ReviewConcept = typeof REVIEW_CONCEPTS[number];
interface Candidate { id:string; file:string; unit:NormalizedUnit }

export class ReviewError extends Error {
  constructor(public readonly status:number,message:string) { super(message); }
}

export class ReviewService {
  private readonly root:string;
  readonly artifact:AcquisitionArtifact;
  private readonly archive:Record<string,Uint8Array>;
  private readonly candidates:Candidate[];
  constructor(root:string) {
    this.root = resolve(root);
    const state = validateSourceProcessing(this.root,loadSourceRegistry(this.root));
    if (!state.valid) throw new Error(state.issues.map((issue)=>`${issue.file}${issue.path}: ${issue.message}`).join("; "));
    const artifact = state.manifest?.artifacts.find((entry)=>entry.artifact_id===REVIEW_ARTIFACT_ID);
    if (!artifact) throw new Error(`Acquire and normalize ${REVIEW_ARTIFACT_ID} before starting review`);
    this.artifact=artifact;
    const bytes=readFileSync(join(this.root,artifact.raw_path));
    if (calculateSha256(bytes)!==artifact.sha256) throw new Error("Raw artifact checksum does not match");
    this.archive=unzipControlled(bytes);
    const directory=posix.join("normalized",artifact.source_id,artifact.artifact_id);
    this.candidates=readdirSync(join(this.root,directory)).filter((name)=>/^\d+\.json$/.test(name)).sort().map((name)=>({
      id:name.slice(0,-5),file:posix.join(directory,name),unit:JSON.parse(readFileSync(join(this.root,directory,name),"utf8")) as NormalizedUnit,
    })).filter(({unit})=>unit.locator.chapter==="Chapter 11: Electric circuits");
  }

  private candidate(id:string):Candidate {
    const candidate=this.candidates.find((entry)=>entry.id===id);
    if (!candidate) throw new ReviewError(404,"Source unit not found");
    return candidate;
  }
  private sourceAsset(unitId:string,index:number):{candidate:Candidate;asset:NormalizedAsset} {
    const candidate=this.candidate(unitId);
    const asset=candidate.unit.assets?.[index];
    if (!Number.isInteger(index)||index<0||!asset) throw new ReviewError(404,"Source asset not found");
    return {candidate,asset};
  }
  private currentReviews():Map<string,ReviewRecord> {
    const records=readReviewRecords(this.root).filter((record)=>record.artifact_id===this.artifact.artifact_id);
    const map=new Map<string,ReviewRecord>();
    for(const record of records) {
      const candidate=this.candidates.find(({file,unit})=>file===record.normalized_unit && unit.locator.document===record.source_document
        && unit.locator.chapter===record.chapter && unit.locator.section===record.section);
      if(record.artifact_sha256!==this.artifact.sha256 || !candidate?.unit.assets?.some((asset)=>asset.archive_path===record.asset_locator && asset.kind===record.asset_kind)) {
        throw new Error(`Review provenance does not match source: ${record.review_id}`);
      }
      map.set(record.review_id,record);
    }
    return map;
  }
  private assetId(candidate:Candidate,asset:NormalizedAsset):string {
    return reviewId(this.artifact.artifact_id,candidate.unit.locator.document!,candidate.unit.locator.section,asset.archive_path);
  }
  private relevant(concept:ReviewConcept,candidate:Candidate):boolean {
    const section=candidate.unit.locator.section;
    const ohm=section.startsWith("11.2 Ohm's Law");
    if(["electric-current","potential-difference","resistance"].includes(concept)) return candidate.unit.title==="11.2 Ohm's Law";
    if(concept==="ohms-law") return candidate.unit.title==="11.2 Ohm's Law" || (ohm && section.includes("Using Ohm's Law"));
    if(concept==="series-resistance") return ohm && /Equivalent series resistance|Series circuits|Recap of resistors/.test(section);
    if(concept==="parallel-resistance") return ohm && /Equivalent parallel resistance|Parallel circuits|Recap of resistors/.test(section);
    if(concept==="electrical-power") return section.startsWith("11.3 Power and energy") && section.includes("Electrical power");
    if(concept==="electrical-energy") return section.startsWith("11.3 Power and energy") && section.includes("Electrical energy");
    return ohm && /Using Ohm's Law|series and parallel|Series circuits|Parallel circuits/.test(section);
  }

  list(concept:string="ohms-law",selectedIds?:string[]) {
    if(!REVIEW_CONCEPTS.includes(concept as ReviewConcept)) throw new ReviewError(400,"Unknown concept filter");
    const relevant=this.candidates.filter((entry)=>this.relevant(concept as ReviewConcept,entry));
    // Default to the main definition and complete worked example 1, not the whole book.
    const defaults=relevant.filter(({unit})=>unit.title==="11.2 Ohm's Law" || unit.locator.section.includes("Worked example 1:"));
    const selected=selectedIds ? relevant.filter((entry)=>selectedIds.includes(entry.id)) : defaults.length ? defaults : relevant.slice(0,3);
    const selectedSet=new Set(selected.map((entry)=>entry.id));
    const reviews=this.currentReviews();
    const assets=new Map<string,ReviewRecord|undefined>();
    for(const candidate of selected) for(const asset of candidate.unit.assets??[]) assets.set(this.assetId(candidate,asset),reviews.get(this.assetId(candidate,asset)));
    const values=[...assets.values()];
    return {concept,artifact_id:this.artifact.artifact_id,units:relevant.map((entry)=>({id:entry.id,title:entry.unit.title,
      chapter:entry.unit.locator.chapter,section:entry.unit.locator.section,source_document:entry.unit.locator.document,
      asset_count:entry.unit.assets?.length??0,selected:selectedSet.has(entry.id)})),
      progress:{selected_assets:assets.size,reviewed:values.filter(Boolean).length,verified:values.filter((record)=>record?.review_status==="verified").length,
        needs_correction:values.filter((record)=>record?.review_status==="needs_correction").length,skipped:values.filter((record)=>record?.review_status==="skipped").length}};
  }

  unit(id:string) {
    const candidate=this.candidate(id);
    const reviews=this.currentReviews();
    const assets=(candidate.unit.assets??[]).map((asset,index)=>({...asset,index,review_id:this.assetId(candidate,asset),
      url:`/api/assets/${candidate.id}/${index}`,review:reviews.get(this.assetId(candidate,asset))??null}));
    const imageUrl=(reference:string):string|undefined=>{
      const path=reference.startsWith("OPS/")?decodeURI(reference):posix.normalize(posix.join(posix.dirname(candidate.unit.locator.document!),reference));
      return assets.find((asset)=>asset.archive_path===path)?.url;
    };
    return {id,title:candidate.unit.title,locator:candidate.unit.locator,source_id:candidate.unit.source_id,
      artifact_id:candidate.unit.artifact_id,normalized_unit:candidate.file,english_source_text:candidate.unit.content,
      evidence_html:renderEvidence(candidate.unit.content,imageUrl),assets};
  }

  resolveAsset(unitId:string,index:number):{bytes:Uint8Array;contentType:string} {
    const {asset}=this.sourceAsset(unitId,index);
    const bytes=this.archive[asset.archive_path];
    if(!bytes) throw new ReviewError(404,"Original EPUB asset is missing");
    const contentType=/\.png$/i.test(asset.archive_path)?"image/png":/\.jpe?g$/i.test(asset.archive_path)?"image/jpeg":/\.gif$/i.test(asset.archive_path)?"image/gif":undefined;
    if(!contentType) throw new ReviewError(415,"Unsupported image format");
    return {bytes,contentType};
  }

  save(unitId:string,index:number,raw:unknown):ReviewRecord {
    const {candidate,asset}=this.sourceAsset(unitId,index);
    if(!raw || typeof raw!=="object" || Array.isArray(raw)) throw new ReviewError(400,"Review must be an object");
    const body=raw as Record<string,unknown>;
    if(Object.keys(body).some((key)=>!["review_status","latex","plain_text","reviewer"].includes(key))) throw new ReviewError(400,"Unknown review field");
    if(!["verified","needs_correction","skipped"].includes(String(body.review_status))) throw new ReviewError(400,"Choose Verify, Needs correction or Skip");
    if(typeof body.reviewer!=="string" || !body.reviewer.trim() || body.reviewer.length>200) throw new ReviewError(400,"Enter the reviewer's name");
    if(typeof body.latex!=="string" || typeof body.plain_text!=="string" || body.latex.length>10000 || body.plain_text.length>10000) throw new ReviewError(400,"Transcriptions must be text under 10,000 characters");
    if(body.review_status==="verified" && (!body.plain_text.trim() || (asset.kind==="math_image" && !body.latex.trim()))) {
      throw new ReviewError(400,"Verification requires plain text and, for equations, LaTeX entered by the reviewer");
    }
    const record:ReviewRecord={schema_version:"1.0",review_id:this.assetId(candidate,asset),source_id:this.artifact.source_id,
      artifact_id:this.artifact.artifact_id,artifact_sha256:this.artifact.sha256,normalized_unit:candidate.file,
      source_document:candidate.unit.locator.document!,chapter:candidate.unit.locator.chapter,section:candidate.unit.locator.section,
      asset_locator:asset.archive_path,asset_kind:asset.kind,latex:body.latex.trim(),plain_text:body.plain_text.trim(),
      review_status:body.review_status as ReviewRecord["review_status"],reviewer:body.reviewer.trim(),reviewed_at:new Date().toISOString()};
    saveReviewRecord(this.root,record);
    return record;
  }
}
