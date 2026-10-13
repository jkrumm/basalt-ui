// The compile-time regression guard for `StatGroup`'s `cols` union and `Section`'s action budget,
// written from the CONSUMER's vantage (the built `basalt-ui` entry, not `src/`). Each
// `@ts-expect-error` is proven by `tsc --noEmit`; an unused directive fails the build.
import { Section, StatGroup } from 'basalt-ui'
import type { BarAction } from 'basalt-ui/controls'
import type { ReactNode } from 'react'

// ── 1. StatGroup cols — StatGroupCols = 2 | 3 | 4 | 5 ────────────────────────────────────────────

export function Group(): ReactNode {
  return (
    <>
      <StatGroup cols={3}>a</StatGroup>
      {/* @ts-expect-error 1 is not a StatGroupCols member (2 | 3 | 4 | 5) — the floor is 2 */}
      <StatGroup cols={1}>b</StatGroup>
      {/* @ts-expect-error 6 is not a StatGroupCols member — the ceiling is 5 */}
      <StatGroup cols={6}>c</StatGroup>
    </>
  )
}

// ── 2. Section actions — at most three typed actions (law C6) ───────────────────────────────────

const action: BarAction = { key: 'export', label: 'Export' }
const four: [BarAction, BarAction, BarAction, BarAction] = [action, action, action, action]

export function Actions(): ReactNode {
  return (
    <>
      <Section title="Typed actions" actions={[action, action, action]}>
        body
      </Section>
      {/* @ts-expect-error a fourth action is over the budget */}
      <Section title="Too many" actions={four}>
        body
      </Section>
    </>
  )
}

// PROVES: StatGroup's cols rejects out-of-range literals and Section's actions tuple caps at three,
// at the consumer/dist vantage.
