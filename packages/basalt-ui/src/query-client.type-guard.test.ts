/**
 * Compile-time proof that `unwrap`'s single conditional-return generic signature (1.29.1) infers
 * `TData` in every call shape the 1.29.0 two-overload signature broke — most notably `unwrap`
 * passed BARE as a `.then()` callback, which never applies an overload (it just reads the declared
 * type of the `unwrap` reference) and used to widen to `unknown`. Same convention as
 * `charts/kinds/band-kinds.type-guard.test.ts`: assignment with no cast is the proof for a valid
 * shape, `@ts-expect-error` for an invalid one, both checked by `tsc --noEmit`, and a `.test.ts`
 * name so tsup's build glob does not ship the fixture.
 */
import { describe, expect, test } from 'bun:test'
import { unwrap } from './query-client'

type Thread = { id: string }
type Envelope<TData> = { data: TData | null | undefined; error: unknown }

declare const resolvedEnvelope: Envelope<Thread>
declare const promisedEnvelope: Promise<Envelope<Thread>>

// ── Valid — the three shapes 1.29.0 lost, restored by the single conditional signature ────────────

async function acceptAwaited(): Promise<Thread> {
  const value: Thread = unwrap(await promisedEnvelope)
  return value
}

function acceptResolved(): Thread {
  const value: Thread = unwrap(resolvedEnvelope)
  return value
}

function acceptPromised(): Promise<Thread> {
  const value: Promise<Thread> = unwrap(promisedEnvelope)
  return value
}

function acceptThenCallback(): Promise<Thread> {
  // The regression case: `unwrap` passed bare, never invoked at this call site.
  const value: Promise<Thread> = promisedEnvelope.then(unwrap)
  return value
}

// ── Invalid — a non-envelope argument must stay a tsc error ───────────────────
//
// Wrapped in an uninvoked function: `unwrap(42)` at module scope would actually RUN (bun's test
// transpiler strips the `@ts-expect-error` directive but not the call), throwing the absence guard
// at import time rather than proving anything about the type.

function rejectNonEnvelope(): void {
  // @ts-expect-error — 42 has no `data`/`error` shape, so it satisfies neither branch of the union.
  unwrap(42)
}

describe('unwrap conditional generic (type-guard)', () => {
  test('the proof is the tsc run — this only keeps the file in the suite', () => {
    expect(typeof unwrap).toBe('function')
    expect(typeof acceptAwaited).toBe('function')
    expect(typeof acceptResolved).toBe('function')
    expect(typeof acceptPromised).toBe('function')
    expect(typeof acceptThenCallback).toBe('function')
    expect(typeof rejectNonEnvelope).toBe('function')
  })
})
