import { expect, test } from 'bun:test'
import { assertChatAttrs, chatTurns, relative } from './chat-turn-trace'

const span = (name: string, failed = false, attributes = {}) => ({
  name,
  start: 0,
  duration: 1,
  failed,
  attributes,
})

test('chatTurns splits chat.turn spans by outcome; relative drops the absolute clock', () => {
  const spans = [
    { ...span('route.navigate'), start: 1000 },
    { ...span('chat.turn'), start: 1500 },
    { ...span('chat.turn', true), start: 1600 },
  ]
  const turns = chatTurns(spans)
  expect(turns.ok).toHaveLength(1)
  expect(turns.failed).toHaveLength(1)
  expect(relative(spans).map((s) => s.startMs)).toEqual([0, 500, 600])
})

test('relative of no spans is empty', () => {
  expect(relative([])).toEqual([])
})

const okAttrs = {
  'basalt.chat.thread_id': 't',
  'basalt.chat.ttft_ms': 3,
  'basalt.chat.parts': 1,
  'basalt.chat.status': 'done',
}

test('assertChatAttrs passes a complete span and throws on a missing or mistyped attribute', () => {
  expect(() => assertChatAttrs(span('chat.turn', false, okAttrs))).not.toThrow()
  expect(() =>
    assertChatAttrs(span('chat.turn', false, { ...okAttrs, 'basalt.chat.parts': '1' })),
  ).toThrow('basalt.chat.parts is string, want number')
  const { 'basalt.chat.ttft_ms': _omit, ...rest } = okAttrs
  expect(() => assertChatAttrs(span('chat.turn', false, rest))).toThrow('ttft_ms is undefined')
  expect(() => assertChatAttrs(span('chat.turn', true, okAttrs), ['basalt.error.kind'])).toThrow(
    'basalt.error.kind is undefined',
  )
})
