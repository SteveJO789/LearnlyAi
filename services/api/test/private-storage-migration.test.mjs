import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname,join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import operations from '../migrations/app/20261010T0752_private_material_storage/ops.json' with {type:'json'};
import migration from '../migrations/app/20261010T0752_private_material_storage/migration.json' with {type:'json'};
test('storage migration is an additive selected edge and protects its bucket without anonymous app-table access or overwrites',()=>{
 const policies=operations.filter(op=>op.id.startsWith('storage.policy.'));
 assert.equal(policies.length,8);assert.ok(operations.every(op=>op.operationClass==='additive'));
 assert.ok(operations.some(op=>op.id==='column.public.SourceMaterial.storageBucket'));
 const bucket=operations.find(op=>op.id==='storage.private-material-bucket');
 assert.ok(bucket.execute[0].sql.includes('false, 3145728'));assert.ok(bucket.execute[0].sql.includes('ON CONFLICT (id) DO NOTHING'));
 const anonymous=policies.find(op=>op.id==='storage.policy.learnly_materials_anon_guard').execute[0].sql;
 assert.ok(anonymous.includes('FOR ALL TO anon'));assert.ok(!anonymous.includes('LearningSession'));assert.ok(!anonymous.includes('"User"'));
 const update=policies.find(op=>op.id==='storage.policy.learnly_materials_update_guard').execute[0].sql;
 assert.ok(update.includes('RESTRICTIVE'));assert.ok(update.includes("bucket_id IS DISTINCT FROM 'learnly-materials'"));
 assert.ok(policies.every(op=>!op.execute[0].sql.includes('user_metadata')));
 // Same-hash side effects were not selected by db migrate; the real additive column creates a deployable edge.
 assert.notEqual(migration.from,migration.to);
});
test('canonical storage verifier remaps every write to empty clones and always rolls back without creating live objects',()=>{
 const root=mkdtempSync(join(tmpdir(),'learnly-storage-sql-'));
 try{
  const output=join(root,'fixture.sql');
  const result=spawnSync(process.execPath,['scripts/render-private-storage-verification.mjs','--output='+output],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.stderr);const sql=readFileSync(output,'utf8');
  assert.ok(sql.startsWith('BEGIN;'));assert.ok(sql.includes('\nROLLBACK;'));assert.ok(!/\bCOMMIT\b/u.test(sql));
  assert.ok(!/ALTER TABLE\s+"?public|INSERT INTO storage\.|ON storage\.objects/u.test(sql));
  assert.ok(sql.includes('Fixture already exists'));assert.ok(sql.includes('Migration postcheck failed:'));
  assert.ok(sql.includes('Anonymous upload allowed'));assert.ok(sql.includes('Cross-user file delete allowed'));assert.ok(sql.includes('Post-completion compensation delete denied'));
 }finally{
  assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(root.startsWith(join(tmpdir(),'learnly-storage-sql-')));rmSync(root,{recursive:true,force:true});
 }
});
