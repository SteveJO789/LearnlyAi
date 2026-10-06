import assert from "node:assert/strict";
import {existsSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";
import {curateKnowledge,OHMS_LAW_CONCEPT_ID} from "../dist/curation.js";
import {buildKnowledge,validateKnowledge} from "../dist/knowledge-pipeline.js";
import {toCanonicalKnowledgeDocument} from "../dist/canonical-document.js";
import {parseKnowledgeMarkdown} from "../dist/markdown-frontmatter.js";
import {ReviewService} from "../dist/review-service.js";
import {makeReviewFixture} from "./review-test-helpers.mjs";

function curationFixture(t){
  const fixture=makeReviewFixture(t);const {root,artifact,first,example}=fixture;
  const assets=[
    {asset_id:"formula",kind:"equation",entry:first,index:0,transcription:"V = IR",latex:"V = IR"},
    {asset_id:"diagram",kind:"diagram",entry:first,index:1,transcription:"One resistor and a voltage source",latex:null},
    {asset_id:"solution",kind:"equation",entry:example,index:0,transcription:"V = IR = 12 V",latex:"V = IR = 12\\,\\mathrm{V}"},
  ].map(({asset_id,kind,entry,index,transcription,latex})=>({asset_id,kind,artifact_id:artifact.artifact_id,source_id:artifact.source_id,
    artifact_sha256:artifact.sha256,source_document:entry.unit.locator.document,locator:{chapter:entry.unit.locator.chapter,section:entry.unit.locator.section},
    original_asset_reference:entry.unit.assets[index].archive_path,transcription,latex,
    verification:{status:"verified",reviewer:"Explicit test fixture reviewer",verified_at:"2026-10-01",method:"human_transcription"}}));
  mkdirSync(join(root,"verified-assets"));writeFileSync(join(root,"verified-assets/registry.json"),JSON.stringify({schema_version:"1.0",assets}));
  const selection=(selection_id,kind,entry,asset_ids)=>({selection_id,kind,normalized_unit:entry.file,source_id:artifact.source_id,artifact_id:artifact.artifact_id,
    source_document:entry.unit.locator.document,locator:{chapter:entry.unit.locator.chapter,section:entry.unit.locator.section},asset_ids});
  const input={schema_version:"1.0",concept_id:OHMS_LAW_CONCEPT_ID,authorship:"learnlyai",formula_asset_id:"formula",
    selections:[selection("definition","definition",first,[]),selection("formula","equation",first,["formula"]),selection("diagram","diagram",first,["diagram"]),selection("example","worked_example",example,["solution"])],
    student_content:{concept:"กฎของโอห์มเชื่อมโยงความต่างศักย์ กระแส และความต้านทาน",intuition:"เพิ่มความต่างศักย์ กระแสเพิ่มเมื่อความต้านทานคงที่",formal_definition:"กระแสแปรผันตรงกับความต่างศักย์ที่อุณหภูมิคงที่",conditions:"ใช้กับตัวนำโอห์มมิกที่อุณหภูมิคงที่",sanity_check:"ตรวจหน่วยและแทนคำตอบกลับ",common_mistakes:"ระวังการแปลงหน่วยกระแส",retrieval_summary:"คำอธิบายกฎของโอห์มสำหรับความต่างศักย์ กระแส ความต้านทาน และหน่วยเอสไอ"},
    worked_example:{problem_template_th:"จงหาความต่างศักย์ตามข้อมูลตัวอย่างที่ตรวจแล้ว",solution_template_th:"แทนค่าที่ตรวจแล้ว\n\n\\[\n{{asset:solution.latex}}\n\\]",equation_asset_ids:["solution"],
      answer:{value:12,unit:"V",quantity:"potential_difference",unit_required:true,asset_id:"solution"}}};
  mkdirSync(join(root,"curation/inputs"),{recursive:true});
  const inputPath=join(root,`curation/inputs/${OHMS_LAW_CONCEPT_ID}.json`);writeFileSync(inputPath,JSON.stringify(input));
  return{...fixture,assets,input,inputPath};
}
test("verified V = IR evidence generates a valid draft with detailed provenance",t=>{
  const f=curationFixture(t);const result=curateKnowledge(f.root,OHMS_LAW_CONCEPT_ID);
  const markdown=readFileSync(result.draftPath,"utf8");const doc=toCanonicalKnowledgeDocument(parseKnowledgeMarkdown(markdown));
  assert.equal(doc.status,"draft");assert.equal(doc.formulas[0].expression,"V = IR");assert.equal(doc.review.reviewer,undefined);
  assert.equal(doc.review.math_physics_reviewed,false);assert.equal(doc.curation.asset_snapshots.length,3);
  assert.ok(doc.sections.some(section=>section.heading==="Detailed Provenance"));
  assert.ok(!markdown.includes("Current and potential difference relate"),"English source prose must not become student-facing text");
  assert.equal(validateKnowledge(f.root).valid,true);
});
test("unverified equations and incomplete example verification reject curation",t=>{
  const f=curationFixture(t);f.assets[0].verification.status="pending";
  writeFileSync(join(f.root,"verified-assets/registry.json"),JSON.stringify({schema_version:"1.0",assets:f.assets}));
  assert.throws(()=>curateKnowledge(f.root,OHMS_LAW_CONCEPT_ID),/unverifiedAsset/);
  f.assets[0].verification.status="verified";f.input.worked_example.equation_asset_ids=[];writeFileSync(f.inputPath,JSON.stringify(f.input));
  writeFileSync(join(f.root,"verified-assets/registry.json"),JSON.stringify({schema_version:"1.0",assets:f.assets}));
  assert.throws(()=>curateKnowledge(f.root,OHMS_LAW_CONCEPT_ID));
  assert.equal(existsSync(join(f.root,"curation/drafts/physics/electricity/ohms-law.md")),false);
});
test("a missing source locator and a unitless checked answer are rejected",t=>{
  const f=curationFixture(t);delete f.input.selections[0].locator;writeFileSync(f.inputPath,JSON.stringify(f.input));
  assert.throws(()=>curateKnowledge(f.root,OHMS_LAW_CONCEPT_ID),/locator/);
  f.input.selections[0].locator={chapter:f.first.unit.locator.chapter,section:f.first.unit.locator.section};
  f.input.worked_example.answer.unit="";writeFileSync(f.inputPath,JSON.stringify(f.input));
  assert.throws(()=>curateKnowledge(f.root,OHMS_LAW_CONCEPT_ID),/answerUnit/);
});
test("generated drafts are excluded from production and never overwrite review metadata",t=>{
  const f=curationFixture(t);const result=curateKnowledge(f.root,OHMS_LAW_CONCEPT_ID);
  const build=buildKnowledge(f.root);assert.equal(build.valid,true);assert.equal(build.productionDocuments.length,0);
  const original=readFileSync(result.draftPath,"utf8");
  assert.throws(()=>curateKnowledge(f.root,OHMS_LAW_CONCEPT_ID),/never overwritten/);
  assert.equal(readFileSync(result.draftPath,"utf8"),original);
});
test("reviewed documents still require explicit document-level human metadata",t=>{
  const f=curationFixture(t);const result=curateKnowledge(f.root,OHMS_LAW_CONCEPT_ID);
  let markdown=readFileSync(result.draftPath,"utf8").replace(/^status: draft$/m,"status: reviewed").replace(/^  content_status: draft$/m,"  content_status: reviewed");
  writeFileSync(result.draftPath,markdown);
  const validation=validateKnowledge(f.root);assert.equal(validation.valid,false);assert.ok(validation.issues.some(issue=>issue.keyword==="productionReview"));
  assert.equal(validation.productionDocuments.length,0);
});
test("explicitly human-reviewed curation promoted to concepts builds with its provenance",t=>{
  const f=curationFixture(t);const result=curateKnowledge(f.root,OHMS_LAW_CONCEPT_ID);
  const original=readFileSync(result.draftPath,"utf8");
  const promoted=original.replace(/^status: draft$/m,"status: reviewed")
    .replace(/^  content_status: draft$/m,"  content_status: reviewed")
    .replace(/^  math_physics_reviewed: false$/m,"  math_physics_reviewed: true")
    .replace(/^  language_reviewed: false$/m,"  language_reviewed: true\n  reviewer: Explicit document fixture reviewer\n  reviewed_at: 2026-10-01");
  const directory=join(f.root,"concepts/physics/electricity");mkdirSync(directory,{recursive:true});
  writeFileSync(join(directory,"ohms-law.md"),promoted);
  const build=buildKnowledge(f.root);assert.equal(build.valid,true,JSON.stringify(build.issues));
  assert.equal(build.productionDocuments.length,1);
  const output=JSON.parse(readFileSync(join(f.root,"build/concepts/physics/electricity/ohms-law.json"),"utf8"));
  const draft=toCanonicalKnowledgeDocument(parseKnowledgeMarkdown(original));
  assert.equal(output.status,"reviewed");assert.equal(output.review.reviewer,"Explicit document fixture reviewer");
  assert.equal(output.review.reviewed_at,"2026-10-01");
  assert.deepEqual(output.curation,draft.curation);assert.deepEqual(output.source_refs,draft.source_refs);
  assert.equal(output.worked_examples[0].checked_answer,"\\(V = 12\\,\\mathrm{V}\\)");
  assert.equal(readFileSync(result.draftPath,"utf8"),original);
  assert.ok(!existsSync(join(f.root,"build/curation/drafts")));
});
test("UI correction and skip actions revoke a previously verified curation asset",t=>{
  const f=curationFixture(t);const result=curateKnowledge(f.root,OHMS_LAW_CONCEPT_ID);const service=new ReviewService(f.root);
  for(const status of ["needs_correction","skipped"]){service.save(f.first.id,0,{review_status:status,latex:"V = IR",plain_text:"V = IR",reviewer:"Explicit test reviewer"});
    assert.equal(validateKnowledge(f.root).valid,false);assert.throws(()=>curateKnowledge(f.root,OHMS_LAW_CONCEPT_ID),/unverifiedAsset/);}
  assert.equal(toCanonicalKnowledgeDocument(parseKnowledgeMarkdown(readFileSync(result.draftPath,"utf8"))).status,"draft");
});

test("editing a draft to add an unverified worked-example equation fails validation",t=>{
  const f=curationFixture(t);const result=curateKnowledge(f.root,OHMS_LAW_CONCEPT_ID);
  const markdown=readFileSync(result.draftPath,"utf8").replace("V = IR = 12\\,\\mathrm{V}","V = 99");
  writeFileSync(result.draftPath,markdown);
  assert.ok(validateKnowledge(f.root).issues.some(issue=>issue.keyword==="exampleEquationVerification"));
});
