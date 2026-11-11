import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { FrameState } from '../core/phase'
import { DataPanel } from './data-panel'
import { StatCell } from './stat-cell'
import type { StatCellProps } from './stat-cell'
import { StatGroup } from './stat-group'

afterEach(cleanup)

const PHASES = ['ready', 'loading', 'stale', 'error', 'empty'] as const
type Probe = (typeof PHASES)[number]

const phaseProps = (probe: Probe): FrameState => {
  if (probe === 'loading' || probe === 'stale') return { phase: probe }
  if (probe === 'error') return { phase: { tag: 'error', retry: () => undefined } }
  if (probe === 'empty') return { empty: { cause: 'No readings yet' } }
  return {}
}

const row = { label: 'HRV', value: '64 ms' }
const row2 = { label: 'Resting', value: '48 bpm' }

const cellProps = (probe: Probe, chart: NonNullable<StatCellProps['chart']>): StatCellProps => ({
  label: 'Recovery',
  value: 82,
  meter: { label: 'Recovery', value: 82, max: 100 },
  chart,
  rows: [row, row2],
  sub: 'Updated 6:40',
  ...phaseProps(probe),
})

/** The tracks a cell draws, as the grid rows its parts sit in. */
const tracksOf = (root: ParentNode): string[] =>
  [...root.querySelectorAll<HTMLElement>('[data-slot^="stat-"]')]
    .map((el) => el.className.match(/row-start-(\d)/)?.[1] ?? '')
    .filter(Boolean)
    .toSorted()

