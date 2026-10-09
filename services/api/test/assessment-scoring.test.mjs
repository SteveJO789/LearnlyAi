import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssessmentSnapshot, publicAssessmentQuestions, scoreAssessment } from '../dist/modules/assessments/scoring.js';

test('generated linear-equation questions score independently solved answers deterministically in any order', () => {
  const snapshot = createAssessmentSnapshot('assessment-test', 'linear-equations', 'PRE', 'th');
  assert.deepEqual(createAssessmentSnapshot('assessment-test', 'linear-equations', 'PRE', 'th'), snapshot);
  const answers = snapshot.questions.map(q => {
    const match = /แก้สมการ (\d+)x \+ (\d+) = (\d+)/u.exec(q.prompt);
    assert.ok(match);
    return { questionId: q.id, answer: (Number(match[3]) - Number(match[2])) / Number(match[1]) };
  }).reverse();
  const result = scoreAssessment(snapshot, answers);
  assert.equal(result.score, 3);
  assert.equal(result.maxScore, 3);
  assert.deepEqual(scoreAssessment(snapshot, answers), result);
  assert.equal(scoreAssessment(snapshot, answers.map((answer, i) => i ? answer : { ...answer, answer: answer.answer + 1 })).score, 2);
});

test('Ohm exercises use physically correct operands, units and constant-temperature qualification', () => {
  const snapshot = createAssessmentSnapshot('physics-test', 'ohms-law', 'POST', 'en');
  const answers = snapshot.questions.map(q => {
    assert.match(q.prompt, /ohmic resistor at constant temperature/);
    const numbers = [...q.prompt.matchAll(/(\d+) (?:A|Ω|V)/gu)].map(match => Number(match[1]));
    const answer = q.unit === 'V' ? numbers[0] * numbers[1] : numbers[0] / numbers[1];
    return { questionId: q.id, answer };
  });
  assert.deepEqual(snapshot.questions.map(q => q.unit), ['V', 'A', 'Ω']);
  assert.equal(scoreAssessment(snapshot, answers).score, 3);
  const publicQuestions = publicAssessmentQuestions(snapshot);
  assert.equal(publicQuestions.length, 3);
  assert.ok(publicQuestions.every(q => !('rule' in q) && !('correctAnswer' in q)));
});

test('unknown/duplicate/missing answers and client score metadata are controlled validation errors', () => {
  const snapshot = createAssessmentSnapshot('validation-test', 'linear-equations', 'PRE', 'en');
  const valid = snapshot.questions.map(q => ({ questionId: q.id, answer: 2 }));
  for (const input of [null, {}, [], valid.slice(1), [...valid, valid[0]],
    [valid[0], valid[0], valid[2]], [{ ...valid[0], questionId: 'forged' }, ...valid.slice(1)],
    [{ ...valid[0], answer: NaN }, ...valid.slice(1)], [{ ...valid[0], answer: Infinity }, ...valid.slice(1)],
    [{ ...valid[0], answer: '2' }, ...valid.slice(1)], [{ ...valid[0], awardedScore: 100 }, ...valid.slice(1)],
  ]) assert.throws(() => scoreAssessment(snapshot, input), { code: 'VALIDATION_ERROR', status: 400 });
});
