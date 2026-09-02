/**
 * `Section` — the tier-2 heading composer (docs/CONTROLS-SPEC.md §2.2): the collapse contract
 * (persisted vs local, header stays drawn, body unmounts, tabs hide), the scroll-anchor style, and
 * the two dev-only misuse warnings (the ≤3-actions budget, C6, and a persistKey with no fold), plus
 * the `className`/`classNames`/`style` contract from `common/props.ts`.
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactElement } from 'react'
import { resetValidatedProps } from '../common/validate'
import { FilterSetScope } from '../controls/filter-context'
import { Section } from './section'

function renderWith(node: ReactElement) {
  return render(<MantineProvider>{node}</MantineProvider>)
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('Section composes WidgetHeader at the section tier', () => {
  test('renders an h2 carrying the title, and data-tier="section", outside any filter surface', () => {
    renderWith(
      <Section title="Revenue">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Revenue' })).toBeDefined()
    // The Section ROOT, not WidgetHeader's — both carry `data-tier`, so walk up from the body.
    const root = screen.getByText('body').parentElement?.parentElement
    expect(root?.getAttribute('data-tier')).toBe('section')
  })

  test('resolves to the group tier — an h3 with data-tier="group" — on the aside panel surface', () => {
    renderWith(
      <FilterSetScope surface="panel" registry={null}>
        <Section title="Composition">
          <div>body</div>
        </Section>
      </FilterSetScope>,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Composition' })).toBeDefined()
    const root = screen.getByText('body').parentElement?.parentElement
    expect(root?.getAttribute('data-tier')).toBe('group')
  })

  test("also resolves to group on the aside's mobile sheet projection, not just the desktop panel", () => {
    renderWith(
      <FilterSetScope surface="sheet" registry={null}>
        <Section title="Composition">
          <div>body</div>
        </Section>
      </FilterSetScope>,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Composition' })).toBeDefined()
    const root = screen.getByText('body').parentElement?.parentElement
    expect(root?.getAttribute('data-tier')).toBe('group')
  })

  test('section.module.css quiets the group tier body gap to 0 (SR4 panel-row pitch)', () => {
    const css = readFileSync(join(import.meta.dir, 'section.module.css'), 'utf8')
    const start = css.indexOf("[data-tier='group'] .body {")
    expect(start).toBeGreaterThan(-1)
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toContain('gap: 0')
  })
})

describe('collapsible', () => {
  test('the header stays drawn when closed; only the body unmounts', () => {
    renderWith(
      <Section title="Usage" collapsible>
        <div>body content</div>
      </Section>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Usage' })).toBeDefined()
    expect(screen.getByText('body content')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse section' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Usage' })).toBeDefined()
    expect(screen.queryByText('body content')).toBeNull()
  })

  test('tabs hide while collapsed', () => {
    renderWith(
      <Section title="Usage" collapsible tabs={<div>the tabs</div>}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('the tabs')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse section' }))
    expect(screen.queryByText('the tabs')).toBeNull()
  })

  test('an unpersisted fold (no persistKey) does not touch localStorage', () => {
    renderWith(
      <Section title="Usage" collapsible>
        <div>body</div>
      </Section>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Collapse section' }))
    expect(window.localStorage.length).toBe(0)
  })

  test('persistKey persists the fold state under basalt:section:<key>', () => {
    renderWith(
      <Section title="Usage" collapsible persistKey="usage">
        <div>body</div>
      </Section>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Collapse section' }))

    const raw = window.localStorage.getItem('basalt:section:usage')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ value: false })
  })
})

describe('id — the scroll-anchor contract', () => {
  test('sets the id and a scrollMarginTop clearing both sticky bars', () => {
    const { container } = renderWith(
      <Section id="usage" title="Usage">
        <div>body</div>
      </Section>,
    )
    const root = container.querySelector('#usage')
    expect(root).not.toBeNull()
    const style = root?.getAttribute('style') ?? ''
    expect(style).toContain('scroll-margin-top')
    expect(style).toContain('--vx-space-sticky-header-clearance')
    // NEITHER shell region: the anchor scrolls inside `AppShell.Main`, and both the header and
    // `PageBar` row 2's band are rendered outside that scrollport — counting either lands every
    // anchor that far below its own heading.
    expect(style).not.toContain('--app-shell-header-height')
    expect(style).not.toContain('--basalt-page-bar-h')
  })

  test('omitting id sets neither an id nor the anchor style', () => {
    const { container } = renderWith(
      <Section title="Usage">
        <div>body</div>
      </Section>,
    )
    const root = container.firstElementChild
    expect(root?.id).toBe('')
    expect(root?.getAttribute('style')).toBeNull()
  })
})

/**
 * The two dev-only misuse warnings, both on `useValidateProps` — so both print through
 * `console.error`, not `console.warn`, and both dedup on `${component} ${message}` in MODULE state
 * that outlives a render, a remount and this file. `resetValidatedProps()` between cases is what
 * keeps each test's expectation about its own render rather than about test order.
 *
 * Relies on the default test-runner NODE_ENV being non-production (`isDev()` true), matching
 * `data/data-table.test.tsx`'s manualPagination dev-throw tests — no explicit env override needed.
 */
