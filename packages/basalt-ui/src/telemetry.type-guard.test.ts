/**
 * Compile-time proof for the § 7 contract: `BasaltEvent` is a closed union (a switch ends
 * `default: return event satisfies never`), and `failed` decides whether the failure attributes
 * exist — the types enforce both directions. Checked by `tsc --noEmit`.
 */
import { describe, expect, test } from 'bun:test'
import type { BasaltEvent } from './telemetry'

export function describeEvent(event: BasaltEvent): string {
  switch (event.type) {
    case 'route.navigate':
      return event.attributes['url.path']
    case 'route.error':
      return event.attributes['basalt.route.id']
    case 'query.error':
      return event.attributes['basalt.query.hash']
    case 'mutation.error':
      return event.attributes['basalt.mutation.key']
    case 'render.error':
      return event.attributes['basalt.error.boundary']
    case 'window.error':
      return event.attributes['basalt.error.source']
    case 'chat.turn':
      return event.attributes['basalt.chat.thread_id']
    default:
      return event satisfies never
  }
}

export function missingCase(event: BasaltEvent): string {
  switch (event.type) {
    case 'route.navigate':
      return 'a'
    default:
      // @ts-expect-error a closed union: the other seven types are not `never`
      return event satisfies never
  }
}

// ── Valid ─────────────────────────────────────────────────────────────────────────────────────────

export const ok: BasaltEvent = {
  type: 'route.navigate',
  failed: false,
  start: 0,
  duration: 1,
  attributes: { 'basalt.route.id': 'a', 'basalt.route.from': '/', 'url.path': '/a' },
}

export const failed: BasaltEvent = {
  type: 'mutation.error',
  failed: true,
  start: 0,
  attributes: {
    'basalt.mutation.key': '["k"]',
    'exception.type': 'Error',
    'basalt.error.kind': 'mutation',
  },
}

// ── Invalid ───────────────────────────────────────────────────────────────────────────────────────

export const failedWithoutFailure: BasaltEvent = {
  type: 'mutation.error',
  failed: true,
  start: 0,
  // @ts-expect-error a failed event must carry `exception.type` and `basalt.error.kind`
  attributes: { 'basalt.mutation.key': '["k"]' },
}

export const okWithFailure: BasaltEvent = {
  type: 'route.navigate',
  failed: false,
  start: 0,
  duration: 1,
  attributes: {
    'basalt.route.id': 'a',
    'basalt.route.from': '/',
    'url.path': '/a',
    // @ts-expect-error a non-failed event carries neither failure attribute
    'exception.type': 'Error',
  },
}

// @ts-expect-error an error event has no `duration` (only `chat.turn` is a span on failure)
export const errorWithDuration: BasaltEvent = { ...failed, duration: 1 }

describe('BasaltEvent (type-guard)', () => {
  test('is a compile-time-only fixture — see the @ts-expect-error directives above', () => {
    expect(describeEvent(ok)).toBe('/a')
  })
})
