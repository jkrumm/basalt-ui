/**
 * Compile-time regression guard for `SurfaceSpec`'s literal-union teeth — absorbed from the
 * playground's `surfaces-broken.type-guard.ts` (audit E §7, one of the five non-router fixtures).
 * A single `@ts-expect-error` suppresses only the immediately-following line, so each bad field
 * needs its own directive directly above it, one field per line.
 */
import { describe, expect, test } from 'bun:test'
import type { SurfaceSpec } from './surfaces'

const broken: SurfaceSpec = {
  kind: 'doctrine',
  layer: 'headless',
  // @ts-expect-error 'not-a-rule' is not a RuleName — literal-union rejects
  rule: 'not-a-rule',
  // @ts-expect-error 'nope' is not a SkillName
  skill: ['nope'],
  // @ts-expect-error 'fake-guard' is not a GuardKind
  guardKinds: ['fake-guard'],
  forbiddenImports: [],
}
const badTooling: SurfaceSpec = {
  kind: 'tooling',
  layer: 'headless',
  forbiddenImports: [],
  // @ts-expect-error a tooling surface CANNOT carry `rule` (rule?: never) — the OTHER direction of the teeth
  rule: 'tokens',
}
export { broken, badTooling }
// PROVES (both directions): the SURFACES literal-union teeth actually FIRE — not theatre.

describe('SurfaceSpec (type-guard)', () => {
  test('is a compile-time-only fixture — see the @ts-expect-error directives above', () => {
    expect(true).toBe(true)
  })
})