describe('the dev-only misuse warnings', () => {
  beforeEach(() => {
    resetValidatedProps()
  })

  // `Children.count` (like every `Children.*` helper) does not recurse into a Fragment passed as
  // a single node — an ARRAY of actions is what the count actually sees, same shape a consumer
  // building the list programmatically would pass.
  test('4 actions warns (C6)', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    renderWith(
      <Section
        title="Usage"
        actions={[1, 2, 3, 4].map((n) => (
          <button key={n} type="button">
            {n}
          </button>
        ))}
      >
        <div>body</div>
      </Section>,
    )
    expect(error).toHaveBeenCalledTimes(1)
    expect(String(error.mock.calls[0]?.[0])).toContain('≤3 budget')
    error.mockRestore()
  })

  test('3 actions does not warn', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    renderWith(
      <Section
        title="Usage"
        actions={[1, 2, 3].map((n) => (
          <button key={n} type="button">
            {n}
          </button>
        ))}
      >
        <div>body</div>
      </Section>,
    )
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  test('a persistKey with no collapsible names the section and both props', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    renderWith(
      <Section title="Usage" persistKey="usage">
        <div>body</div>
      </Section>,
    )
    expect(error).toHaveBeenCalledTimes(1)
    expect(String(error.mock.calls[0]?.[0])).toBe(
      '[basalt] Section "Usage": `persistKey` is set but `collapsible` is false — there is no ' +
        'fold to persist. Add `collapsible`, or drop `persistKey`.',
    )
    error.mockRestore()
  })

  test('a persistKey WITH collapsible says nothing', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    renderWith(
      <Section title="Usage" persistKey="usage" collapsible>
        <div>body</div>
      </Section>,
    )
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})

/**
 * `className` + the three slots (`common/props.ts`). A CSS module resolves to `''` under
 * `bun test`, so each box is found by the class the CALLER passed, and the anchor style is what
 * proves the merge ORDER: `style` merges OVER `Section`'s own `scroll-margin-top`, never replaces
 * it, or a consumer setting one margin silently loses the anchor offset.
 */
/** `MantineProvider` prepends its own `<style>` nodes, so `container.firstElementChild` is one of
 *  THOSE, not the section — `[data-tier]` is the root's own marker and the only honest handle. */
function sectionRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector('[data-tier]')
  if (!(root instanceof HTMLElement)) throw new Error('expected a Section root')
  return root
}

describe('className, classNames and the style merge order', () => {
  test('classNames reach root, header and body, alongside className', () => {
    const { container } = renderWith(
      <Section
        title="Revenue"
        className="my-section"
        classNames={{ root: 'slot-root', header: 'slot-header', body: 'slot-body' }}
      >
        <div>body</div>
      </Section>,
    )
    const root = sectionRoot(container)
    expect(root.classList.contains('my-section')).toBe(true)
    expect(root.classList.contains('slot-root')).toBe(true)
    expect(root.querySelector('.slot-header')).not.toBeNull()
    expect(root.querySelector('.slot-body')?.textContent).toBe('body')
  })

  test("the caller's style merges over the anchor offset, and neither drops the other", () => {
    const { container } = renderWith(
      <Section title="Revenue" id="revenue" style={{ marginTop: '3px' }}>
        <div>body</div>
      </Section>,
    )
    const style = sectionRoot(container).getAttribute('style') ?? ''
    expect(style).toContain('margin-top: 3px')
    expect(style).toContain('--vx-space-sticky-header-clearance')
  })

  test('a caller-set scrollMarginTop WINS — the merge order is anchor first, caller last', () => {
    const { container } = renderWith(
      <Section title="Revenue" id="revenue" style={{ scrollMarginTop: '9px' }}>
        <div>body</div>
      </Section>,
    )
    const style = sectionRoot(container).getAttribute('style') ?? ''
    expect(style).toContain('scroll-margin-top: 9px')
    expect(style).not.toContain('--basalt-page-bar-h')
  })
})

