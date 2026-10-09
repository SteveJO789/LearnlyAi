import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";
import {ReviewService} from "../dist/review-service.js";
import {readReviewRecords} from "../dist/review-records.js";
import {renderEvidence} from "../dist/review-renderer.js";
import {startReviewServer} from "../dist/review-server.js";
import {makeReviewFixture,PNG} from "./review-test-helpers.mjs";

test("review resolves original EPUB images without exposing archive paths",t=>{
  const fixture=makeReviewFixture(t);const service=new ReviewService(fixture.root);
  const asset=service.resolveAsset(fixture.first.id,0);
  assert.deepEqual(Buffer.from(asset.bytes),PNG);assert.equal(asset.contentType,"image/png");
  const unit=service.unit(fixture.first.id);
  assert.equal(unit.assets[0].review,null);assert.match(unit.evidence_html,/<img/);assert.match(unit.evidence_html,/<table/);
  assert.equal(unit.locator.section,"11.2 Ohm's Law");assert.ok(unit.english_source_text.includes("constant temperature"));
});
test("unknown units and missing asset references return not found",t=>{
  const fixture=makeReviewFixture(t);const service=new ReviewService(fixture.root);
  assert.throws(()=>service.resolveAsset(fixture.first.id,999),error=>error.status===404);
  assert.throws(()=>service.resolveAsset("99999",0),error=>error.status===404);
});
test("Verify stores only an explicitly supplied human transcription",t=>{
  const fixture=makeReviewFixture(t);const service=new ReviewService(fixture.root);
  assert.throws(()=>service.save(fixture.first.id,0,{review_status:"verified",latex:"",plain_text:"",reviewer:"Fixture reviewer"}),/requires plain text/);
  assert.throws(()=>service.save(fixture.first.id,0,{review_status:"verified",latex:"V=IR",plain_text:"V = IR",reviewer:""}),/reviewer's name/);
  const record=service.save(fixture.first.id,0,{review_status:"verified",latex:"V = IR",plain_text:"V = IR",reviewer:"Fixture reviewer"});
  assert.equal(record.review_status,"verified");assert.equal(record.reviewer,"Fixture reviewer");assert.ok(record.reviewed_at);
  assert.equal(record.asset_locator,"OPS/equation/formula.png");assert.equal(record.section,"11.2 Ohm's Law");
  assert.equal(readReviewRecords(fixture.root)[0].latex,"V = IR");
});
test("Needs correction revokes verification and persists reviewer edits",t=>{
  const fixture=makeReviewFixture(t);const service=new ReviewService(fixture.root);
  service.save(fixture.first.id,0,{review_status:"verified",latex:"V = IR",plain_text:"V = IR",reviewer:"Fixture reviewer"});
  const record=service.save(fixture.first.id,0,{review_status:"needs_correction",latex:"uncertain",plain_text:"Check image again",reviewer:"Second fixture reviewer"});
  assert.equal(record.review_status,"needs_correction");assert.equal(service.unit(fixture.first.id).assets[0].review.review_status,"needs_correction");
});
test("Skip persists a non-verified decision and progress uses selected assets",t=>{
  const fixture=makeReviewFixture(t);const service=new ReviewService(fixture.root);
  service.save(fixture.first.id,0,{review_status:"skipped",latex:"",plain_text:"",reviewer:"Fixture reviewer"});
  const progress=service.list("ohms-law",[fixture.first.id]).progress;
  assert.equal(progress.selected_assets,2);assert.equal(progress.reviewed,1);assert.equal(progress.verified,0);assert.equal(progress.skipped,1);
  assert.equal(service.list("electrical-power").units.length,1);
});
test("review actions never change raw artifacts or normalized records",t=>{
  const fixture=makeReviewFixture(t);const hash=path=>createHash("sha256").update(readFileSync(path)).digest("hex");
  const rawPath=join(fixture.root,fixture.artifact.raw_path);const beforeRaw=hash(rawPath);
  const beforeUnits=fixture.units.map(unit=>[unit.file,hash(join(fixture.root,unit.file))]);
  const service=new ReviewService(fixture.root);
  for(const status of ["verified","needs_correction","skipped"])service.save(fixture.first.id,0,{review_status:status,latex:"V = IR",plain_text:"V = IR",reviewer:"Fixture reviewer"});
  assert.equal(hash(rawPath),beforeRaw);
  for(const[path,checksum]of beforeUnits)assert.equal(hash(join(fixture.root,path)),checksum);
  assert.equal(readdirSync(join(fixture.root,"reviews/records")).length,1);
});
test("source HTML is escaped, remote resources and scripts are removed",()=>{
  const html=renderEvidence('<script>alert(1)</script>\n<table><tr><td onclick="evil()"><img src="https://evil.test/a.png"><script>bad()</script>Safe</td></tr></table>',()=>undefined);
  assert.ok(!html.includes("<script>"));assert.ok(!html.includes("onclick="));assert.ok(!html.includes('src="https://'));assert.ok(html.includes("Safe"));
});
test("loopback HTTP API serves assets and guards review writes",async t=>{
  const fixture=makeReviewFixture(t);const server=await startReviewServer(fixture.root,0);t.after(()=>server.close());
  assert.match(await(await fetch(server.url)).text(),/Human source review/);
  assert.equal((await fetch(`${server.url}/favicon.ico`)).status,204);
  const bootstrap=await(await fetch(`${server.url}/api/bootstrap`)).json();
  const image=await fetch(`${server.url}/api/assets/${fixture.first.id}/0`);
  assert.equal(image.status,200);assert.deepEqual(Buffer.from(await image.arrayBuffer()),PNG);
  assert.equal((await fetch(`${server.url}/api/assets/${fixture.first.id}/999`)).status,404);
  const body=JSON.stringify({review_status:"verified",latex:"V = IR",plain_text:"V = IR",reviewer:"Fixture reviewer"});
  assert.equal((await fetch(`${server.url}/api/reviews/${fixture.first.id}/0`,{method:"POST",headers:{"Content-Type":"application/json"},body})).status,403);
  assert.equal((await fetch(`${server.url}/api/reviews/${fixture.first.id}/0`,{method:"POST",headers:{"Content-Type":"application/json","X-Review-Token":bootstrap.token,Origin:"https://evil.test"},body})).status,403);
  const result=await fetch(`${server.url}/api/reviews/${fixture.first.id}/0`,{method:"POST",headers:{"Content-Type":"application/json","X-Review-Token":bootstrap.token},body});
  assert.equal(result.status,200);assert.equal((await result.json()).review_status,"verified");
});
