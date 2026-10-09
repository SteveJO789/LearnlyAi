import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const { AssessmentView } = require('../.web-test-build/app/components/assessment-view.js');
const { LearningSummaryView } = require('../.web-test-build/app/components/learning-summary.js');
const { LanguageProvider } = require('../.web-test-build/app/lib/i18n/LanguageContext.js');
const BlockView = require('../.web-test-build/app/Chat/[sessionId]/blocks.js').default;
const noop = () => {};
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const props = { language: 'th', phase: 'PRE', assessment: null, loading: false, saving: false, error: null,
  topic: '', answers: {}, onTopic: noop, onAnswer: noop, onCreate: noop, onSubmit: noop, onRetry: noop };
const assessment = { id: 'assessment', sessionId: 'session', phase: 'PRE', topic: 'ohms-law', language: 'th',
  questions: [{ id: 'q1', prompt: 'แรงดันเท่าไร?', format: 'NUMBER', unit: 'V' }], score: null, maxScore: 1, submittedAt: null };

test('assessment has accessible topic/answer labels, required numeric input and disabled incomplete submit', () => {
  const empty = render(AssessmentView, props);
  assert.match(empty, /for="assessment-topic"/); assert.match(empty, /เลือกหัวข้อ/); assert.match(empty, /disabled/);
  const form = render(AssessmentView, { ...props, assessment });
  assert.match(form, /for="answer-q1"/); assert.match(form, /type="number"/); assert.match(form, /required/);
  assert.match(form, /คำตอบ \(V\)/); assert.match(form, /disabled/);
});
test('assessment loading/error/saving/result states render without hiding a zero score', () => {
  assert.match(render(AssessmentView, { ...props, loading: true }), /role="status"/);
  assert.match(render(AssessmentView, { ...props, error: '<script>unsafe</script>' }), /role="alert"/);
  assert.doesNotMatch(render(AssessmentView, { ...props, error: '<script>unsafe</script>' }), /<script>/);
  assert.match(render(AssessmentView, { ...props, assessment, saving: true, answers: { q1: '2' } }), /กำลังบันทึกคำตอบ/);
  const result = render(AssessmentView, { ...props, assessment: { ...assessment, score: 0, submittedAt: '2026-10-09',
    answers: [{ questionId: 'q1', response: 2, isCorrect: false, awardedScore: 0 }] }, answers: { q1: '2' } });
  assert.match(result, /0\/1/); assert.match(result, /disabled/); assert.match(result, /บันทึกคำตอบแล้ว/);
});
test('learning summary uses real metric props, sample sizes, paired comparison and safe owned links', () => {
  const html = render(LearningSummaryView, { language: 'en', loading: false, error: null, retry: noop,
    profile: { mastery: { 'ohms-law': { percent: 67, assessmentId: 'a', sampleQuestions: 3, assessedAt: '2026-10-09' } }, strengths: [], weakPoints: [], updatedAt: '2026-10-09' },
    progress: { sessionCount: 2, completedSessionCount: 1, averageProgressPercent: 50,
      comparisons: [{ sessionId: 's', topic: 'ohms-law', prePercent: 33, postPercent: 67, deltaPercent: 34 }] },
    sessions: [{ id: 's/unsafe', title: '<script>title</script>', progressPercent: 50 }] });
  assert.match(html, /67% · 3 questions/); assert.match(html, /33% → Post: 67% \(\+34\)/);
  assert.match(html, /\/Chat\/s%2Funsafe/); assert.doesNotMatch(html, /<script>/);
});
test('empty and failed learning summaries are explicit states rather than fabricated metrics', () => {
  const base = { language: 'th', profile: { mastery: {}, strengths: [], weakPoints: [], updatedAt: null },
    progress: { sessionCount: 0, completedSessionCount: 0, averageProgressPercent: 0, comparisons: [] },
    sessions: [], loading: false, error: null, retry: noop };
  assert.match(render(LearningSummaryView, base), /ยังไม่มีผลแบบทดสอบ/);
  assert.match(render(LearningSummaryView, { ...base, error: 'Could not load' }), /role="alert"/);
  assert.match(render(LearningSummaryView, { ...base, loading: true }), /role="status"/);
});
test('all canonical tutor block types render with noninteractive choices disabled', () => {
  const blocks = [
    { id: 'e', type: 'explanation', content: 'reason' },
    { id: 'g', type: 'guided_question', content: 'choose', expectedInput: 'CHOICE', choices: ['A', 'B'] },
    { id: 'h', type: 'hint', content: 'next step', level: 1 },
    { id: 'q', type: 'quiz', questionId: 'quiz', format: 'MULTIPLE_CHOICE', prompt: 'quiz prompt', choices: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
    { id: 'f', type: 'feedback', content: 'check', result: 'TRY_AGAIN' },
    { id: 'i', type: 'interactive', component: 'OHMS_LAW', props: { voltage: 12, resistance: 6 } },
  ];
  for (const block of blocks) {
    const html = renderToStaticMarkup(React.createElement(LanguageProvider, null,
      React.createElement(BlockView, { block, interactive: false, onChoose: noop })));
    assert.ok(html.length > 20, block.type);
    if (block.type === 'guided_question' || block.type === 'quiz') assert.match(html, /disabled/);
  }
});
