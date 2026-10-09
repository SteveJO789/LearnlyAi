import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { stringify } from "yaml";
import type { CurationAnswer, CurationInput, CurationProvenance, CurationSelection, VerifiedAsset } from "./curation-domain.js";
import type { NormalizedUnit, ValidationIssue } from "./domain.js";
import { calculateSha256 } from "./acquisition.js";
import { toCanonicalKnowledgeDocument } from "./canonical-document.js";
import { parseKnowledgeMarkdown } from "./markdown-frontmatter.js";
import { compileJsonSchema, validateCanonicalDocument, validateWithSchema } from "./schema-validation.js";
import { loadSourceRegistry } from "./source-processing-policy.js";
import { validateSourceProcessing } from "./source-processing-validation.js";
import { assetFingerprint, readVerifiedAssets } from "./verified-assets.js";

export const OHMS_LAW_CONCEPT_ID = "physics.electricity.electric-circuits.ohms-law";
const INPUT_PATH = "curation/inputs/physics.electricity.electric-circuits.ohms-law.json";
const DRAFT_PATH = "curation/drafts/physics/electricity/ohms-law.md";
const unitsByQuantity = {potential_difference:"V",electric_current:"A",resistance:"Ω"} as const;
const symbolsByQuantity = {potential_difference:"V",electric_current:"I",resistance:"R"} as const;

export class CurationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(issues.map((item) => `${item.file}${item.path}: [${item.keyword}] ${item.message}`).join("\n"));
    this.name = "CurationError";
  }
}

function issue(file: string, path: string, keyword: string, message: string): ValidationIssue {
  return {file,path,keyword,message};
}

function plainMath(value: string): string {
  return value.replace(/\\(?:mathrm|text|operatorname)\{([^{}]+)\}/g,"$1")
    .replace(/\\(?:,|;|!|quad|qquad|left|right)/g, " ").replace(/[{}$]/g,"").replace(/\s+/g," ").trim();
}

function answerIssues(answer: CurationAnswer, assets: Map<string, VerifiedAsset>, file: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requiredUnit = unitsByQuantity[answer.quantity];
  if (answer.unit_required !== true || answer.unit !== requiredUnit) {
    issues.push(issue(file,"/worked_example/answer/unit","answerUnit",`requires SI unit ${requiredUnit}`));
  }
  if (typeof answer.value !== "number" || !Number.isFinite(answer.value)) {
    issues.push(issue(file,"/worked_example/answer/value","answerVerification","a human-supplied finite checked value is required"));
  }
  const asset = assets.get(answer.asset_id);
  const text = plainMath(asset?.transcription ?? "");
  const escapedValue = String(answer.value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const escapedUnit = requiredUnit.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  if (!asset || asset.kind !== "equation" || asset.verification.status !== "verified"
    || !new RegExp(`(?:^|[^0-9.])${escapedValue}\\s*${escapedUnit}(?:$|[^a-zA-Z])`).test(text)) {
    issues.push(issue(file,"/worked_example/answer","answerVerification","value and unit must occur together in the verified solution transcription"));
  }
  return issues;
}

function selectionIssues(
  root: string, selections: CurationSelection[], assets: Map<string,VerifiedAsset>, file: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const [index, selection] of selections.entries()) {
    const prefix = `/selections/${index}`;
    if (ids.has(selection.selection_id)) issues.push(issue(file,`${prefix}/selection_id`,"uniqueSelection","must be unique"));
    ids.add(selection.selection_id);
    let unit: NormalizedUnit;
    try { unit = JSON.parse(readFileSync(join(root,selection.normalized_unit),"utf8")) as NormalizedUnit; }
    catch { issues.push(issue(file,`${prefix}/normalized_unit`,"sourceLocator","normalized unit is missing or unreadable")); continue; }
    if (unit.source_id !== selection.source_id || unit.artifact_id !== selection.artifact_id
      || unit.locator.document !== selection.source_document || unit.locator.chapter !== selection.locator.chapter
      || unit.locator.section !== selection.locator.section) {
      issues.push(issue(file,`${prefix}/locator`,"sourceLocator","must match the normalized source unit exactly"));
    }
    if (selection.locator.chapter !== "Chapter 11: Electric circuits"
      || !selection.locator.section.startsWith("11.2 Ohm's Law")) {
      issues.push(issue(file,`${prefix}/locator`,"pilotScope","requires Chapter 11 / 11.2 Ohm's Law or Using Ohm's Law"));
    }
    for (const id of selection.asset_ids) {
      const asset = assets.get(id);
      if (!asset || asset.source_id !== selection.source_id || asset.artifact_id !== selection.artifact_id
        || asset.source_document !== selection.source_document || asset.locator.chapter !== selection.locator.chapter
        || asset.locator.section !== selection.locator.section
        || !unit.assets?.some((entry) => entry.archive_path === asset.original_asset_reference)) {
        issues.push(issue(file,`${prefix}/asset_ids`,"assetLocator",`asset ${id} must belong to this selected unit and section`));
      }
      if (asset?.verification.status !== "verified") {
        issues.push(issue(file,`${prefix}/asset_ids`,"unverifiedAsset",`${id} requires explicit human verification`));
      }
    }
    if (selection.kind === "worked_example") {
      for (const sourceAsset of unit.assets ?? []) {
        if (!selection.asset_ids.some((id) => assets.get(id)?.original_asset_reference === sourceAsset.archive_path)) {
          issues.push(issue(file,`${prefix}/asset_ids`,"exampleEquationVerification",`worked example must include verified asset ${sourceAsset.archive_path}`));
        }
      }
    }
    if ((selection.kind === "equation" || selection.kind === "diagram")
      && !selection.asset_ids.some((id) => assets.get(id)?.kind === selection.kind)) {
      issues.push(issue(file,`${prefix}/asset_ids`,"assetKind",`must select a ${selection.kind} asset`));
    }
  }
  for (const kind of ["definition","equation","diagram","worked_example"] as const) {
    if (!selections.some((entry) => entry.kind === kind)) issues.push(issue(file,"/selections","sourceLocator",`missing ${kind} selection`));
  }
  return issues;
}

