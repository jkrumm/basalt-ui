import { expect, test } from 'bun:test'

test('throwaway: a failing layout test must turn the whole run red', () => {
  expect(1).toBe(2)
})
