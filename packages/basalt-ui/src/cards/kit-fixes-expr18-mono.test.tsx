/**
 * Expression cycle 18 (`v3-expr-18-contract`, n87 .8 and n90 .27): a time or an id in a `StatRow` value
 * or a `PageSummary` fact sets `mono`, the slots the rule "a time or an id sets mono" could not reach.
 * The face itself is measured by `tests/layout/kit-expr18-meters.layout.test.ts`; here the markup.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { PageSummary } from '../page/page-summary'
import { StatCell } from './stat-cell'

afterEach(cleanup)

const classesOf = (el: Element | null): string[] => (el?.className ?? '').split(' ')

describe('mono on a stat row and a summary fact', () => {
  test('a mono StatRow value is drawn in the mono face; a plain one is not', () => {
    const { getByText } = render(
      <StatCell
        title="Held"
        value={47}
        unit="min"
        rows={[
          { label: 'Step', value: 'integration-api', mono: true },
          { label: 'Disagreements', value: 2 },
        ]}
        phase="ready"
      />,
    )
    const step = getByText('integration-api')
    expect(classesOf(step)).toContain('font-mono')
    expect(classesOf(step)).toContain('tabular-nums')
    expect(step.hasAttribute('data-monospace')).toBe(true)
    const count = getByText('2')
    expect(classesOf(count)).not.toContain('font-mono')
    expect(count.hasAttribute('data-monospace')).toBe(false)
  })

  test('a labelled summary fact prints its label and its value, the value mono when asked', () => {
    const { container, getByText } = render(
      <PageSummary
        sentence="12 finals not backed up"
        facts={[
          '3 need you',
          { label: 'Last reindex', value: '21 Nov 2026, 6:10', mono: true },
          { label: 'Raws', value: 37 },
        ]}
      />,
    )
    const facts = [...container.querySelectorAll('[data-slot="page-summary-fact"]')]
    expect(facts.map((f) => f.textContent)).toEqual([
      '3 need you',
      'Last reindex 21 Nov 2026, 6:10',
      'Raws 37',
    ])
    const time = getByText('21 Nov 2026, 6:10')
    expect(classesOf(time)).toContain('font-mono')
    expect(time.hasAttribute('data-monospace')).toBe(true)
    expect(classesOf(getByText('37'))).not.toContain('font-mono')
  })
})