export function validateCurationInput(root: string, raw: unknown, assets: Map<string,VerifiedAsset>): ValidationIssue[] {
  const file = INPUT_PATH;
  const issues = validateWithSchema(compileJsonSchema(join(root,"schemas/curation-input.schema.json")),raw,file);
  if (issues.length) return issues;
  const input = raw as CurationInput;
  issues.push(...selectionIssues(root,input.selections,assets,file));
  const selectedIds = new Set(input.selections.flatMap((selection) => selection.asset_ids));
  const formula = assets.get(input.formula_asset_id);
  if (!selectedIds.has(input.formula_asset_id) || formula?.kind !== "equation" || formula.verification.status !== "verified") {
    issues.push(issue(file,"/formula_asset_id","unverifiedAsset","formula must reference a selected verified equation"));
  }
  const exampleIds = new Set(input.selections.filter((selection) => selection.kind === "worked_example").flatMap((selection) => selection.asset_ids)
    .filter((id) => assets.get(id)?.kind === "equation"));
  for (const id of new Set([...exampleIds,...input.worked_example.equation_asset_ids])) {
    if (!exampleIds.has(id) || !input.worked_example.equation_asset_ids.includes(id)
      || assets.get(id)?.verification.status !== "verified") {
      issues.push(issue(file,"/worked_example/equation_asset_ids","exampleEquationVerification",`${id} must be a verified selected worked-example equation`));
    }
  }
  if (!exampleIds.has(input.worked_example.answer.asset_id)) issues.push(issue(file,"/worked_example/answer/asset_id","exampleEquationVerification","checked answer must reference a selected example equation"));
  issues.push(...answerIssues(input.worked_example.answer,assets,file));
  for (const template of [input.worked_example.problem_template_th,input.worked_example.solution_template_th]) {
    for (const match of template.matchAll(/\{\{asset:([a-z0-9-]+)\.(text|latex)\}\}/g)) {
      const asset = assets.get(match[1]!);
      if (!selectedIds.has(match[1]!) || asset?.verification.status !== "verified"
        || !(match[2] === "text" ? asset?.transcription : asset?.latex)) {
        issues.push(issue(file,"/worked_example","unverifiedAsset",`template requires selected verified ${match[1]}.${match[2]}`));
      }
    }
    if (/\{\{/.test(template.replace(/\{\{asset:[a-z0-9-]+\.(text|latex)\}\}/g,""))) {
      issues.push(issue(file,"/worked_example","template","unsupported or unresolved placeholder"));
    }
  }
  return issues;
}

function fillTemplate(template: string, assets: Map<string,VerifiedAsset>): string {
  return template.replace(/\{\{asset:([a-z0-9-]+)\.(text|latex)\}\}/g,(_match,id:string,field:string) => {
    const asset = assets.get(id)!;
    return (field === "text" ? asset.transcription : asset.latex)!;
  });
}

function checkedAnswer(answer: CurationAnswer): string {
  return `\\(${symbolsByQuantity[answer.quantity]} = ${answer.value}\\,\\mathrm{${answer.unit}}\\)`;
}

export function validateCuratedDocument(
  root: string, document: Record<string,unknown>, assets: Map<string,VerifiedAsset>, file: string,
): ValidationIssue[] {
  if (!document.curation) return !document.source_pilot && file.replaceAll("\\","/").startsWith("curation/drafts/")
    ? [issue(file,"/curation","curationProvenance","generated drafts require curation provenance")] : [];
  const issues = validateWithSchema(compileJsonSchema(join(root,"schemas/curation-provenance.schema.json")),document.curation,file,"/curation");
  if (issues.length) return issues;
  const provenance = document.curation as CurationProvenance;
  if (provenance.concept_id !== document.id) issues.push(issue(file,"/curation/concept_id","curationProvenance","must match document ID"));
  issues.push(...selectionIssues(root,provenance.selections,assets,file));
  const refs = Array.isArray(document.source_refs) ? document.source_refs as Array<{source_id?:string;locator?:string;usage?:string}> : [];
  for (const selection of provenance.selections) {
    const locator = `${selection.artifact_id} :: ${selection.source_document} :: ${selection.locator.chapter} :: ${selection.locator.section}`;
    if (!refs.some((reference) => reference.source_id === selection.source_id && reference.locator === locator && reference.usage === "content_source")) {
      issues.push(issue(file,"/source_refs","sourceLocator","each curation selection requires its exact content-source locator"));
    }
  }
  const ids = new Set(provenance.selections.flatMap((selection) => selection.asset_ids));
  const snapshotIds = new Set<string>();
  for (const snapshot of provenance.asset_snapshots) {
    if (snapshotIds.has(snapshot.asset_id)) issues.push(issue(file,"/curation/asset_snapshots","curationProvenance","duplicate asset snapshot"));
    snapshotIds.add(snapshot.asset_id);
    const asset = assets.get(snapshot.asset_id);
    if (!asset || asset.verification.status !== "verified" || snapshot.sha256 !== assetFingerprint(asset)) {
      issues.push(issue(file,"/curation/asset_snapshots","verifiedAssetSnapshot",`asset ${snapshot.asset_id} verification/transcription changed or is unverified`));
    }
  }
  if (ids.size !== snapshotIds.size || [...ids].some((id) => !snapshotIds.has(id))) {
    issues.push(issue(file,"/curation/asset_snapshots","curationProvenance","must snapshot every selected asset exactly"));
  }
  const formulas = document.formulas as Array<{expression:string}> | undefined;
  if (!ids.has(provenance.formula_asset_id) || formulas?.[0]?.expression !== assets.get(provenance.formula_asset_id)?.latex) {
    issues.push(issue(file,"/formulas","verifiedEquation","formula must match its verified LaTeX transcription"));
  }
  const examples = document.worked_examples as Array<{checked_answer:string;solution:string}> | undefined;
  if (examples?.length !== 1 || examples[0]?.checked_answer !== checkedAnswer(provenance.answer)) {
    issues.push(issue(file,"/worked_examples","answerUnit","checked answer must retain its verified numerical value and required unit"));
  }
  const exampleAssets = provenance.selections.filter((selection) => selection.kind === "worked_example")
    .flatMap((selection) => selection.asset_ids).map((id) => assets.get(id))
    .filter((asset) => asset?.kind === "equation" && asset.verification.status === "verified");
  for (const match of (examples?.[0]?.solution ?? "").matchAll(/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g)) {
    const expression = (match[1] ?? match[2] ?? "").trim();
    if (!exampleAssets.some((asset) => asset?.latex?.trim() === expression)) {
      issues.push(issue(file,"/worked_examples/0/solution","exampleEquationVerification","each solution equation must match a verified selected example asset"));
    }
  }
  issues.push(...answerIssues(provenance.answer,assets,file));
  return issues;
}

export function curateKnowledge(knowledgeRoot: string, conceptId: string): {draftPath:string} {
  const root = resolve(knowledgeRoot);
  if (conceptId !== OHMS_LAW_CONCEPT_ID) throw new CurationError([issue("curation","/concept_id","pilotScope","only the Ohm's Law pilot is supported")]);
  const sources = loadSourceRegistry(root);
  const processing = validateSourceProcessing(root,sources);
  const registry = readVerifiedAssets(root,processing.manifest?.artifacts ?? [],processing.normalizedRecords);
  if (processing.issues.length || registry.issues.length) throw new CurationError([...processing.issues,...registry.issues]);
  const inputBytes = readFileSync(join(root,INPUT_PATH));
  const raw: unknown = JSON.parse(inputBytes.toString("utf8"));
  const inputIssues = validateCurationInput(root,raw,registry.assets);
  if (inputIssues.length) throw new CurationError(inputIssues);
  const input = raw as CurationInput;
  const selectedIds = [...new Set(input.selections.flatMap((selection) => selection.asset_ids))];
  const provenance: CurationProvenance = {
    concept_id:conceptId, authorship:"learnlyai", input_sha256:calculateSha256(inputBytes),
    formula_asset_id:input.formula_asset_id, selections:input.selections,
    asset_snapshots:selectedIds.map((id) => ({asset_id:id,sha256:assetFingerprint(registry.assets.get(id)!)})),
    answer:input.worked_example.answer,
  };
  const metadata = {
    id:conceptId,schema_version:"1.0",status:"draft",
    review:{content_status:"draft",math_physics_reviewed:false,language_reviewed:false},
    subject:"physics",grade_range:["m5"],curriculum_track:"additional",curriculum_role:"required",
    curriculum:"thai-basic-education-2551-revised-2560",domain:"electricity",topic:"electric-circuits",subtopic:"ohms-law",
    content_type:"concept",difficulty:"core",title_th:"กฎของโอห์ม",title_en:"Ohm's Law",language:"th",
    prerequisites:["physics.electricity.current","physics.electricity.potential-difference","physics.electricity.resistance"],
    learning_objectives:["อธิบายความสัมพันธ์ระหว่างความต่างศักย์ กระแส และความต้านทานเมื่ออุณหภูมิคงที่", "ใช้กฎของโอห์มโดยตรวจเงื่อนไขและหน่วยของปริมาณ"],
    formula_ids:["formula.ohms-law"],version:"0.2.0",
    source_refs:input.selections.map((selection) => ({source_id:selection.source_id,usage:"content_source",
      locator:`${selection.artifact_id} :: ${selection.source_document} :: ${selection.locator.chapter} :: ${selection.locator.section}`})),
    curation:provenance,
  };
  const content = input.student_content;
  const detailedProvenance = input.selections.map((selection) =>
    `- ${selection.kind}: ${selection.artifact_id} :: ${selection.source_document} :: ${selection.locator.chapter} :: ${selection.locator.section}\n  Normalized unit: ${selection.normalized_unit}`
  ).join("\n") + "\n\n" + selectedIds.map((id) => {
    const asset = registry.assets.get(id)!;
    return `- Asset ${id}: ${asset.original_asset_reference}; verified by ${asset.verification.reviewer} on ${asset.verification.verified_at}`;
  }).join("\n") + "\n\nเนื้อหาสำหรับผู้เรียนเรียบเรียงโดย LearnlyAI ข้อมูลต้นฉบับใช้เป็นบริบทและหลักฐานอ้างอิง การตรวจภาพสมการไม่ใช่การอนุมัติเอกสารฉบับนี้";
  const sections = [
    ["Concept",content.concept],["Intuition",content.intuition],["Formal Definition",content.formal_definition],
    ["Formula",`\\[\n${registry.assets.get(input.formula_asset_id)!.latex}\n\\]`],
    ["Variables and Units","| Symbol | Meaning | SI unit |\n|---|---|---|\n| V | ความต่างศักย์ไฟฟ้า | volt (V) |\n| I | กระแสไฟฟ้า | ampere (A) |\n| R | ความต้านทาน | ohm (Ω) |"],
    ["Conditions and Limitations",content.conditions],
    ["Worked Example",`## Problem\n\n${fillTemplate(input.worked_example.problem_template_th,registry.assets)}\n\n## Solution\n\n${fillTemplate(input.worked_example.solution_template_th,registry.assets)}\n\n## Checked Answer\n\n${checkedAnswer(input.worked_example.answer)}`],
    ["Sanity Check",content.sanity_check],["Common Mistakes",content.common_mistakes],
    ["Retrieval Summary",content.retrieval_summary],["Detailed Provenance",detailedProvenance],
  ];
  const markdown = `---\n${stringify(metadata)}---\n\n${sections.map(([heading,text]) => `# ${heading}\n\n${text}`).join("\n\n")}\n`;
  const document = toCanonicalKnowledgeDocument(parseKnowledgeMarkdown(markdown));
  const issues = [
    ...validateCanonicalDocument(document,compileJsonSchema(join(root,"schemas/knowledge.schema.json")),sources,DRAFT_PATH),
    ...validateCuratedDocument(root,document,registry.assets,DRAFT_PATH),
  ];
  if (issues.length) throw new CurationError(issues);
  const draftPath = join(root,DRAFT_PATH);
  if (existsSync(draftPath)) throw new CurationError([issue(DRAFT_PATH,"","draftExists","existing document is never overwritten; preserve its human edits and review metadata")]);
  mkdirSync(dirname(draftPath),{recursive:true});
  writeFileSync(draftPath,markdown,{encoding:"utf8",flag:"wx"});
  return {draftPath};
}
