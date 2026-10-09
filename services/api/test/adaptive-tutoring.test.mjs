import assert from 'node:assert/strict';
import test from 'node:test';
import { selectAdaptivePolicy } from '../dist/modules/ai/prompts/adaptive-policy.js';
import { MockModelProvider } from '../dist/modules/ai/providers/mock-model-provider.js';
import { mockTutorScenario } from '../dist/modules/ai/mock-tutor-scenario.js';
import { validateTutorOutput } from '../dist/modules/ai/tutor-output-validator.js';
import { createEvaluationHarness } from '../evaluation/rag/helpers.mjs';

// These verify deterministic instruction selection/history/state. Actual model teaching
// quality requires the separately budgeted live evaluation and a human/content review.
const scenarios = [
  { name: 'English confusion after grounded explanation', turns: [
    ["Explain Ohm's law", 'STANDARD', 'English', 1], ["I don't understand", 'SIMPLIFY', 'English', 1],
  ] },
  { name: 'Thai hint after an English question', turns: [
    ["Explain Ohm's law", 'STANDARD', 'English', 1], ['ขอคำใบ้', 'HINT', 'Thai', 1],
  ] },
  { name: 'follow-up and acknowledgement never reuse unauthorized citations', turns: [
    ["Explain Ohm's law", 'STANDARD', 'English', 1], ['What if resistance doubles?', 'STANDARD', 'English', 1],
    ['Thanks.', 'ACKNOWLEDGE', 'English', 0],
  ] },
  { name: 'new topic resets retrieval even when learner is confused', turns: [
    ["Explain Ohm's law", 'STANDARD', 'English', 1], ['Explain photosynthesis.', 'STANDARD', 'English', 0],
    ["I don't understand", 'SIMPLIFY', 'English', 0],
  ] },
  { name: 'learner attempt receives guidance and only explicit ADVANCE changes stage', turns: [
    ["Explain Ohm's law", 'STANDARD', 'English', 1], ['I think using V = IR gives 40 V', 'GUIDE', 'English', 1],
    ["Using Ohm's law, continue to practice", 'STANDARD', 'English', 1, 'ADVANCE'],
  ] },
];
for (const scenario of scenarios) test(scenario.name, async () => {
  const h = createEvaluationHarness(new MockModelProvider({ scenario: mockTutorScenario }));
  for (const [index, [input, mode, language, referenceCount, action = 'RESPOND']] of scenario.turns.entries()) {
    const output = await h.engine.process({ sessionId: 'adaptive-regression', userInput: input, action });
    assert.equal(validateTutorOutput(output).valid, true);
    const request = h.requests[index];
    const task = JSON.parse(request.messages.at(-1).content);
    assert.equal(request.messages.length - 2, index * 2);
    assert.match(request.messages[0].content, new RegExp(`Adaptive teaching mode: ${mode}`));
    assert.match(request.messages[0].content, new RegExp(`Current response language: ${language}`));
    assert.equal(task.sourceMaterials.length, referenceCount);
    assert.equal(task.stage, action === 'ADVANCE' ? 'PRACTICE' : 'EXPLAIN');
    assert.equal(output.progress.percent, action === 'ADVANCE' ? 50 : 25);
    assert.ok(output.citations.every(citation => task.sourceMaterials.some(source => source.citation.id === citation.id)));
    if (index) assert.ok(request.messages.some(message => message.role === 'user' && message.content === scenario.turns[index - 1][0]));
    if (mode === 'HINT') assert.match(request.messages[0].content, /Do not reveal the full solution or final numeric answer/);
    if (mode === 'SIMPLIFY') assert.match(request.messages[0].content, /one check-understanding question/);
  }
});

test('explicit response language wins over input script and history', () => {
  const context = { previousMessages: [{ role: 'user', content: 'old Thai text' }] };
  assert.deepEqual(selectAdaptivePolicy({ ...context, studentInput: 'อธิบาย in English' }), { language: 'en', mode: 'STANDARD' });
  assert.deepEqual(selectAdaptivePolicy({ ...context, studentInput: 'Explain in Thai' }), { language: 'th', mode: 'STANDARD' });
  assert.deepEqual(selectAdaptivePolicy({ ...context, studentInput: 'ขอบคุณครับ' }), { language: 'th', mode: 'ACKNOWLEDGE' });
});
