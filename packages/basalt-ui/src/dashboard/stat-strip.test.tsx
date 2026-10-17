import type { ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { StatGroup } from './stat-group'
import type { StatStripCell } from './stat-strip'

afterEach(cleanup)

const CSS = readFileSync(join(import.meta.dir, 'stat-strip.module.css'), 'utf8')

function mount(cells: StatStripCell[], footer?: { key: string; content: ReactNode }[]) {
  return render(
    <MantineProvider>
      <StatGroup variant="strip" label="Health" cells={cells} {...(footer && { footer })} />
    </MantineProvider>,
  )
}

const CELLS: StatStripCell[] = [
  {
    key: 'rhr',
    caption: 'Resting HR',
    qualifier: '7d',
    value: '52',
    unit: 'bpm',
    footer: 'as of 06:10',
  },
  { key: 'load', caption: 'Load', value: '410', tone: 'warn' },
  { key: 'none', caption: 'Sleep', value: null },
]

describe('StatGroup variant="strip"', () => {
  test('is a labelled section with one cell per entry', () => {
    const { container } = mount(CELLS)
    const section = container.querySelector('section') as HTMLElement
    expect(section.getAttribute('aria-label')).toBe('Health')
    expect(section.querySelectorAll('[data-strip-cell]').length).toBe(3)
  })

  test('caption line carries the muted qualifier; value carries the unit', () => {
    const { getByText, container } = mount(CELLS)
    expect(getByText('Resting HR')).toBeTruthy()
    expect(getByText('· 7d')).toBeTruthy()
    expect(getByText('bpm')).toBeTruthy()
    expect(getByText('as of 06:10')).toBeTruthy()
    const cell = container.querySelector('[data-strip-cell="rhr"]') as HTMLElement
    expect(cell.getAttribute('aria-labelledby')).toBeTruthy()
  })

  test('a null reading renders an em dash', () => {
    const { container } = mount(CELLS)
    const v = container.querySelector('[data-strip-cell="none"] [data-strip-value]') as HTMLElement
    expect(v.textContent).toBe('—')
  })

  test('tone inks the value only', () => {
    const { container } = mount(CELLS)
    const warn = container.querySelector('[data-strip-cell="load"]') as HTMLElement
    expect((warn.querySelector('[data-strip-value]') as HTMLElement).style.color).toContain(
      '--vx-status-warn',
    )
    const caption = warn.querySelector('[data-strip-caption]') as HTMLElement
    expect(caption.style.color).toBe('')
    const plain = container.querySelector(
      '[data-strip-cell="rhr"] [data-strip-value]',
    ) as HTMLElement
    expect(plain.style.color).toBe('')
  })

  test('rows render as grid rows: label · visual · value · delta', () => {
    const { container, getByText } = mount([
      {
        key: 'g',
        caption: 'Signals',
        rows: [
          { key: 'hrv', label: 'HRV', value: '48 ms', visual: <i data-v /> },
          { key: 'vo2', label: 'VO2max', value: '51' },
        ],
      },
    ])
    expect(container.querySelectorAll('[data-strip-row]').length).toBe(2)
    expect(getByText('HRV')).toBeTruthy()
    expect(container.querySelector('[data-strip-row] [data-v]')).toBeTruthy()
  })

  test('footer row renders under the cells', () => {
    const { container, getByText } = mount(CELLS, [{ key: 'b', content: <b>Budget</b> }])
    expect(container.querySelectorAll('[data-strip-footer-cell]').length).toBe(1)
    expect(getByText('Budget')).toBeTruthy()
  })

  test('loading swaps the hero for the skeleton', () => {
    const { container } = mount([{ key: 'l', caption: 'Load', value: '1', loading: true }])
    expect(container.querySelector('[data-strip-value]')).toBeNull()
    expect(container.querySelector('.mantine-Skeleton-root')).toBeTruthy()
  })
})

describe('StatGroup variant="strip" — review round 1', () => {
  const rows = [
    { key: 'hrv', label: 'HRV', value: '48 ms', delta: <u data-rd /> },
    { key: 'vo2', label: 'VO2max', value: '51' },
  ]

  test('hero and rows render together; the hero is skipped only when value is absent', () => {
    const both = mount([{ key: 'f', caption: 'Fitness', value: '51', rows }])
    expect(both.container.querySelector('[data-strip-value]')?.textContent).toBe('51')
    expect(both.container.querySelectorAll('[data-strip-row]').length).toBe(2)
    cleanup()
    const rowsOnly = mount([{ key: 'f', caption: 'Fitness', rows }])
    expect(rowsOnly.container.querySelector('[data-strip-value]')).toBeNull()
    expect(rowsOnly.container.querySelectorAll('[data-strip-row]').length).toBe(2)
  })

  test('derives data-shot anchors for cells and footer cells', () => {
    const { container } = mount(CELLS, [{ key: 'b', content: 'x' }])
    expect(container.querySelector('[data-shot="strip-rhr"]')).toBeTruthy()
    expect(container.querySelector('[data-shot="strip-footer-b"]')).toBeTruthy()
  })

  test('stale marks the cell and CSS dims it with the package dimmed value', () => {
    const { container } = mount([{ key: 's', caption: 'S', value: '1', stale: true }])
    expect(container.querySelector('[data-strip-cell="s"]')?.getAttribute('data-stale')).toBe(
      'true',
    )
    expect(CSS).toContain('.cell[data-stale]')
    expect(CSS).toContain('opacity: 0.55')
  })

  test('four cells go 2 + 2 at the middle count, never 3 + 1', () => {
    const four = CELLS.concat({ key: 'd', caption: 'D', value: '1' })
    const sm = (cells: StatStripCell[], cols?: 2 | 3 | 4 | 5 | 6) => {
      const { container } = render(
        <MantineProvider>
          <StatGroup variant="strip" label="L" cells={cells} {...(cols && { cols })} />
        </MantineProvider>,
      )
      const el = container.querySelector('section') as HTMLElement
      const out = [
        el.style.getPropertyValue('--basalt-strip-cols'),
        el.style.getPropertyValue('--basalt-strip-cols-sm'),
      ]
      cleanup()
      return out
    }
    expect(sm(four)).toEqual(['4', '2'])
    expect(sm(CELLS)).toEqual(['3', '3'])
    expect(sm(four, 6)).toEqual(['6', '3'])
  })

  test('loading shows skeleton rows in a rows cell', () => {
    const { container } = mount([{ key: 'l', caption: 'L', rows, loading: true }])
    expect(container.querySelector('[data-strip-row]')).toBeNull()
    expect(container.querySelectorAll('.mantine-Skeleton-root').length).toBe(2)
  })

  test('info glyph sits in the caption line; delta and visual slots render', () => {
    const { container } = mount([
      {
        key: 'i',
        caption: 'I',
        info: 'what it is',
        value: '1',
        delta: <b data-d />,
        visual: <i data-vis />,
      },
    ])
    const line = container.querySelector(
      '[data-strip-cell="i"] [data-strip-caption]',
    )!.parentElement!
    expect(line.querySelector('button')).toBeTruthy()
    expect(container.querySelector('[data-d]')).toBeTruthy()
    expect(container.querySelector('[data-vis]')).toBeTruthy()
  })
})

describe('strip CSS', () => {
  test('the row rule is adjacent-sibling and the footer seam draws a block-start rule', () => {
    expect(CSS).toMatch(/\.cell \+ \.cell \{\s*border-block-start: 1px solid var\(--vx-divider\)/)
    expect(CSS).toMatch(/\.footerCell \{[^}]*border-block-start: 1px solid var\(--vx-divider\)/)
  })

  test('cells are split by hairlines, no per-cell shadow', () => {
    expect(CSS).toContain('border-inline-start: 1px solid var(--vx-divider)')
    expect(CSS).not.toContain('box-shadow')
  })

  test('compact container: two columns, odd last cell spans', () => {
    const start = CSS.indexOf('@container basalt-grid (max-width: 479.9px)')
    expect(start).toBeGreaterThan(-1)
    const rule = CSS.slice(start, CSS.indexOf('\n}\n\n', start))
    expect(rule).toContain('repeat(2, minmax(0, 1fr))')
    expect(rule).toContain(':last-child:nth-child(odd)')
    expect(rule).toContain('grid-column: 1 / -1')
  })

  test('the hero value is the proportional sans, never mono', () => {
    const rule = CSS.slice(CSS.indexOf('.value {'), CSS.indexOf('}', CSS.indexOf('.value {')))
    expect(rule).not.toContain('--basalt-font-mono')
    expect(rule).toContain('lining-nums')
  })
})
