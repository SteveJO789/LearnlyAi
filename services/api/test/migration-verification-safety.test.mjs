import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
test('current-origin verifier clones definitions only, guards the observed marker and rolls back every change', () => {
  const result = spawnSync(process.execPath, ['scripts/render-current-database-verification.mjs'], { cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 10000, maxBuffer: 250000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^BEGIN;/);
  assert.match(result.stdout, /Fixture collision/);
  assert.match(result.stdout, /Live origin changed; re-audit required/);
  assert.match(result.stdout, /LIKE public\.%I INCLUDING ALL/);
  assert.match(result.stdout, /Legacy identity changed/);
  assert.match(result.stdout, /Cross-user disclosure/);
  assert.match(result.stdout, /RESET ROLE;\s*ROLLBACK;/);
  assert.doesNotMatch(result.stdout, /\b(?:INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE|DROP TABLE)\s+(?:"?public"?\.|storage\.)/iu);
});
for(const mode of ['legacy','fresh']) test(`${mode} migration verifier keeps all mutations inside a collision-checked rollback fixture`,()=>{
  const result=spawnSync(process.execPath,['scripts/render-historical-migration-verification.mjs',`--path=${mode}`],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:10000,maxBuffer:250000});
  assert.equal(result.status,0,result.stderr);
  const sql=result.stdout;
  assert.ok(sql.startsWith('BEGIN;'));assert.match(sql,/Scratch schema already exists; no changes permitted/);
  assert.match(sql,/RESET ROLE;\s*ROLLBACK;/);assert.match(sql,/fixture_removed/);
  assert.doesNotMatch(sql,/"public"\.|\bauth\.users|"auth"\."users"|\b(?:CREATE|ALTER|DROP)\s+ROLE\b|\bGRANT\s+authenticated\s+TO\b|(?:ON|INTO|UPDATE|ALTER TABLE)\s+storage\.(?:objects|buckets)/iu);
  if(mode==='fresh') {
    assert.doesNotMatch(sql,/DELETE FROM|"AppSession"\s*\(/);
    assert.match(sql,/FixtureStorageObjects/); assert.match(sql,/pending_intent_guard/); assert.match(sql,/UPDATE \(metadata\)/);
    assert.match(sql,/CREATE TABLE "learnly_history_verify"\."KnowledgeChunk"/);
    assert.match(sql,/extensions\.vector\(1536\)/);
    assert.match(sql,/REVOKE ALL ON TABLE "learnly_history_verify"\."KnowledgeChunk" FROM PUBLIC, anon, authenticated/);
    assert.match(sql,/FOR SELECT TO authenticated USING \(reviewed = true\)/);
  }
  else {assert.match(sql,/FixtureAuthUsers/);assert.match(sql,/Existing API role dependency unavailable/);}
});
