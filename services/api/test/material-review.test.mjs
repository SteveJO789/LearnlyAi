import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PrismaTextMaterials} from '../dist/modules/input/text-materials.js';
import {PrismaFileMaterials} from '../dist/modules/input/prisma-file-materials.js';
const raw={sql:(strings,...values)=>{const b={returnsRow:()=>b,affectedCount:()=>b,build:()=>({sql:strings.join('?'),values})};return b;}};
test('only learner-confirmed binary text enters tutor context; original extraction and review provenance remain distinct',async()=>{
  const plans=[],rows=[{id:'text',type:'TEXT',status:'READY',normalizedText:'typed x²',reviewedByLearner:false},
    {id:'unconfirmed',type:'IMAGE',status:'READY',normalizedText:'OCR not confirmed',reviewedByLearner:false},
    {id:'confirmed',type:'PDF',status:'READY',normalizedText:'learner correction',reviewedByLearner:true}];
  const store=new PrismaTextMaterials({raw,query:p=>{plans.push(p);return{toArray:async()=>rows};}},'legacy-owner');
  const contexts=await store.findBySessionId('owned');
  assert.deepEqual(contexts.map(m=>m.content),['typed x²','learner correction']);
  assert.ok(contexts.every(m=>m.citation.sourceType==='USER_MATERIAL'));
  assert.ok(plans[0].sql.includes("'learningText'"));assert.ok(plans[0].values.includes('legacy-owner'));
});
test('review binds normalized learning text only to metadata under owned pre-learning lock and API context; no extraction/hash/stage mutation',async()=>{
  const plans=[];let allowed=true;
  const tx={query:p=>{plans.push(p);return{toArray:async()=>allowed?[{id:'owned'}]:[]};},execute:async p=>{plans.push(p);return{affectedRows:1};}};
  const store=new PrismaFileMaterials({raw,transaction:async fn=>fn(tx)},'legacy-owner');
  await store.review('owned','material','  ผู้เรียน x²\r\n2 + 3  ');
  const update=plans.find(p=>p.sql.startsWith('UPDATE'));
  const metadata=JSON.parse(update.values[0]);assert.equal(metadata.learningText,'ผู้เรียน x²\n2 + 3');assert.equal(metadata.reviewedByLearner,true);assert.equal(metadata.learningTextHash.length,64);
  assert.ok(!Object.hasOwn(metadata,'reviewed'));assert.ok(!Object.hasOwn(metadata,'extraction'));
  assert.ok(!/SET "normalizedText"|SET "contentHash"|UPDATE public."LearningSession"/.test(update.sql));
  assert.ok(plans.some(p=>p.sql.includes("state IN ('INPUT', 'PRE_TEST')")&&p.sql.includes('FOR UPDATE')));
  allowed=false;plans.length=0;await assert.rejects(store.review('owned','material','corrected'),e=>e.code==='MATERIAL_REVIEW_CLOSED');
  assert.ok(!plans.some(p=>p.sql.startsWith('UPDATE')));
});
