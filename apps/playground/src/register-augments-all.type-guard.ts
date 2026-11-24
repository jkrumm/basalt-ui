// J.2 apps/playground/src/register-augments-all.type-guard.ts
import type { SeriesKey } from 'basalt-ui' // resolves to the `<group>-<key>` names the generated basalt.tokens.css.d.ts registers
const SYM: unique symbol = Symbol()
export function f2(k: SeriesKey) {
  const ok: SeriesKey[] = [
    'demo-sessions',
    'calendar-meeting',
    'bar-tide',
    'served-atlasLarge',
    'fleet6-failed',
    k,
  ]
  // @ts-expect-error a bare key without its group is not registered: the union does not widen to string.
  const loose: SeriesKey = 'sessions'
  // @ts-expect-error a symbol VALUE is NOT in SeriesKey (Extract<keyof,string> dropped symbol keys).
  // CRITIC-FIX: assign a REAL symbol value, NEVER `Symbol() as never` — `never` is assignable to
  // everything, so that cast makes the directive UNUSED (TS2578) and the fixture theatre.
  // (critic-verified on TS 6.0.3: `Symbol() as never` → EXIT 2; this `unique symbol` form → EXIT 0.)
  const bad: SeriesKey = SYM
  return [ok, loose, bad]
}
// PROVES: an augmented slot resolves to exact `<group>-<key>` literals + Extract<,string> keeps symbol keys out.
