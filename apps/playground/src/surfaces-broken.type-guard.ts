// J.3 apps/playground/src/surfaces-broken.type-guard.ts
import type { SurfaceSpec } from 'basalt-ui' // type-only re-export from the root barrel (H.4)
// CRITIC-FIX: a single @ts-expect-error suppresses ONLY the immediately-following line. The earlier
// one-directive-over-a-multi-line-literal form left the skill/guardKinds errors UNSUPPRESSED (TS2322,
// EXIT 2). Each bad field needs its OWN directive on the line directly above it. The literal MUST be
// formatted one-field-per-line. (critic-verified on TS 6.0.3: this form → EXIT 0.)
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
// PROVES (both directions): the SURFACES literal-union teeth actually FIRE — not theatre. (Graft from B.)
