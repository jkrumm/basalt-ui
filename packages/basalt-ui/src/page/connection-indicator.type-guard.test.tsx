/** `ConnectionIndicator` takes its `connection` as a required prop: omitting it does not type-check. */
import { expect, test } from 'bun:test'
import { ConnectionIndicator } from './connection-indicator'

test('connection is required by type', () => {
  // @ts-expect-error -- `connection` is required: the indicator never reads a QueryClient itself
  const missing = <ConnectionIndicator />
  expect(missing).toBeDefined()
})
