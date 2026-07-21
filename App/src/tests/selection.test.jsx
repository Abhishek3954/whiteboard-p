import { test, expect } from 'vitest'

test('simple test to work with github actions', () => {
  var x = 2;
  x++;
  expect(x).toBe(3);
})
