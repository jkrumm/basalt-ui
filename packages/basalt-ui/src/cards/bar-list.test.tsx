import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act } from 'react'
import { useChartFocus } from '../charts/focus'
import { RELEASE_MS } from '../core/focus-release'
import { renderToString } from 'react-dom/server'
import { BarList } from './bar-list'
import type { BarListProps } from './bar-list'

afterEach(cleanup)

const released = (): Promise<void> =>
  act(async () => {
    await new Promise((done) => setTimeout(done, RELEASE_MS + 40))
  })

const ITEMS = [
  { label: 'argo', value: 1840 },
  { label: 'rb', value: 920 },
  { label: 'linewatch', value: 460 },
]

const draw = (props: Partial<BarListProps> = {}): ReturnType<typeof render> =>
  render(<BarList title="Top projects" items={ITEMS} {...props} />)

const fills = (root: ParentNode): string[] =>
  [...root.querySelectorAll<HTMLElement>('[data-slot="bar-list-fill"]')].map((el) => el.style.width)

const values = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot="bar-list-value"]')].map((el) => el.textContent ?? '')

describe('BarList', () => {
  test('is a list with an accessible name and text values', () => {
    const { getByRole, container } = draw()
    expect(getByRole('list', { name: 'Top projects' })).toBeTruthy()
    expect(container.querySelectorAll('[data-slot="bar-list-row"]')).toHaveLength(3)
    expect(values(container)).toEqual(['1,840', '920', '460'])
  })

  test('a truncating label carries its full text in title', () => {
    const { container } = draw()
    expect(container.querySelector('[data-slot="bar-list-label"]')?.getAttribute('title')).toBe(
      'argo',
    )
  })

  test('bars share one scale: the largest value fills the track', () => {
    const { container } = draw()
    expect(fills(container)).toEqual(['100%', '50%', '25%'])
  })

  test('an explicit max rescales every bar', () => {
    const { container } = draw({ max: 3680 })
    expect(fills(container)).toEqual(['50%', '25%', '12.5%'])
  })

  test('format changes the text, never the bar', () => {
    const { container } = draw({ format: (n) => `${n / 1000}k` })
    expect(values(container)).toEqual(['1.84k', '0.92k', '0.46k'])
    expect(fills(container)[0]).toBe('100%')
  })

  test('all-zero values draw empty bars', () => {
    const { container } = draw({ items: [{ label: 'a', value: 0 }] })
    expect(fills(container)).toEqual(['0%'])
  })

  test('negative values clamp to 0 and values above max clamp to 100', () => {
    const { container } = draw({
      max: 100,
      items: [
        { label: 'neg', value: -20 },
        { label: 'over', value: 250 },
      ],
    })
    expect(fills(container)).toEqual(['0%', '100%'])
  })

  test('a single item fills its own scale', () => {
    const { container } = draw({ items: [{ label: 'only', value: 7 }] })
    expect(fills(container)).toEqual(['100%'])
  })

  test('duplicate labels render as distinct rows', () => {
    const { container } = draw({
      items: [
        { label: 'same', value: 1 },
        { label: 'same', value: 2 },
      ],
    })
    expect(container.querySelectorAll('[data-slot="bar-list-row"]')).toHaveLength(2)
  })

  test('a non-finite value prints a dash, draws 0% and does not set the scale', () => {
    const { container } = draw({
      items: [
        { label: 'broken', value: Number.NaN },
        { label: 'ok', value: 10 },
      ],
    })
    expect(values(container)).toEqual(['—', '10'])
    expect(fills(container)).toEqual(['0%', '100%'])
  })

  test('a scale of 0 draws every bar at 0%', () => {
    const { container } = draw({ max: 0 })
    expect(fills(container)).toEqual(['0%', '0%', '0%'])
  })

  test('a secondary value sits in its own cell on the row that has one', () => {
    const { container } = draw({
      items: [{ label: 'argo', value: 1, secondary: '41%' }, ITEMS[1]!],
    })
    const cells = container.querySelectorAll('[data-slot="bar-list-secondary"]')
    expect(cells).toHaveLength(1)
    expect(cells[0]?.textContent).toBe('41%')
  })
})

