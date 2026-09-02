// The compile-time regression guard for `WidgetGrid.Item`'s `span` union, `StatGroup`'s `cols`
// union, and `Section`'s `actions` prop accepting both halves of `SlotActions` (law C15).
import type { ReactNode } from 'react'
import { Section, StatGroup, WidgetGrid } from 'basalt-ui'
import type { BarAction } from 'basalt-ui'

// ── 1. WidgetGrid.Item span — WidgetGridCols = 1 | 2 | 3 | 4 ────────────────────────────────────

export function Grid(): ReactNode {
  return (
    <WidgetGrid>
      <WidgetGrid.Item span={2}>a</WidgetGrid.Item>
      {/* @ts-expect-error 5 is not a WidgetGridCols member (1 | 2 | 3 | 4) */}
      <WidgetGrid.Item span={5}>b</WidgetGrid.Item>
    </WidgetGrid>
  )
}

// ── 2. StatGroup cols — StatGroupCols = 2 | 3 | 4 | 5 ────────────────────────────────────────────

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

// ── 3. Section actions — SlotActions = BarAction[] | ReactNode (law C15) ────────────────────────

const barActions: BarAction[] = [{ key: 'export', label: 'Export' }]

export function Actions(): ReactNode {
  return (
    <>
      <Section title="Typed actions" actions={barActions}>
        body
      </Section>
      <Section title="Node actions" actions={<button type="button">Custom</button>}>
        body
      </Section>
    </>
  )
}

// PROVES: WidgetGrid.Item's span and StatGroup's cols reject out-of-range literals at the
// consumer/dist vantage, and Section's actions slot takes either half of SlotActions with no cast.
