import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ohmsCurrent, solveLinear, logicOutput } = require('../.web-test-build/lib/learning-simulations.js');
test('Ohm calculation updates for changed operands and rejects zero/nonfinite resistance', () => {
  assert.equal(ohmsCurrent(12, 6), 2); assert.equal(ohmsCurrent(12, 12), 1);
  assert.equal(ohmsCurrent(12, 0), null); assert.equal(ohmsCurrent(Infinity, 6), null);
});
test('linear solver supports unique, no and infinitely-many solutions', () => {
  assert.equal(solveLinear(2, 4, 10), 3); assert.equal(solveLinear(0, 4, 10), 'NONE');
  assert.equal(solveLinear(0, 4, 4), 'ALL'); assert.equal(solveLinear(NaN, 4, 4), null);
});
test('logic gate truth tables are correct for every input combination', () => {
  const pairs = [[false, false], [false, true], [true, false], [true, true]];
  for (const [gate, expected] of [['AND', [0, 0, 0, 1]], ['OR', [0, 1, 1, 1]], ['XOR', [0, 1, 1, 0]]]) {
    assert.deepEqual(pairs.map(([a, b]) => logicOutput(gate, a, b)), expected);
  }
});
