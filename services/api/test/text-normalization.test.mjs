import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTextMaterial } from '../dist/modules/input/text-materials.js';

test('text normalization preserves math notation and Thai while normalizing lines/Unicode composition', () => {
  assert.equal(normalizeTextMaterial('  x² + 4 = 10\r\nกฎของโอห์ม  '), 'x² + 4 = 10\nกฎของโอห์ม');
  assert.equal(normalizeTextMaterial('e\u0301'), 'é');
});
test('invalid text is rejected rather than silently stripping source content', () => {
  for (const value of [null, 2, {}, [], '', '  ', 'x'.repeat(8001), 'hello\u0000world']) {
    assert.throws(() => normalizeTextMaterial(value), { code: 'VALIDATION_ERROR', status: 400 });
  }
});