describe('defaultOpen', () => {
  test('defaultOpen={false} opens collapsed, and the chevron still expands it', () => {
    renderWith(
      <Section title="Usage" collapsible defaultOpen={false}>
        <div>body content</div>
      </Section>,
    )
    expect(screen.queryByText('body content')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Expand section' }))
    expect(screen.getByText('body content')).toBeDefined()
  })

  test('a persisted value outranks it — a section the reader opened stays open', () => {
    window.localStorage.setItem('basalt:section:usage', JSON.stringify({ v: 1, value: true }))
    renderWith(
      <Section title="Usage" collapsible persistKey="usage" defaultOpen={false}>
        <div>body content</div>
      </Section>,
    )
    expect(screen.getByText('body content')).toBeDefined()
  })
})

describe('summary — visible collapsed or not', () => {
  test('a collapsed section still states its headline figures', () => {
    renderWith(
      <Section title="Usage" collapsible summary={<span>48,204 requests</span>}>
        <div>body content</div>
      </Section>,
    )
    expect(screen.getByText('48,204 requests')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse section' }))

    expect(screen.queryByText('body content')).toBeNull()
    expect(screen.getByText('48,204 requests')).toBeDefined()
  })

  test('it renders under the header, above where the body starts', () => {
    renderWith(
      <Section title="Usage" summary={<span>48,204 requests</span>}>
        <div>body content</div>
      </Section>,
    )
    const summary = screen.getByText('48,204 requests').parentElement
    expect(
      summary?.previousElementSibling?.contains(screen.getByRole('heading', { level: 2 })),
    ).toBe(true)
    expect(summary?.nextElementSibling?.contains(screen.getByText('body content'))).toBe(true)
  })
})

// A rest-spread bug in `section.tsx` silently dropped `unit`/`deltaPolarity`/`deltaFormat`/
// `deltaGlyph` even though `SectionProps` type-checked them — nothing rendered, nothing errored.
// Every `WidgetHeaderProps` key `SectionProps` admits must reach the composed `WidgetHeader`.
describe('forwards every WidgetHeader prop (unit, deltaPolarity, deltaFormat, deltaGlyph)', () => {
  test('unit renders beside value', () => {
    renderWith(
      <Section title="Load" value="412" unit="TSS">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('TSS')).toBeDefined()
  })

  test('deltaPolarity="up-bad" renders a positive delta with the bad tone', () => {
    renderWith(
      <Section title="Load" delta={12.4} deltaPolarity="up-bad">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('12.4%').style.color).toBe('var(--vx-status-bad)')
  })

  test('deltaFormat overrides the default percentage label', () => {
    renderWith(
      <Section title="Pace" delta={-12} deltaFormat={(v) => `${Math.abs(v)}ms`}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('12ms')).toBeDefined()
    expect(screen.queryByText('12.0%')).toBeNull()
  })

  test('deltaGlyph={false} suppresses the glyph', () => {
    renderWith(
      <Section title="Load" delta={12.4} deltaGlyph={false}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('12.4%')).toBeDefined()
    expect(screen.queryByText('▲')).toBeNull()
  })

  test('icon renders in the heading via the icon slot', () => {
    renderWith(
      <Section title="Load" icon={<svg data-testid="load-icon" />}>
        <div>body</div>
      </Section>,
    )
    const icon = screen.getByTestId('load-icon')
    expect(icon.closest('[data-basalt-icon]')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Load' }).contains(icon)).toBe(true)
  })

  test('subtitle renders below the title row', () => {
    renderWith(
      <Section title="Load" subtitle="7-day rolling">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('7-day rolling')).toBeDefined()
  })

  test('info renders the "More information" glyph beside the heading', () => {
    renderWith(
      <Section title="Load" info="Training stress score.">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByRole('button', { name: 'More information' })).toBeDefined()
  })

  test('deltaPeriod renders alongside the delta chip', () => {
    renderWith(
      <Section title="Load" delta={4.2} deltaPeriod="MoM">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('4.2%')).toBeDefined()
    expect(screen.getByText('MoM')).toBeDefined()
  })

  test('sparkline renders below the metric row', () => {
    renderWith(
      <Section title="Load" sparkline={<span data-testid="load-spark">trend</span>}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByTestId('load-spark')).toBeDefined()
  })

  test('count renders a mono tag after the title', () => {
    renderWith(
      <Section title="Orders" count={42}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('42')).toBeDefined()
  })
})

/**
 * `query` — law C3's uniform container contract on a `Section` (components audit #3). The four
 * branches, and the invariant that makes it a CONTAINER prop rather than a wrapper: the header, the
 * chevron and `summary` stay drawn through every one of them, so a section never vanishes off the
 * page mid-refetch.
 */
function query(over: Partial<Record<string, unknown>> = {}) {
  return {
    data: undefined as unknown,
    isError: false,
    error: null as unknown,
    fetchStatus: 'idle' as 'fetching' | 'paused' | 'idle',
    refetch: () => undefined,
    ...over,
  }
}

describe('query — the four container states', () => {
  test('pending replaces the body with a spinner, and keeps the header drawn', () => {
    renderWith(
      <Section title="Runs" query={query({ fetchStatus: 'fetching' })}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Runs' })).toBeDefined()
    expect(screen.queryByText('body')).toBeNull()
    expect(screen.getByLabelText('Loading')).toBeDefined()
  })

  test('error replaces the body with the SERVER message and a retry, header still drawn', () => {
    const refetch = mock(() => undefined)
    renderWith(
      <Section
        title="Runs"
        summary={<span>summary row</span>}
        query={query({ isError: true, error: new Error('upstream exploded'), refetch })}
      >
        <div>body</div>
      </Section>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Runs' })).toBeDefined()
    expect(screen.getByText('summary row')).toBeDefined()
    expect(screen.queryByText('body')).toBeNull()
    expect(screen.getByText('upstream exploded')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  test('empty replaces the body with the `empty` copy — never with a false error', () => {
    renderWith(
      <Section title="Runs" query={query({ data: [] })} empty={{ title: 'No runs yet' }}>
        <div>body</div>
      </Section>,
    )
    expect(screen.queryByText('body')).toBeNull()
    expect(screen.getByText('No runs yet')).toBeDefined()
  })

  test('data renders children', () => {
    renderWith(
      <Section title="Runs" query={query({ data: [1, 2] })}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('body')).toBeDefined()
  })

  test('no `query` renders children untouched — the prop is opt-in', () => {
    renderWith(
      <Section title="Runs">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('body')).toBeDefined()
  })
})

/**
 * `actions` as typed data (law C15). The point is not that the buttons render — a `ReactNode` row
 * did that already — but that basalt owns the C7 fold and the mobile kebab once the caller hands it
 * data instead of nodes.
 */
describe('actions — the BarAction[] | ReactNode union', () => {
  test('a BarAction[] folds past 3 into More, inside the header', () => {
    renderWith(
      <Section
        title="Runs"
        actions={[
          { key: 'a', label: 'Alpha' },
          { key: 'b', label: 'Bravo' },
          { key: 'c', label: 'Charlie' },
          { key: 'd', label: 'Delta' },
        ]}
      >
        <div>body</div>
      </Section>,
    )
    const desktop = document.querySelector('.mantine-visible-from-sm')
    if (!desktop) throw new Error('expected the desktop action group')
    expect(desktop.textContent).toContain('Alpha')
    expect(desktop.textContent).not.toContain('Delta')
    expect(desktop.textContent).toContain('More')
  })

  test('a BarAction runs its onClick', () => {
    const onClick = mock(() => undefined)
    renderWith(
      <Section title="Runs" actions={[{ key: 'export', label: 'Export', onClick }]}>
        <div>body</div>
      </Section>,
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Export' })[0] as HTMLElement)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('a ReactNode row is unchanged — rendered verbatim, no group around it', () => {
    renderWith(
      <Section title="Runs" actions={<button type="button">Export</button>}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByRole('button', { name: 'Export' })).toBeDefined()
    expect(document.querySelector('.mantine-visible-from-sm')).toBeNull()
  })

  test('the C6 budget counts the ARRAY exactly, not as one child', () => {
    resetValidatedProps()
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    renderWith(
      <Section
        title="Overbudget"
        actions={[
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
          { key: 'c', label: 'C' },
          { key: 'd', label: 'D' },
        ]}
      >
        <div>body</div>
      </Section>,
    )
    expect(spy.mock.calls.flat().join(' ')).toContain('4 actions exceeds the ≤3 budget')
    spy.mockRestore()
  })
})
