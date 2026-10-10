import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
for(const mode of ['legacy','fresh']) test(`${mode} migration verifier keeps all mutations inside a collision-checked rollback fixture`,()=>{
  const result=spawnSync(process.execPath,['scripts/render-historical-migration-verification.mjs',`--path=${mode}`],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:10000,maxBuffer:250000});
  assert.equal(result.status,0,result.stderr);
  const sql=result.stdout;
  assert.ok(sql.startsWith('BEGIN;'));assert.match(sql,/Scratch schema already exists; no changes permitted/);
  assert.match(sql,/RESET ROLE;\s*ROLLBACK;/);assert.match(sql,/fixture_removed/);
  assert.doesNotMatch(sql,/"public"\.|\bauth\.users|"auth"\."users"|\b(?:CREATE|ALTER|DROP)\s+ROLE\b|\bGRANT\s+authenticated\s+TO\b|(?:ON|INTO|UPDATE|ALTER TABLE)\s+storage\.(?:objects|buckets)/iu);
  if(mode==='fresh') {assert.match(sql,/89 AS executed_app_sql_steps/);assert.match(sql,/167 AS canonical_checks/);assert.doesNotMatch(sql,/DELETE FROM|"AppSession"\s*\(/);assert.match(sql,/FixtureStorageObjects/);assert.match(sql,/FileUpload/);}
  else {assert.match(sql,/FixtureAuthUsers/);assert.match(sql,/Existing API role dependency unavailable/);}
});
