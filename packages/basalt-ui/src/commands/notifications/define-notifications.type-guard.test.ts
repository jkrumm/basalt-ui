/**
 * Compile-time proof that `defineNotification`'s OWN JSDoc example compiles.
 *
 * It did not. The factory shipped as `<const T extends NotificationSpec>(spec: T): T` — the shape
 * every other `defineX` takes — and under `strictFunctionTypes` that constraint rejects the one
 * usage the doc block shows: `T` must extend `NotificationSpec<unknown>`, and a
 * `toMessage: (p: { name: string }) => …` is not assignable to `(payload: unknown) => …` because a
 * function parameter is contravariant. A documented example that does not type-check is exactly the
 * class of defect a green suite never sees, so it is pinned here rather than in prose.
 *
 * Same convention as `controls/actions.type-guard.test.ts`: one `@ts-expect-error` per bad line,
 * proven by `tsc --noEmit`, and `*.test.ts` rather than a bare `*.type-guard.ts` so tsup's build
 * glob does not ship the fixture.
 */
import { describe, expect, test } from 'bun:test'
import { defineNotification, defineNotifications } from './define-notifications'
import type { NotificationSpec } from './define-notifications'

// ── the JSDoc example, verbatim ───────────────────────────────────────────────

const uploadSuccess = defineNotification({
  intent: 'success',
  toMessage: (p: { name: string }) => `Uploaded ${p.name}`,
})

// …and its second half: merging the typed constant into the full registry.
const NOTIFICATIONS = defineNotifications({ 'upload:success': uploadSuccess })

// ── P is INFERRED from the annotated parameter, never widened to `unknown` ────

const asDeclared: NotificationSpec<{ name: string }> = uploadSuccess
uploadSuccess.toMessage?.({ name: 'photo.jpg' })

const withAction = defineNotification({
  intent: 'error',
  action: { label: 'Retry', run: (p: { id: number }) => String(p.id) },
})
const fromAction: NotificationSpec<{ id: number }> = withAction

// A spec that annotates NEITHER function keeps `unknown` — the additive fallback.
const unannotated = defineNotification({ intent: 'info', toMessage: () => 'Done' })
const stillUnknown: NotificationSpec<unknown> = unannotated

// ── Invalid — each MUST be a tsc error, one directive per bad line ────────────

// @ts-expect-error the payload was declared `{ name: string }`, not `{ id: number }`
uploadSuccess.toMessage?.({ id: 1 })
// @ts-expect-error the payload was declared `{ name: string }`, not a bare string
uploadSuccess.toMessage?.('photo.jpg')
// @ts-expect-error `run` declared `{ id: number }`, so the spec is not a `{ name: string }` one
const mismatched: NotificationSpec<{ name: string }> = withAction
// @ts-expect-error `intent` is a NotificationIntent, not any string
defineNotification({ intent: 'nope' })

describe('defineNotification (type-guard)', () => {
  test('is an identity passthrough — the proof is that this file type-checks at all', () => {
    expect(uploadSuccess.toMessage?.({ name: 'photo.jpg' })).toBe('Uploaded photo.jpg')
    expect(asDeclared).toBe(uploadSuccess)
    expect(fromAction).toBe(withAction)
    expect(stillUnknown).toBe(unannotated)
    expect(mismatched.action?.label).toBe('Retry')
    expect(NOTIFICATIONS['upload:success']).toBe(uploadSuccess)
  })
})
