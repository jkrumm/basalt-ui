/** `getRowId` is required: there is no default index id to fall back on. Checked by `tsc`. */
import { expect, test } from 'bun:test'
import type { SelectionOptions } from './selection'
import { createState } from './state'

test('a missing getRowId fails types', () => {
  const request = createState().request
  // @ts-expect-error getRowId is required
  const missing: SelectionOptions<{ id: string }> = { request }
  const given: SelectionOptions<{ id: string }> = { request, getRowId: (r) => r.id }
  expect(missing).toBeDefined()
  expect(given.getRowId({ id: 'a' })).toBe('a')
})
