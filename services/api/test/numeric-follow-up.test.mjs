import assert from 'node:assert/strict';
import {test} from 'node:test';
import {selectAdaptivePolicy} from '../dist/modules/ai/prompts/adaptive-policy.js';
import {LocalKnowledgeRetriever} from '../dist/modules/knowledge/local-knowledge-retriever.js';
import {isNumericMathReply} from '../dist/modules/knowledge/numeric-math-reply.js';

test('a short numeric answer retains learner language and selects feedback guidance rather than switching to English',()=>{
  const previousMessages=[{role:'user',content:'ช่วยอธิบายกฎของโอห์มเป็นภาษาไทย'}];
  assert.deepEqual(selectAdaptivePolicy({studentInput:'40 V',previousMessages}),{language:'th',mode:'GUIDE'});
  assert.deepEqual(selectAdaptivePolicy({studentInput:'x = 2',previousMessages}),{language:'th',mode:'GUIDE'});
  assert.deepEqual(selectAdaptivePolicy({studentInput:'40 V',previousMessages:[{role:'user',content:'Please explain in English'},{role:'assistant',content:'ข้อความของโมเดลไม่กำหนดภาษาแทนผู้เรียน'}]}),{language:'en',mode:'GUIDE'});
});
test('numeric recognition is bounded, rejects prose and only classifies without evaluating/scoring',()=>{
  for(const input of ['0','-2','x = 2','40 V','2 A','20 Ω','1/2','4e1 V','๔๐ โวลต์']) assert.equal(isNumericMathReply(input),true,input);
  for(const input of ['','Thanks.','Explain voltage','what is 40 V?','2 '.repeat(100)]) assert.equal(isNumericMathReply(input),false,input);
});
test('explicit current language and English acknowledgements still win over old Thai turns',()=>{
  const previousMessages=[{role:'user',content:'อธิบายภาษาไทย'}];
  assert.deepEqual(selectAdaptivePolicy({studentInput:'Explain in English',previousMessages}),{language:'en',mode:'STANDARD'});
  assert.deepEqual(selectAdaptivePolicy({studentInput:'Thanks.',previousMessages}),{language:'en',mode:'ACKNOWLEDGE'});
});
test('numeric follow-up rereads reviewed eligibility only for the latest established concept, never a topic reset',async()=>{
  let calls=0,eligible=true;const reference={passageId:'reviewed-fixture'};
  const retriever=new LocalKnowledgeRetriever({readPilot:async()=>{calls++;return eligible?reference:null;}});
  const previousStudentInputs=["Using Ohm's law, I = 2 A and R = 20 ohms. What is V?"];
  assert.equal((await retriever.retrieve({studentInput:'40 V',previousStudentInputs})).length,1);
  eligible=false;assert.deepEqual(await retriever.retrieve({studentInput:'40 V',previousStudentInputs}),[]);assert.equal(calls,2);
  assert.deepEqual(await retriever.retrieve({studentInput:'2',previousStudentInputs:[...previousStudentInputs,'Solve x + 3 = 5']}),[]);
  assert.equal(calls,2);
  assert.deepEqual(await retriever.retrieve({studentInput:'40 V'}),[]);
});
