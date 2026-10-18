import type { ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Meter } from './meter'
import { StatGroup } from './stat-group'
import type { StatStripCell } from './stat-strip'

afterEach(cleanup)

const CSS = readFileSync(join(import.meta.dir, 'stat-strip.module.css'), 'utf8')

function mount(
  cells: StatStripCell[],
  footer?: { key: string; content: ReactNode; under?: string }[],
) {
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

describe('strip caption line', () => {
  test('the caption truncates with a title, and the info glyph stays in its group', () => {
    const { container } = mount([
      {
        key: 'a',
        caption: 'Dispatch spend',
        qualifier: 'today',
        info: 'Spend so far',
        value: '€4',
      },
    ])
    const caption = container.querySelector('[data-strip-caption]') as HTMLElement
    expect(caption.getAttribute('title')).toBe('Dispatch spend')
    const lead = caption.parentElement as HTMLElement
    expect(lead.querySelector('button')).not.toBeNull()
    expect(lead.textContent).not.toContain('today')
  })
  test('the qualifier is its own wrapping item, with no orphan separator', () => {
    const { getByText } = mount([
      { key: 'a', caption: 'Forecast', qualifier: 'end of October', value: '1' },
    ])
    const q = getByText('end of October')
    expect(q.textContent).toBe('end of October')
    // A direct child of the caption line, next to the lead group, not inside it.
    expect(q.parentElement?.children.length).toBe(2)
    expect(q.previousElementSibling?.textContent).toBe('Forecast')
  })
  test('the caption group never wraps; the qualifier wraps under it instead of truncating (Wave 38)', () => {
    const lead = /\.lead\s*{([^}]*)}/.exec(CSS)?.[1] ?? ''
    expect(lead).toContain('min-width: 0')
    expect(lead).not.toContain('flex-wrap: wrap')
    // The line wraps whole: the qualifier sits beside the caption while it fits, under it otherwise.
    expect(/\.captionMain\s*{([^}]*)}/.exec(CSS)?.[1]).toContain('flex-wrap: wrap')
    const qualifier = /\n\.qualifier\s*{([^}]*)}/.exec(CSS)?.[1] ?? ''
    expect(qualifier).not.toContain('text-overflow')
    expect(qualifier).not.toContain('nowrap')
    expect(/\.caption\s*{([^}]*)}/.exec(CSS)?.[1]).toContain('text-overflow: ellipsis')
  })
})

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
    expect(getByText('7d')).toBeTruthy()
    // The caption (inside its lead group) and the qualifier are the caption line's two direct children.
    const caption = container.querySelector('[data-strip-cell="rhr"] [data-strip-caption]')
    const lead = caption?.parentElement
    const line = lead?.parentElement
    expect([...(line?.children ?? [])].map((c) => c.textContent)).toEqual(['Resting HR', '7d'])
    expect(caption?.textContent).not.toContain('·')
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
    expect(CSS).toContain('.content[data-stale]')
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
  test('the footer seam draws a block-start rule', () => {
    expect(CSS).toMatch(/\.footerCell \{[^}]*border-block-start: 1px solid var\(--vx-divider\)/)
  })

  test('cells (the row-high column) carry leading shadow hairlines that take no layout space', () => {
    const rule = CSS.slice(CSS.indexOf('.cell {'), CSS.indexOf('}', CSS.indexOf('.cell {')))
    expect(rule).toContain('-1px 0 0 var(--vx-divider)')
    expect(rule).toContain('0 -1px 0 var(--vx-divider)')
    expect(rule).not.toContain('border')
    expect(CSS).not.toContain('.cell:first-child')
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

describe('strip compact cells (Wave 37)', () => {
  test('a cell is wrapped by a slot that owns the dividers, so they run the whole row', () => {
    const { container } = mount(CELLS)
    const cell = container.querySelector('[data-strip-cell="rhr"]') as HTMLElement
    const slot = cell.closest('[data-strip-slot]') as HTMLElement
    expect(slot).not.toBeNull()
    expect(slot.parentElement?.contains(cell)).toBe(true)
    expect(CSS).toMatch(/\.cell\s*\{[^}]*box-shadow/)
    expect(CSS).not.toMatch(/\.content\s*\{[^}]*box-shadow/)
  })

  test('the cell box ends at its content: align-self start, never stretched', () => {
    expect(CSS).toMatch(/\.content\s*\{[^}]*align-self:\s*start/)
  })

  test('action sits in the caption line, after the caption, and the caption keeps its title', () => {
    const { container } = mount([
      {
        key: 'a',
        caption: 'Weekly target',
        value: '3',
        action: <button type="button">Edit</button>,
      },
    ])
    const line = container.querySelector('[data-strip-cell] > div') as HTMLElement
    const action = line.querySelector('[data-strip-action]') as HTMLElement
    expect(action.querySelector('button')?.textContent).toBe('Edit')
    expect(line.querySelector('[data-strip-caption]')?.getAttribute('title')).toBe('Weekly target')
    // Last item of the caption line (right-aligned by CSS), and never allowed to shrink.
    expect(line.lastElementChild).toBe(action)
    expect(CSS).toMatch(/\.action\s*\{[^}]*margin-inline-start:\s*auto/)
    expect(CSS).toMatch(/\.captionLine\s*\{[^}]*flex-wrap:\s*nowrap/)
    expect(line.firstElementChild?.contains(line.querySelector('[data-strip-caption]'))).toBe(true)
  })

  test('hideValue keeps the row label and drops the reading', () => {
    const { container } = mount([
      {
        key: 'a',
        caption: 'Fitness',
        value: '47',
        rows: [
          { key: 'vo2', label: 'VO2max', value: '', hideValue: true },
          { key: 'rhr', label: 'Resting HR', value: '52 bpm' },
        ],
      },
    ])
    const vo2 = container.querySelector('[data-strip-row="vo2"]') as HTMLElement
    expect(vo2.textContent).toBe('VO2max')
    const rhr = container.querySelector('[data-strip-row="rhr"]') as HTMLElement
    expect(rhr.textContent).toBe('Resting HR52 bpm')
    // Same four-column row, so a delta still lands in its column.
    expect(vo2.children.length).toBe(rhr.children.length)
  })

  test('hideValue wins over a null reading: no em dash', () => {
    const { container } = mount([
      {
        key: 'a',
        caption: 'X',
        value: '1',
        rows: [{ key: 'r', label: 'L', value: null, hideValue: true }],
      },
    ])
    expect((container.querySelector('[data-strip-row="r"]') as HTMLElement).textContent).toBe('L')
  })

  test('a footer-row entry keeps its meter captions together (CSS contract)', () => {
    expect(CSS).toMatch(
      /\.footerCell\s+\[data-meter-captions\][^{]*\{[^}]*justify-content:\s*flex-start/,
    )
  })
})

describe('strip cell tone reaches a hosted Meter', () => {
  const fill = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-meter-fill]')?.style.background

  test('a toned hero cell colours the plain Meter in its visual', () => {
    const { container } = mount([
      {
        key: 'a',
        caption: 'Load',
        value: '90',
        tone: 'bad',
        visual: <Meter label="Load" value={90} />,
      },
    ])
    expect(fill(container)).toBe('var(--vx-status-bad)')
  })

  test('an untoned cell leaves the Meter on its own colour', () => {
    const plain = mount([
      { key: 'a', caption: 'Load', value: '90', visual: <Meter label="Load" value={90} /> },
    ])
    expect(fill(plain.container)).not.toBe('var(--vx-status-bad)')
  })
})

describe('footer entry under a cell', () => {
  test('`under` renders the entry inside that cell’s slot; an unknown key stays full width', () => {
    const { container } = mount(CELLS, [
      { key: 'a', content: 'one', under: 'load' },
      { key: 'b', content: 'two', under: 'missing' },
      { key: 'c', content: 'three' },
    ])
    const placed = container.querySelector<HTMLElement>('[data-strip-footer-cell="a"]')!
    expect(placed.getAttribute('data-under')).toBe('load')
    const slot = container
      .querySelector('[data-strip-cell="load"]')!
      .closest<HTMLElement>('[data-strip-slot]')!
    expect(slot.contains(placed)).toBe(true)
    expect(placed.getAttribute('data-shot')).toBe('strip-footer-a')
    for (const key of ['b', 'c']) {
      const full = container.querySelector(`[data-strip-footer-cell="${key}"]`)!
      expect(full.hasAttribute('data-under')).toBe(false)
      expect(full.closest('[data-strip-slot]')).toBeNull()
    }
  })

  test('no resolvable `under` puts every entry in the full-width row', () => {
    const { container } = mount(CELLS, [{ key: 'a', content: 'one', under: 'missing' }])
    expect(container.querySelector('[data-strip-slot] [data-strip-footer-cell]')).toBeNull()
    expect(container.querySelectorAll('[data-strip-footer-cell]').length).toBe(1)
  })
})
