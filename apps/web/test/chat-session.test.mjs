import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAdvance, canRespond, clearAutoSendAttempt, confirmsActionCommit, confirmsActionFailure, isCurrentSessionVersion, markAutoSendAttempt, progressPercent, readAutoSendAttempt } from '../.web-test-build/lib/chat-session.js';

const active = {
  hydrating: false,
  loading: false,
  loadError: false,
  lifecycleState: 'ACTIVE',
  stage: 'PRACTICE',
  assessmentCheckPending: false,
  pendingPre: false,
};

test('Chat actions require authoritative active, hydrated session state and settled assessment checks', () => {
  assert.equal(canRespond(active), true);
  for (const change of [
    { hydrating: true },
    { loading: true },
    { loadError: true },
    { lifecycleState: 'FAILED' },
    { lifecycleState: 'COMPLETED' },
    { assessmentCheckPending: true },
    { pendingPre: true },
    { stage: 'REVIEW' },
  ]) assert.equal(canRespond({ ...active, ...change }), false);
});

test('Continue follows server progress and stage, independent of transcript role', () => {
  const allowed = { ...active, progress: { percent: 50, canAdvance: true, nextAction: 'CONTINUE' } };
  assert.equal(canAdvance(allowed), true);
  assert.equal(canAdvance({ ...allowed, progress: { ...allowed.progress, canAdvance: false } }), false);
  assert.equal(canAdvance({ ...allowed, stage: 'REVIEW' }), false);
  assert.equal(canAdvance({ ...allowed, lifecycleState: 'FAILED' }), false);
  assert.equal(canAdvance({ ...allowed, hydrating: true }), false);
});

test('progress display uses server percent and clamps invalid display bounds', () => {
  assert.equal(progressPercent({ percent: 42.6, canAdvance: true, nextAction: null }), 43);
  assert.equal(progressPercent({ percent: 120, canAdvance: true, nextAction: null }), 100);
  assert.equal(progressPercent({ percent: -5, canAdvance: false, nextAction: null }), 0);
  assert.equal(progressPercent(undefined), null);
});

test('an older session detail cannot replace the latest server snapshot', () => {
  assert.equal(isCurrentSessionVersion(null, 1), true);
  assert.equal(isCurrentSessionVersion(4, 4), true);
  assert.equal(isCurrentSessionVersion(5, 4), false);
});

test('auto-send markers persist only the session attempt version and can be cleared after reconciliation', () => {
  const previousStorage = globalThis.sessionStorage;
  const values = new Map();
  globalThis.sessionStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  try {
    assert.equal(readAutoSendAttempt('session-a'), null);
    assert.equal(markAutoSendAttempt('session-a', 12), true);
    assert.equal(readAutoSendAttempt('session-a'), 12);
    assert.equal(values.get('learnlyai:chat-auto-send:session-a'), '12');
    clearAutoSendAttempt('session-a');
    assert.equal(readAutoSendAttempt('session-a'), null);
  } finally {
    if (previousStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previousStorage;
  }
});

test('an ambiguous POST is confirmed only by a newer version with its new persisted user message', () => {
  const baseMessageIds = new Set(['old-user', 'old-tutor']);
  const details = {
    version: 8,
    messages: [
      { id: 'old-user', role: 'USER', content: 'Continue' },
      { id: 'old-tutor', role: 'TUTOR', content: {} },
    ],
  };
  assert.equal(confirmsActionCommit({ baseVersion: 8, baseMessageIds, detail: details, submittedInput: 'Continue' }), false);
  assert.equal(confirmsActionCommit({ baseVersion: 7, baseMessageIds, detail: details, submittedInput: 'Continue' }), false);
  assert.equal(confirmsActionCommit({ baseVersion: 7, baseMessageIds, detail: { ...details, version: 8,
    messages: [...details.messages, { id: 'new-user', role: 'USER', content: 'Continue' }] }, submittedInput: 'Continue' }), true);
  assert.equal(confirmsActionFailure({ baseVersion: 7, baseMessageIds,
    detail: { ...details, version: 8, lifecycleState: 'FAILED' }, submittedInput: 'Continue' }), true);
  assert.equal(confirmsActionFailure({ baseVersion: 7, baseMessageIds,
    detail: { ...details, version: 8, lifecycleState: 'ACTIVE' }, submittedInput: 'Continue' }), false);
});
