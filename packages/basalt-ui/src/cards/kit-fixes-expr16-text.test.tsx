/**
 * Expression cycle 16 (`v3-expr-16-kit-fixes` 1b, 9d): text a StatCell draws is never truncated, so it wraps at
 * 390 (an error cause, a delta pill's base label); the compact chart error line keeps its one truncated line;
 * a stacked BarList part is never narrower than a mark. The widths themselves are measured by
 * `tests/layout/kit-expr16-cards.layout.test.ts`; here the classes that decide them.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { BarList } from './bar-list'
import { StatCell } from './stat-cell'

afterEach(cleanup)

const classesOf = (el: Element | null): string[] => (el?.className ?? '').split(' ')

describe('StatCell text wraps', () => {
  test('an error cause does not truncate and its track grows with it', () => {
    const { container } = render(
      <StatCell
        title="Backlog"
        phase={{ tag: 'error', message: 'Gateway timed out', retry: () => undefined }}
      />,
    )
    expect(classesOf(container.querySelector('[data-slot="stat-error"] p'))).not.toContain(
      'truncate',
    )
    const figure = classesOf(container.querySelector('[data-slot="stat-figure"]'))
    expect(figure).toContain('min-h-8')
    expect(figure).not.toContain('h-8')
  })

  test('a delta base label does not truncate and may drop under its pill', () => {
    const { container } = render(
      <StatCell
        title="Messages"
        value="166,228"
        delta={{ value: '+2,258%', polarity: 'neutral', label: 'vs prior 30 d' }}
        phase="ready"
      />,
    )
    const base = container.querySelector('[data-slot="stat-base"]')
    expect(classesOf(base)).toContain('flex-wrap')
    expect(classesOf(base)).not.toContain('h-6')
    const label = [...(base?.querySelectorAll('p') ?? [])].find(
      (p) => p.textContent === 'vs prior 30 d',
    )
    expect(label).toBeDefined()
    expect(classesOf(label ?? null)).not.toContain('truncate')
  })
})

describe('BarList stacked parts', () => {
  test('a part keeps a minimum width, so a small share is still a mark', () => {
    const { container } = render(
      <BarList
        title="Items by type"
        series={[
          { key: 'done', label: 'Done', color: { light: 'black', dark: 'white' } },
          { key: 'failed', label: 'Failed', color: { light: 'red', dark: 'red' } },
        ]}
        items={[{ label: 'Lessons', value: 500, parts: { done: 499, failed: 1 } }]}
      />,
    )
    const segments = [...container.querySelectorAll('[data-slot="bar-list-segment"]')]
    expect(segments).toHaveLength(2)
    for (const segment of segments) expect(classesOf(segment)).toContain('min-w-1.5')
  })
})