describe('StatCell phase matrix', () => {
  test('every phase prints its own data-phase', () => {
    for (const probe of PHASES) {
      const { container } = render(<StatCell {...cellProps(probe, () => null)} />)
      expect(container.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe(probe)
      cleanup()
    }
  })

  test('every phase reserves the same declared tracks, so the height holds', () => {
    const ready = render(<StatCell {...cellProps('ready', () => null)} />)
    const expected = tracksOf(ready.container).filter((t, i, all) => all.indexOf(t) === i)
    expect(expected).toEqual(['1', '2', '3', '4', '5', '6', '9'])
    cleanup()
    for (const probe of PHASES) {
      const { container } = render(<StatCell {...cellProps(probe, () => null)} />)
      const got = tracksOf(container).filter((t, i, all) => all.indexOf(t) === i)
      expect(got, probe).toEqual(expected)
      cleanup()
    }
  })

  test('the chart slot is called only in ready and stale', () => {
    for (const probe of PHASES) {
      const chart = mock(() => <svg />)
      render(<StatCell {...cellProps(probe, chart)} />)
      expect(chart.mock.calls.length, probe).toBe(probe === 'ready' || probe === 'stale' ? 1 : 0)
      cleanup()
    }
  })

  test('the chart slot gets a 28 px box and the stale phase', () => {
    const chart = mock((box: { height: number | 'fill'; phase: string }) => <i>{box.phase}</i>)
    render(<StatCell {...cellProps('stale', chart)} />)
    expect(chart.mock.calls[0]?.[0]).toEqual({ height: 28, phase: 'stale' })
  })

  test('a throwing chart slot renders a retry in its own track and spares the figure', () => {
    const error = mock(() => undefined)
    const original = console.error
    console.error = error
    let throws = true
    const chart = (): ReactElement => {
      if (throws) throw new Error('boom')
      return <svg data-testid="plot" />
    }
    const { container, getByRole, getByTestId } = render(
      <StatCell {...cellProps('ready', chart)} />,
    )
    console.error = original
    expect(container.querySelector('[data-slot="stat-chart"] [role="alert"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="stat-figure"]')?.textContent).toBe('82')
    throws = false
    fireEvent.click(getByRole('button', { name: 'Retry' }))
    expect(getByTestId('plot')).toBeTruthy()
  })

  test('both error kinds print their own sentence; forbidden never retries', () => {
    const forbidden = render(
      <StatCell
        label="Recovery"
        phase={{ tag: 'error', kind: 'forbidden', retry: () => undefined }}
      />,
    )
    expect(forbidden.getByText('You do not have access to this.')).toBeTruthy()
    expect(forbidden.queryByRole('button', { name: 'Retry' })).toBeNull()
    cleanup()
    const missing = render(
      <StatCell
        label="Recovery"
        phase={{ tag: 'error', kind: 'not-found', retry: () => undefined }}
      />,
    )
    expect(missing.getByText('This no longer exists.')).toBeTruthy()
    expect(missing.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  test('an error runs its retry', () => {
    const retry = mock(() => undefined)
    const { getByRole } = render(<StatCell label="Recovery" phase={{ tag: 'error', retry }} />)
    fireEvent.click(getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  test('empty.cause spans the meter, chart and row tracks when the cell declares them', () => {
    const { container } = render(<StatCell {...cellProps('empty', () => null)} />)
    const span = container.querySelector('[data-slot="stat-empty"]')
    expect(span?.className).toContain('row-start-3')
    expect(span?.className).toContain('row-end-9')
    expect(span?.textContent).toContain('No readings yet')
  })

  test('empty.cause takes the figure track of a cell that declares nothing else', () => {
    const { container, getByText } = render(
      <StatCell label="Recovery" empty={{ cause: 'No readings yet' }} />,
    )
    expect(container.querySelector('[data-slot="stat-empty"]')).toBeNull()
    expect(container.querySelector('[data-slot="stat-figure"]')?.textContent).toContain(
      'No readings yet',
    )
    expect(getByText('No readings yet')).toBeTruthy()
  })

  test('a filtered empty offers Clear filters', () => {
    const reset = mock(() => undefined)
    const { getByRole } = render(
      <StatCell label="Recovery" empty={{ cause: 'No match', filtered: { reset } }} />,
    )
    fireEvent.click(getByRole('button', { name: 'Clear filters' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  test('loading is aria-busy and draws no figure text', () => {
    const { container } = render(<StatCell {...cellProps('loading', () => null)} />)
    const cell = container.querySelector('[data-phase]')
    expect(cell?.getAttribute('aria-busy')).toBe('true')
    expect(container.textContent).not.toContain('82')
  })

  test('a null value is a dash, never zero', () => {
    const { container } = render(<StatCell label="Sleep" value={null} />)
    expect(container.querySelector('[data-slot="stat-figure"]')?.textContent).toBe('–')
  })

  test('srText names the cell for assistive tech and hides the drawn figures', () => {
    const { container } = render(
      <StatCell label="Recovery" value={82} srText="Recovery 82 percent, optimal" />,
    )
    expect(container.querySelector('.sr-only')?.textContent).toBe('Recovery 82 percent, optimal')
    expect(container.querySelector('[data-slot="stat-figure"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  test('a cell is a link, a button or inert', () => {
    const link = render(<StatCell label="Recovery" href="/r" />)
    expect(link.container.querySelectorAll('a[data-slot="stat-target"]')).toHaveLength(1)
    expect(link.container.querySelectorAll('button[data-slot="stat-target"]')).toHaveLength(0)
    cleanup()
    const onSelect = mock(() => undefined)
    const button = render(<StatCell label="Recovery" onSelect={onSelect} />)
    fireEvent.click(button.container.querySelector('button[data-slot="stat-target"]')!)
    expect(onSelect).toHaveBeenCalledTimes(1)
    cleanup()
    const inert = render(<StatCell label="Recovery" />)
    expect(inert.container.querySelector('[data-slot="stat-target"]')).toBeNull()
  })

  test('the stale phase announces itself and still draws the figure', () => {
    const { container } = render(<StatCell {...cellProps('stale', () => null)} />)
    expect(container.querySelector('output')?.textContent).toBe('Updating')
    expect(container.querySelector('[data-slot="stat-figure"]')?.textContent).toBe('82')
  })

  test('a cards group keeps data-slot stat-cell on one element per cell, as a card surface', () => {
    const { container } = render(
      <StatGroup variant="cards">
        <StatCell label="A" value={1} />
        <StatCell label="B" value={2} />
      </StatGroup>,
    )
    const cells = container.querySelectorAll('[data-slot="stat-cell"]')
    expect(cells).toHaveLength(2)
    for (const cell of cells) expect(cell.getAttribute('data-surface')).toBe('card')
  })

  test('inside a group the cell is a subgrid spanning every track', () => {
    const { container } = render(
      <StatGroup variant="strip">
        <StatCell label="A" value={1} />
        <StatCell label="B" value={2} />
      </StatGroup>,
    )
    const cells = container.querySelectorAll('[data-phase]')
    expect(cells).toHaveLength(2)
    for (const cell of cells) {
      expect(cell.className).toContain('row-span-9')
      expect(cell.className).toContain('grid-rows-subgrid')
    }
  })
})

describe('DataPanel phase matrix', () => {
  const panel = (probe: Probe, body: () => ReactElement | null): ReactElement => (
    <DataPanel
      title="Open pull requests"
      skeleton={{ rows: 6 }}
      body={body}
      {...phaseProps(probe)}
    />
  )

  test('every phase prints its own data-phase inside one fixed-height box', () => {
    for (const probe of PHASES) {
      const { container } = render(panel(probe, () => <p>rows</p>))
      const box = container.querySelector<HTMLElement>('[data-slot="card-phase"]')
      expect(box?.getAttribute('data-phase')).toBe(probe)
      expect(box?.style.height, probe).toBe('232px')
      cleanup()
    }
  })

  test('the body slot is called only in ready and stale', () => {
    for (const probe of PHASES) {
      const body = mock(() => <p>rows</p>)
      render(panel(probe, body))
      expect(body.mock.calls.length, probe).toBe(probe === 'ready' || probe === 'stale' ? 1 : 0)
      cleanup()
    }
  })

  test('the body gets the declared height and the stale phase', () => {
    const body = mock((_box: { height: number | 'fill'; phase: string }) => <p>rows</p>)
    render(<DataPanel title="Board" skeleton={{ height: 240 }} phase="stale" body={body} />)
    expect(body.mock.calls[0]?.[0]).toEqual({ height: 240, phase: 'stale' })
  })

  test('a height under the phase arms floor is raised to it', () => {
    const { container } = render(
      <DataPanel title="Board" skeleton={{ rows: 1 }} body={() => null} />,
    )
    expect(container.querySelector<HTMLElement>('[data-slot="card-phase"]')?.style.height).toBe(
      '96px',
    )
  })

  test('a throwing body renders the error arm and keeps the header', () => {
    const original = console.error
    console.error = () => undefined
    const { container, getByText } = render(
      panel('ready', () => {
        throw new Error('boom')
      }),
    )
    console.error = original
    expect(container.querySelector('[data-phase="error"]')).toBeTruthy()
    expect(getByText('Open pull requests')).toBeTruthy()
  })

  test('both error kinds draw their own sentence', () => {
    const forbidden = render(
      <DataPanel
        title="Open"
        skeleton={{ rows: 3 }}
        body={() => null}
        phase={{ tag: 'error', kind: 'forbidden' }}
      />,
    )
    expect(forbidden.getByText('You do not have access to this.')).toBeTruthy()
    cleanup()
    const missing = render(
      <DataPanel
        title="Open"
        skeleton={{ rows: 3 }}
        body={() => null}
        phase={{ tag: 'error', kind: 'not-found' }}
      />,
    )
    expect(missing.getByText('This no longer exists.')).toBeTruthy()
  })

  test('the loading skeleton draws the declared rows', () => {
    const { container } = render(
      <DataPanel title="Open" skeleton={{ rows: 6 }} phase="loading" body={() => null} />,
    )
    expect(container.querySelectorAll('[data-slot="card-phase"] > div > div')).toHaveLength(6)
  })

  test('controls, toolbar, menu and legend render once, in their own slots', () => {
    const slot = (
      text: string,
    ): { kind: 'controls-slot'; count: number; render: () => ReactElement } => ({
      kind: 'controls-slot',
      count: 1,
      render: () => <button type="button">{text}</button>,
    })
    const { container, getAllByText } = render(
      <DataPanel
        title="Open"
        skeleton={{ rows: 3 }}
        controls={slot('Range')}
        toolbar={slot('Filter')}
        menu={() => <button type="button">More</button>}
        legend={[
          { key: 'a', label: 'Merged', color: { light: '#111111', dark: '#eeeeee' } },
          { key: 'b', label: 'Closed', color: { light: '#111111', dark: '#eeeeee' }, failed: true },
        ]}
        body={() => null}
      />,
    )
    expect(getAllByText('Range')).toHaveLength(1)
    expect(container.querySelector('[data-slot="data-panel-toolbar"]')?.textContent).toBe('Filter')
    expect(container.querySelector('[data-slot="data-panel-menu"]')?.textContent).toBe('More')
    expect(container.querySelector('[data-slot="data-panel-legend"]')?.textContent).toContain(
      'Closed (unavailable)',
    )
  })

  test('a throwing menu slot renders nothing and keeps the header and body', () => {
    const original = console.error
    console.error = () => undefined
    const { container, getByText } = render(
      <DataPanel
        title="Open pull requests"
        skeleton={{ rows: 3 }}
        menu={() => {
          throw new Error('boom')
        }}
        body={() => <p>rows</p>}
      />,
    )
    console.error = original
    expect(container.querySelector('[data-slot="data-panel-menu"]')?.textContent).toBe('')
    expect(getByText('Open pull requests')).toBeTruthy()
    expect(getByText('rows')).toBeTruthy()
  })

  test('the body clips with overflow clip, never hidden', () => {
    const { container } = render(panel('ready', () => <p>rows</p>))
    const box = container.querySelector('[data-slot="card-phase"]')
    expect(box?.className).toContain('overflow-clip')
    expect(box?.className).not.toContain('overflow-hidden')
  })
})
