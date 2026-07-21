import { test } from 'node:test'
import assert from 'node:assert'

test('simple test', () => {
  var y = 4;
  y += 3;
  assert.strictEqual(y, 7);
})