describe('BarList part of a whole', () => {
  test('max equal to the total marks the list and prints each share', () => {
    const { getByRole, container } = draw({ max: 3220 })
    expect(getByRole('list').hasAttribute('data-whole')).toBe(true)
    expect(
      [...container.querySelectorAll('[data-slot="bar-list-secondary"]')].map(
        (el) => el.textContent,
      ),
    ).toEqual(['57%', '29%', '14%'])
  })

  test('a row secondary wins over the share', () => {
    const { container } = draw({
      max: 3220,
      items: [{ label: 'argo', value: 1840, secondary: 'Good' }, ITEMS[1]!, ITEMS[2]!],
    })
    expect(container.querySelector('[data-slot="bar-list-secondary"]')?.textContent).toBe('Good')
  })

  test('a max that is not the total is a plain scale', () => {
    const { getByRole, container } = draw({ max: 5000 })
    expect(getByRole('list').hasAttribute('data-whole')).toBe(false)
    expect(container.querySelector('[data-slot="bar-list-secondary"]')).toBeNull()
  })

  test('no max is never a whole', () => {
    expect(draw().getByRole('list').hasAttribute('data-whole')).toBe(false)
  })
})

describe('BarList rows as targets', () => {
  test('a row with href is a link, a row with onClick is a button, a plain row is neither', () => {
    const onClick = mock(() => undefined)
    const { container, getAllByRole, queryAllByRole } = draw({
      items: [
        { label: 'argo', value: 3, href: '/argo' },
        { label: 'rb', value: 2, onClick },
        { label: 'plain', value: 1 },
      ],
    })
    expect(getAllByRole('link')).toHaveLength(1)
    expect(getAllByRole('link')[0]?.getAttribute('href')).toBe('/argo')
    expect(getAllByRole('button')).toHaveLength(1)
    fireEvent.click(getAllByRole('button')[0]!)
    expect(onClick).toHaveBeenCalledTimes(1)
    const rows = container.querySelectorAll('[data-slot="bar-list-row"]')
    expect(rows[2]?.querySelector('a, button, [role="link"], [role="button"]')).toBeNull()
    expect(queryAllByRole('link')).toHaveLength(1)
  })

  test('no row is a target when none carries href or onClick', () => {
    const { queryAllByRole } = draw()
    expect(queryAllByRole('link')).toHaveLength(0)
    expect(queryAllByRole('button')).toHaveLength(0)
  })
})

