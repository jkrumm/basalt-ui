import { expect, test } from 'bun:test'
import { richParts } from './agent-scenarios'
import { FAIL_AFTER_PARTS, failingTransport } from './AgentStreamDemo'

test('failingTransport yields the first parts then throws a 500', async () => {
  const seen: unknown[] = []
  const run = async () => {
    for await (const part of failingTransport.stream('hi')) seen.push(part)
  }
  await expect(run()).rejects.toMatchObject({ statusCode: 500 })
  expect(seen).toEqual(richParts().slice(0, FAIL_AFTER_PARTS))
})

test('failingTransport stops quietly when aborted', async () => {
  const controller = new AbortController()
  controller.abort()
  const seen: unknown[] = []
  for await (const part of failingTransport.stream('hi', controller.signal)) seen.push(part)
  expect(seen).toEqual([])
})
