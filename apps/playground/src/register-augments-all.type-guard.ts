// J.2 apps/playground/src/register-augments-all.type-guard.ts
import type { SeriesKey } from 'basalt-ui/charts' // resolves to DEMO_SERIES keys via the playground augment
const SYM: unique symbol = Symbol()
export function f2(k: SeriesKey) {
  const ok: 'sessions' | 'signups' | 'revenue' | 'churn' = k // exact union, no widening, no symbol leak
  // @ts-expect-error a symbol VALUE is NOT in SeriesKey (Extract<keyof,string> dropped symbol keys).
  // CRITIC-FIX: assign a REAL symbol value, NEVER `Symbol() as never` — `never` is assignable to
  // everything, so that cast makes the directive UNUSED (TS2578) and the fixture theatre.
  // (critic-verified on TS 6.0.3: `Symbol() as never` → EXIT 2; this `unique symbol` form → EXIT 0.)
  const bad: SeriesKey = SYM
  return [ok, bad]
}
// PROVES: an augmented slot resolves to exact literal keys + Extract<,string> keeps symbol keys out.