describe('BarList phases', () => {
  test('loading draws row skeletons and no list', () => {
    const { container, queryByRole } = draw({ phase: 'loading' })
    expect(queryByRole('list')).toBeNull()
    expect(container.querySelector('[data-slot="card-phase"]')?.getAttribute('data-phase')).toBe(
      'loading',
    )
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  test('empty items say why, with no list', () => {
    const { getByText, queryByRole } = draw({ items: [] })
    expect(getByText('No items to compare yet')).toBeTruthy()
    expect(queryByRole('list')).toBeNull()
  })

  test('the caller names the cause of an empty list', () => {
    const { getByText } = draw({
      items: [],
      empty: { cause: 'No projects ran this week' },
    })
    expect(getByText('No projects ran this week')).toBeTruthy()
  })

  test('an error phase draws the error arm and no rows', () => {
    const { getByRole, container } = draw({
      phase: { tag: 'error', retry: () => undefined },
    })
    expect(getByRole('alert')).toBeTruthy()
    expect(container.querySelector('[data-slot="bar-list-row"]')).toBeNull()
  })

  test('stale keeps the rows', () => {
    const { container } = draw({ phase: 'stale' })
    expect(container.querySelectorAll('[data-slot="bar-list-row"]')).toHaveLength(3)
    expect(container.querySelector('[data-slot="card-phase"]')?.getAttribute('data-phase')).toBe(
      'stale',
    )
  })

  test('every phase keeps the one body height', () => {
    const heights = (['ready', 'loading', 'stale'] as const).map((phase) => {
      const { container } = draw({ phase, bodyRows: 6 })
      const height = container.querySelector<HTMLElement>('[data-slot="inset"]')?.style.height
      cleanup()
      return height
    })
    expect(new Set(heights).size).toBe(1)
    expect(heights[0]).toBe('calc(var(--spacing) * 66)')
  })
})

describe('BarList error title', () => {
  const failed = { tag: 'error' as const, retry: () => undefined }
  const alert = (root: ParentNode): string | null | undefined =>
    root.querySelector('[role="alert"] p')?.textContent

  test('a list in error names its title, as a ChartCard does', () => {
    const { container } = draw({ title: 'Top projects', phase: failed })
    expect(alert(container)).toBe('Could not load top projects.')
  })

  test('a blank title keeps the bare sentence', () => {
    const { container } = draw({ title: ' ', phase: failed })
    expect(alert(container)).toBe('Could not load this. The request failed.')
  })
})

describe('BarList scroll cue', () => {
  const MANY = Array.from({ length: 13 }, (_, i) => ({ label: `row ${i}`, value: 100 - i }))
  const cue = (root: ParentNode): string | null | undefined =>
    root.querySelector('[data-slot="bar-list-scroll-cue"]')?.textContent

  test('a list with more rows than bodyRows says how many show', () => {
    expect(cue(draw({ items: MANY, bodyRows: 4 }).container)).toBe('4 of 13 shown')
  })

  test('the default five rows count the same way', () => {
    expect(cue(draw({ items: MANY }).container)).toBe('5 of 13 shown')
  })

  test('a list that fits says nothing', () => {
    expect(cue(draw({ items: MANY.slice(0, 5) }).container)).toBeUndefined()
  })

  test('says nothing before ready: loading, error and empty keep the header bare', () => {
    expect(cue(draw({ items: MANY, phase: 'loading' }).container)).toBeUndefined()
    expect(
      cue(draw({ items: MANY, phase: { tag: 'error', retry: () => undefined } }).container),
    ).toBeUndefined()
  })
})

describe('BarList on the server', () => {
  test('renders with no provider and keeps its slots; the scroller is not yet a tab stop', () => {
    const html = renderToString(<BarList title="Top projects" items={ITEMS} />)
    for (const slot of ['bar-list', 'bar-list-row', 'bar-list-fill', 'list-scroll']) {
      expect(html).toContain(`data-slot="${slot}"`)
    }
    expect(html).not.toContain('tabindex')
  })
})

/** Which rows wear `data-focused`, in order. */
const rowsOf = (root: ParentNode): boolean[] =>
  [...root.querySelectorAll('[data-slot="bar-list-row"]')].map((el) =>
    el.hasAttribute('data-focused'),
  )

describe('BarList focus', () => {
  let handle: ReturnType<typeof useChartFocus<(typeof ITEMS)[number]>> | undefined
  function Linked({ linked = true }: { linked?: boolean }) {
    const focus = useChartFocus(ITEMS, { announce: (d) => d.label })
    handle = focus
    return <BarList title="Top projects" items={ITEMS} {...(linked && { focus })} />
  }
  const dimmedRows = (root: ParentNode): boolean[] =>
    [...root.querySelectorAll('[data-slot="bar-list-row"]')].map((el) =>
      el.hasAttribute('data-dimmed'),
    )

  test('pointing at a row sets its index; a focus set elsewhere marks only that row and dims the rest', () => {
    const { container } = render(<Linked />)
    expect(dimmedRows(container)).toEqual([false, false, false])
    fireEvent.pointerEnter(container.querySelectorAll('[data-slot="bar-list-row"]')[1] as Element)
    expect(handle?.index).toBe(1)
    expect(rowsOf(container)).toEqual([false, true, false])
    expect(dimmedRows(container)).toEqual([true, false, true])
    act(() => handle?.set(2))
    expect(rowsOf(container)).toEqual([false, false, true])
    expect(dimmedRows(container)).toEqual([true, true, false])
    act(() => handle?.set(null))
    expect(dimmedRows(container)).toEqual([false, false, false])
  })

  test('the list is one tab stop and arrows, Home, End and Escape step the focus', () => {
    const { getByRole } = render(<Linked />)
    const list = getByRole('list', { name: 'Top projects' })
    expect(list.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(handle?.index).toBe(0)
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(handle?.index).toBe(1)
    fireEvent.keyDown(list, { key: 'End' })
    expect(handle?.index).toBe(2)
    fireEvent.keyDown(list, { key: 'Home' })
    expect(handle?.index).toBe(0)
    fireEvent.keyDown(list, { key: 'Escape' })
    expect(handle?.index).toBeNull()
    expect(fireEvent.keyDown(list, { key: 'a' })).toBe(true)
  })

  test('a mouse leaving or a blur out of the list clears; a link row focuses its item', async () => {
    const onClick = mock(() => undefined)
    function Buttons() {
      const focus = useChartFocus(ITEMS, { announce: (d) => d.label })
      handle = focus
      return (
        <BarList title="Top projects" items={ITEMS.map((i) => ({ ...i, onClick }))} focus={focus} />
      )
    }
    const { getByRole, getAllByRole } = render(<Buttons />)
    act(() => getAllByRole('button')[2]?.focus())
    expect(handle?.index).toBe(2)
    act(() => getAllByRole('button')[2]?.blur())
    expect(handle?.index).toBeNull()
    act(() => handle?.set(1))
    fireEvent.pointerLeave(getByRole('list'), { pointerType: 'mouse' })
    await released()
    expect(handle?.index).toBeNull()
  })

  test('without focus the list is not a tab stop and carries no focus attributes', () => {
    const { getByRole, container } = render(<Linked linked={false} />)
    expect(getByRole('list').hasAttribute('tabindex')).toBe(false)
    expect(container.querySelector('[data-focused]')).toBeNull()
  })
})

describe('BarList across grains', () => {
  const KINDS = [
    { key: 'chat', label: 'chat', value: 120 },
    { key: 'code', label: 'code', value: 80 },
    { key: 'embed', label: 'embedding', value: 40 },
  ]
  const MODEL: Record<string, string> = { chat: 'opus', code: 'sonnet', embed: 'haiku' }
  const HOURS = Array.from({ length: 6 }, (_, h) => ({ h }))
  type Hour = (typeof HOURS)[number]
  let hours: ReturnType<typeof useChartFocus<Hour>> | undefined
  const rowAt = (root: ParentNode, i: number): Element =>
    root.querySelectorAll('[data-slot="bar-list-row"]')[i] as Element
  const marks = (root: ParentNode, attr: string): boolean[] =>
    [...root.querySelectorAll('[data-slot="bar-list-row"]')].map((el) => el.hasAttribute(attr))
  const liveOf = (root: ParentNode): string =>
    root.querySelector('[data-slot="bar-list-live"]')?.textContent ?? ''

  function BySeries() {
    const focus = useChartFocus(HOURS, { announce: (d) => `hour ${d.h}` })
    hours = focus
    return (
      <BarList
        title="Requests by kind"
        items={KINDS}
        focusSeries={{ focus, key: (row) => MODEL[row.key ?? row.label] ?? '' }}
      />
    )
  }

  function ByItems() {
    const focus = useChartFocus(HOURS, { announce: (d) => `hour ${d.h}` })
    hours = focus
    return (
      <BarList
        title="Windows"
        items={[
          { key: 'early', label: 'early', value: 3 },
          { key: 'late', label: 'late', value: 2 },
          { key: 'none', label: 'never', value: 0 },
        ]}
        focusItems={{
          focus,
          holds: (row, hour: Hour) =>
            row.key === 'early' ? hour.h < 3 : row.key === 'late' ? hour.h >= 4 : false,
        }}
      />
    )
  }

  test("a row's pointerover alone links it: the chart node under the pointer left the DOM, so no pointerout came", () => {
    const { container } = render(<BySeries />)
    // React skips a pointerover whose related target is one of its nodes (it expects the pointerout):
    // the chart's crosshair is such a node, removed under the pointer, so only pointerover reaches the row.
    const crossed = container.querySelector('ul') as Element
    fireEvent.pointerOver(rowAt(container, 1), { relatedTarget: crossed })
    expect(hours?.series).toBe('sonnet')
    expect(marks(container, 'data-focused')).toEqual([false, true, false])
  })

  test('a row that stands for a series emphasises it; the legend marks the row and dims the rest', async () => {
    const { container } = render(<BySeries />)
    fireEvent.pointerEnter(rowAt(container, 1))
    expect(hours?.series).toBe('sonnet')
    expect(marks(container, 'data-focused')).toEqual([false, true, false])
    expect(marks(container, 'data-dimmed')).toEqual([true, false, true])
    act(() => hours?.setSeries('haiku'))
    expect(marks(container, 'data-focused')).toEqual([false, false, true])
    act(() => hours?.setSeries('other'))
    expect(marks(container, 'data-dimmed')).toEqual([false, false, false])
    fireEvent.pointerLeave(container.querySelector('ul') as Element, { pointerType: 'mouse' })
    await released()
    expect(hours?.series).toBeNull()
  })

  test('series rows: the list is one tab stop, its keys step its own rows and the live region names the row', () => {
    const { getByRole, container } = render(<BySeries />)
    const list = getByRole('list', { name: 'Requests by kind' })
    expect(list.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(hours?.series).toBe('opus')
    expect(liveOf(container)).toBe('chat, 120')
    fireEvent.keyDown(list, { key: 'End' })
    expect(hours?.series).toBe('haiku')
    expect(liveOf(container)).toBe('embedding, 40')
    fireEvent.keyDown(list, { key: 'ArrowUp' })
    expect(liveOf(container)).toBe('code, 80')
    // A pointer that emphasises another series silences the stepped row.
    fireEvent.pointerEnter(rowAt(container, 0))
    expect(liveOf(container)).toBe('')
    fireEvent.keyDown(list, { key: 'Escape' })
    expect(hours?.series).toBeNull()
    expect(fireEvent.keyDown(list, { key: 'a' })).toBe(true)
  })

  test('a row that holds items of another grain holds them all; a focused item marks its row', () => {
    const { container } = render(<ByItems />)
    fireEvent.pointerEnter(rowAt(container, 0))
    expect(hours?.span.map((d) => d.h)).toEqual([0, 1, 2])
    expect(marks(container, 'data-focused')).toEqual([true, false, false])
    expect(marks(container, 'data-dimmed')).toEqual([false, true, true])
    act(() => hours?.set(5))
    expect(marks(container, 'data-focused')).toEqual([false, true, false])
    act(() => hours?.set(3))
    expect(marks(container, 'data-focused')).toEqual([false, false, false])
    fireEvent.pointerEnter(rowAt(container, 2))
    expect(hours?.index).toBeNull()
  })

  test('item rows: keys hold the items of the row and the live region names it', () => {
    const { getByRole, container } = render(<ByItems />)
    const list = getByRole('list', { name: 'Windows' })
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(hours?.span.map((d) => d.h)).toEqual([0, 1, 2])
    expect(liveOf(container)).toBe('early, 3')
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(hours?.span.map((d) => d.h)).toEqual([4, 5])
    expect(liveOf(container)).toBe('late, 2')
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(hours?.index).toBeNull()
    // a row that holds nothing clears the focus and still names itself
    expect(liveOf(container)).toBe('never, 0')
  })

  test('a list with neither arm draws no live region of its own', () => {
    const { container } = draw()
    expect(container.querySelector('[data-slot="bar-list-live"]')).toBeNull()
  })
})

describe('BarList mono', () => {
  test('mono draws every label in the mono face with tabular figures', () => {
    const { container } = draw({ mono: true })
    const labels = [...container.querySelectorAll('[data-slot="bar-list-label"]')]
    expect(labels.every((el) => el.classList.contains('font-mono'))).toBe(true)
    expect(labels.every((el) => el.classList.contains('tabular-nums'))).toBe(true)
  })

  test('without mono a label keeps the body face', () => {
    const { container } = draw()
    expect(
      container.querySelector('[data-slot="bar-list-label"]')?.classList.contains('font-mono'),
    ).toBe(false)
  })
})

describe('BarList legend, series and body rows', () => {
  const SERIES = [
    { key: 'work', label: 'Work', color: { light: 'red', dark: 'red' } },
    {
      key: 'hold',
      label: 'Hold',
      color: { light: 'blue', dark: 'blue' },
      swatch: 'hollow' as const,
    },
  ]
  const STACKED = [{ label: 'Attempt 1', value: 3, parts: { work: 2, hold: 1 } }]

  test('draws the series legend row with each entry in its own swatch shape', () => {
    const { container } = draw({ items: STACKED, series: SERIES })
    const swatches = [
      ...container.querySelectorAll('[data-slot="data-panel-legend"] [data-swatch]'),
    ]
    expect(swatches.map((s) => s.getAttribute('data-swatch'))).toEqual(['solid', 'hollow'])
  })

  test('legend={false} drops the legend row and keeps the stacked parts', () => {
    const { container } = draw({ items: STACKED, series: SERIES, legend: false })
    expect(container.querySelector('[data-slot="data-panel-legend"]')).toBeNull()
    expect(container.querySelectorAll('[data-slot="bar-list-segment"]')).toHaveLength(2)
  })

  const MONTHS = Array.from({ length: 12 }, (_, i) => ({ label: `M${i + 1}`, value: 12 - i }))
  const bodyOf = (root: ParentNode): HTMLElement =>
    root.querySelector('[data-slot="inset"]') as HTMLElement

  test('a body past ten rows holds every one of twelve, with no scroll cue', () => {
    const { container } = draw({ items: MONTHS, bodyRows: 12 })
    expect(bodyOf(container).style.height).toBe('calc(var(--spacing) * 126)')
    expect(container.querySelector('[data-slot="bar-list-scroll-cue"]')).toBeNull()
  })

  test('the default body holds five rows and says how many of twelve show', () => {
    const { container } = draw({ items: MONTHS })
    expect(bodyOf(container).style.height).toBe('calc(var(--spacing) * 56)')
    expect(container.querySelector('[data-slot="bar-list-scroll-cue"]')).not.toBeNull()
  })

  test('a count under three, a fraction or no number holds a whole count of at least three', () => {
    for (const [asked, steps] of [
      [2, 36],
      [7.6, 76],
      [Number.NaN, 56],
    ] as const) {
      cleanup()
      const { container } = draw({ bodyRows: asked })
      expect(bodyOf(container).style.height).toBe(`calc(var(--spacing) * ${steps})`)
    }
  })
})
