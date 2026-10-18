import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps, ReactElement } from 'react'
import { ThreadFeedRow } from '../../../src/agent'
import type { AgentThread, ChatMessage, TranscriptPart } from '../../../src/agent'
import { ThreadTranscript } from '../../../src/agent/chat/thread-message'
import { rect } from '@tanstack/charts/rect'
import { ruleY } from '@tanstack/charts/rule'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleUtc } from 'd3-scale'
import {
  BandStrip,
  MirroredBars,
  Bars,
  CartesianChart,
  ChartCard,
  DualPanel,
  Lines,
  Sparkline,
} from '../../../src/charts'
import { PanelRung, chartHeightOf, paneX, paneY } from '../../../src/charts/panel'
import type { PaneBuilder, PaneContext, PanelInput, PanelPlan } from '../../../src/charts/panel'
import { plotContext } from '../../../src/charts/plot-context'
import { xScaleFor } from '../../../src/charts/scales'
import type { ChartMarks } from '../../../src/charts/types'
import { resolveContainerClass } from '../../../src/tokens/size-classes'
import type { BandStripSeries, BarsBar, ChartSeries } from '../../../src/charts'
import { overlays } from '../../../src/commands'
import { FilterSet, FormRow, SelectFilter, ViewTabs } from '../../../src/controls'
import { BasaltDataTable } from '../../../src/table'
import type { DataTableFacet } from '../../../src/table/data-table'
import type { BasaltColumnDef } from '../../../src/table/table-features'
import { Prose } from '../../../src/content'
import { CodeBlock } from '../../../src/content/code-block'
import { ActionIcon, Badge, Button, Card, Paper } from '@mantine/core'
import {
  BarList,
  Meter,
  PageAside,
  PageBar,
  Section,
  StatCard,
  StatGroup,
  StatusVerdict,
} from '../../../src/index'
import { ShellFrame } from '../../../src/shell'
import type { SettingsMenuItem } from '../../../src/index'
import type { GlobalAction } from '../../../src/controls'
import type { PageBarActions } from '../../../src/controls/actions'
import type { BasaltAccountProps } from '../../../src/shell/account-types'
import type {
  ActiveCrumb,
  NavAnchor,
  SidebarItem,
  SidebarSection,
} from '../../../src/shell/nav-types'
import { TableOfContents } from '../../../src/content/toc'
import { createLocalStore, field } from '../../../src/state'
import type {
  AgentSpec,
  AsideSpec,
  TocSpec,
  BarSpec,
  CardsSpec,
  ChartsSpec,
  FixtureSpec,
  FormsSpec,
  ItemSpec,
  TableSpec,
} from './spec'
import { InfoRingFixture } from './info-ring-fixture'
import { RetryParityFixture } from './retry-parity-fixture'
import { RAIL_DOMAIN_MAX, RAIL_PX, TOC_SCROLL_MARGIN_PX } from './spec'

/** A consumer-sized (18px) glyph — the bar normalizes it to `--vx-space-mobile-nav-icon-size` in
 *  CSS, which is part of what the geometry assertions cover. */
function Glyph(): ReactElement {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
      <circle cx={12} cy={12} r={8} fill="currentColor" />
    </svg>
  )
}

/**
 * Stands in for the consumer's router `Link`, and is built PER PATH because that is what a real
 * one is: `BasaltShell` passes an `Anchor` only chrome props (className, aria-*, onClick) and
 * never the item's `href` — the router seam assumes the Link closes over its own destination.
 * Memoized so the component identity survives a remount and React does not tear the tree down.
 *
 * VERIFIED THE HARD WAY: a version that spread `props` and read `props.href` recorded `""` on
 * every tap, because that href never arrives. Invariant 3 would have passed vacuously.
 *
 * The handler composes the caller's FIRST and returns early when `defaultPrevented`, verbatim
 * @tanstack/react-router semantics — which is what the "re-tap the active slot scrolls instead of
 * navigating" rule depends on. Recording the path is what lets a test assert the tap REACHED the
 * page as well as raised nothing.
 */
const anchors = new Map<string, NavAnchor>()

function anchorFor(path: string): NavAnchor {
  const cached = anchors.get(path)
  if (cached) return cached
  const Anchor: NavAnchor = (props) => (
    // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the shell supplies children and keyboard semantics through `props`; oxlint cannot see them through the spread
    <a
      {...props}
      href={path}
      onClick={(event) => {
        props.onClick?.(event)
        if (event.defaultPrevented) return
        event.preventDefault()
        window.basaltNavigations.push(path)
      }}
    />
  )
  anchors.set(path, Anchor)
  return Anchor
}

const toItem = (spec: ItemSpec, icons: boolean): SidebarItem => ({
  key: spec.key,
  label: spec.label,
  // `icon` is a REQUIRED field carrying a `ReactNode`, so an icon-less consumer passes
  // `undefined` — exactly what `useNav` produces for an item that omits it (image-share's real
  // shape). Dropping the key entirely would not type-check and is not the configuration.
  icon: icons ? <Glyph /> : undefined,
  href: `/${spec.key}`,
  Anchor: anchorFor(`/${spec.key}`),
  ...(spec.short !== undefined && { short: spec.short }),
  ...(spec.mobile !== undefined && { mobile: spec.mobile }),
  ...(spec.active !== undefined && { active: spec.active }),
  ...(spec.disabled !== undefined && { disabled: spec.disabled }),
  ...(spec.count !== undefined && { count: spec.count }),
  ...(spec.children !== undefined && {
    children: spec.children.map((child) => toItem(child, icons)),
  }),
})

// ── The data table ────────────────────────────────────────────────────────────────────────────

type TableRow = { id: number; name: string; value: number }

/**
 * Plain accessor columns — the sticky invariant is the header's POSITION, not what a cell renders.
 * `spec.columns` widens the set for the overflow guard: cell text is deliberately unbreakable
 * (`Row 1 · segment 3` has no wrap opportunity a narrow column could take), because a table that
 * CAN reflow proves nothing about containment.
 */
function tableColumns(count: number, badges: boolean): BasaltColumnDef<TableRow>[] {
  const base: BasaltColumnDef<TableRow>[] = badges
    ? [
        {
          id: 'summary',
          header: 'Summary',
          accessorFn: (row: TableRow) =>
            `Row ${row.id + 1} is a long breakable description that wants every pixel it can get`,
        },
        { id: 'state', header: 'State', cell: () => <Badge>WORKING</Badge> },
      ]
    : [
        { accessorKey: 'name', header: 'Name' },
        { accessorKey: 'value', header: 'Value' },
      ]
  for (let i = base.length; i < count; i++) {
    base.push({
      id: `col${i}`,
      header: `Column ${i + 1}`,
      accessorFn: (row: TableRow) => `value-${row.id}-${i}`,
    })
  }
  return base
}

const tableRows = (n: number): TableRow[] =>
  Array.from({ length: n }, (_, i) => ({ id: i, name: `Row ${i + 1}`, value: i * 3 }))

/**
 * The toolbar's facets — real `EnumFilter` pills over the generated columns, with the long option
 * labels a production facet carries. A facet whose options were `a`/`b` would make the pill row
 * narrow enough to fit anywhere, which is the opposite of what the overflow guard needs to see.
 */
function tableFacets(count: number): DataTableFacet<TableRow>[] {
  const all: DataTableFacet<TableRow>[] = [
    {
      columnId: 'name',
      label: 'Department',
      options: [
        { value: 'Row 1', label: 'Engineering' },
        { value: 'Row 2', label: 'Customer success' },
      ],
    },
    {
      columnId: 'value',
      label: 'Role',
      options: [
        { value: '0', label: 'Individual contributor' },
        { value: '3', label: 'Engineering manager' },
      ],
    },
  ]
  return all.slice(0, count)
}

/**
 * The REAL `BasaltDataTable`, mounted with the props a consumer pairs on a scrolling body. The
 * page-level `stickyHeaderOffset` is passed on purpose: it is the prop that used to reach Mantine
 * and park the `<thead>` mid-body.
 *
 * `title` rides along with the toolbar because the two share the header row: the toolbar is a flex
 * item BESIDE the title, and it was that item's `flex: 0 0 auto` (no shrink) that let a 461px
 * search-plus-pills row sit in a 302px column and widen the page.
 */
function TableFixture({ spec }: { spec: TableSpec }): ReactElement {
  const facets = tableFacets(spec.facets ?? 0)
  return (
    <BasaltDataTable
      data={tableRows(spec.rows)}
      columns={tableColumns(spec.columns ?? 2, spec.badges === true)}
      stickyHeader={spec.stickyHeader ?? true}
      {...(spec.maxHeight !== undefined && { maxHeight: spec.maxHeight })}
      {...(spec.minWidth !== undefined && { minWidth: spec.minWidth })}
      {...(spec.stickyHeaderOffset !== undefined && {
        stickyHeaderOffset: spec.stickyHeaderOffset,
      })}
      {...(spec.search === true && { enableGlobalFilter: true, title: 'Projects' })}
      {...(facets.length > 0 && { facets })}
    />
  )
}

// ── The page bar, with real controls ──────────────────────────────────────────────────────────

/**
 * ONE store at module scope, not per mount: `createLocalStore` is a per-key FACTORY and a fresh one
 * on every render would re-subscribe every bound control (the same memo law `BasaltShell` documents
 * for `collapseStore`). Long option labels on purpose — a pill is as wide as its longest word, and
 * a bar of narrow pills cannot demonstrate law C7's fold.
 */
const BAR_VALUES = ['organic-search', 'paid-social', 'referral-traffic', 'direct-sessions'] as const
const BAR_LABELS: Record<string, string> = {
  'organic-search': 'Organic search',
  'paid-social': 'Paid social',
  'referral-traffic': 'Referral traffic',
  'direct-sessions': 'Direct sessions',
}

const barStore = createLocalStore({
  key: 'layout-fixture-bar',
  fields: {
    f0: field.enum(BAR_VALUES, 'organic-search'),
    f1: field.enum(BAR_VALUES, 'paid-social'),
    f2: field.enum(BAR_VALUES, 'referral-traffic'),
    f3: field.enum(BAR_VALUES, 'direct-sessions'),
  },
}).labels({ f0: BAR_LABELS, f1: BAR_LABELS, f2: BAR_LABELS, f3: BAR_LABELS })

const BAR_FIELD_KEYS = ['f0', 'f1', 'f2', 'f3'] as const

/** Production-length row-1 action labels — see `BarFixture` for why they ride `actionIcons`. */
const BAR_ACTION_LABELS = ['New report', 'Export CSV', 'Schedule', 'Share'] as const

function BarFixture({ spec }: { spec: BarSpec }): ReactElement {
  const pills = BAR_FIELD_KEYS.slice(0, Math.min(spec.pills ?? 0, BAR_FIELD_KEYS.length))
  const tabCount = Math.min(spec.tabs ?? 0, BAR_VALUES.length)
  const actions = Array.from({ length: spec.actions ?? 0 }, (_, i) => ({
    key: `a${i}`,
    // The production LABEL rides with the icon, and deliberately not on its own: a labelled `ctl`
    // button is its icon slot + label + insets, so the label's own advance is most of the width the
    // `md` fold gives back, and a desktop row of `Action 1`s would fit at a width no real row fits
    // at. Keeping both behind the one flag also leaves every phone sweep written before this
    // measuring the exact box it was written against.
    label:
      spec.actionIcons === true ? (BAR_ACTION_LABELS[i] ?? `Action ${i + 1}`) : `Action ${i + 1}`,
    ...(spec.actionIcons === true && { icon: <Glyph /> }),
    onClick: () => {},
  }))
  return (
    <PageBar
      {...(spec.title !== undefined && { title: spec.title })}
      {...(tabCount > 0 && {
        // Bound to the SAME store the pills use — `ViewTabs` needs a `FieldHandle` and this fixture
        // already owns one whose options carry production-length labels. `options` is passed
        // explicitly rather than defaulted, because the count is what the strip-vs-`Select`
        // collapse keys on and `field.options` is fixed at four.
        tabs: (
          <ViewTabs
            field={barStore.field.f0}
            label="View"
            options={BAR_VALUES.slice(0, tabCount).map((value) => ({
              value,
              label: BAR_LABELS[value] as string,
            }))}
          />
        ),
      })}
      {...(pills.length > 0 && {
        filters: (
          <FilterSet>
            {pills.map((key, i) => (
              <SelectFilter key={key} field={barStore.field[key]} label={`Filter ${i + 1}`} />
            ))}
          </FilterSet>
        ),
      })}
      {...(actions.length > 0 && {
        actions: actions.map((action, i) =>
          i === 0 ? { ...action, primary: true } : action,
        ) as PageBarActions,
      })}
    />
  )
}

// ── The KPI row ───────────────────────────────────────────────────────────────────────────────

/**
 * Production-length KPI values (`wide`). `--vx-text-kpi` mono at ~195px each, MEASURED at 1440x900
 * — wider than a 4-up cell in a shell that also carries an aside (~200px, ~174px inside the card's
 * inset) and comfortably inside a 3-up one (~273px). The value no longer ellipsizes (it shrinks with
 * its card, `dashboard/widget-header.module.css`), so a column count one tier too generous is now
 * a card-chrome question, not a clip — but only a value a real dashboard would print shows it.
 *
 * OPT-IN rather than the default, for the reason `BarSpec.actionIcons` states: every phone sweep in
 * `no-horizontal-overflow.layout.test.ts` was measured against the short values, and a fixture that
 * grows under an existing assertion turns a fixture edit and a real regression into one failure.
 */
const WIDE_STAT_VALUES = ['$12,847,301.55', '$8,204,663.10', '$1,975,428.06', '$640,119.42']

/** `StatGroup` + `StatCard` with a BLED sparkline slot — the render-prop form, so the mark sizes itself
 * to the card's measured inner width rather than to a hardcoded one. That measurement is exactly
 * what can overshoot a 320px page if a card's own box does not stay inside its column. */
function StatsFixture({ count, wide }: { count: number; wide: boolean }): ReactElement {
  return (
    <StatGroup cols={4}>
      {Array.from({ length: count }, (_, i) => (
        <StatCard
          key={i}
          title={`Metric ${i + 1}`}
          value={
            wide ? (WIDE_STAT_VALUES[i % WIDE_STAT_VALUES.length] as string) : `${(i + 1) * 1234}`
          }
          // A box of exactly the measured size: the slot geometry is under test, not a mark.
          sparkline={spark}
        />
      ))}
    </StatGroup>
  )
}

const SLOT_SPARK = [1, 5, 3, 8, 2, 9, 4]

const LONG_FIRST_LINE = `const value = '${'x'.repeat(200)}'\nconst second = 2`

/** A fence between two paragraphs — the outer rhythm and the first-line/copy-button clearance. */
function CodeBlockFixture({ spec }: { spec: NonNullable<FixtureSpec['codeBlock']> }): ReactElement {
  const { title, language = 'ts', showCopy } = spec
  return (
    <Prose>
      <p data-testid="codeblock-before">Before the fence.</p>
      <CodeBlock
        code={LONG_FIRST_LINE}
        {...(language !== null && { language })}
        {...(title !== undefined && { title })}
        {...(showCopy === false && { showCopy })}
      />
      <p data-testid="codeblock-after">After the fence.</p>
    </Prose>
  )
}

const spark = ({ width, height }: { width: number; height: number }): ReactElement => (
  // A box of exactly the measured size: the slot geometry is under test, not a mark.
  <svg aria-hidden width={width} height={height} />
)

/** The four footprints a metric row mixes, keyed by id so a test selects one by name. */
const FOOTPRINTS = [
  { id: 'both', visual: true, footer: true },
  { id: 'visual', visual: true, footer: false },
  { id: 'footer', visual: false, footer: true },
  { id: 'neither', visual: false, footer: false },
] as const

type Footprint = (typeof FOOTPRINTS)[number]

function footprintCard(c: Footprint): ReactElement {
  return (
    <StatCard
      key={c.id}
      title="Latency"
      qualifier="24 h"
      value="42"
      unit="ms"
      delta={-3.1}
      {...(c.footer && { subtitle: 'Source: probes' })}
      {...(c.visual && { sparkline: spark })}
    />
  )
}

function FootprintFixture(): ReactElement {
  const byId = (id: Footprint['id']): Footprint => {
    const found = FOOTPRINTS.find((c) => c.id === id)
    if (found === undefined) throw new Error(`no footprint ${id}`)
    return found
  }
  return (
    <>
      {/* theme-allow -- a non-stretching row: each card's NATURAL height is the payload */}
      <div
        data-testid="foot-natural"
        style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
      >
        {FOOTPRINTS.map((c) => (
          // theme-allow -- the wrapper width IS the fixture's payload
          <div key={c.id} data-testid={`foot-${c.id}`} style={{ width: 240 }}>
            {footprintCard(c)}
          </div>
        ))}
      </div>
      <div data-testid="foot-grid">
        <StatGroup cols={3}>
          {(['both', 'neither', 'footer'] as const).map((id) => footprintCard(byId(id)))}
        </StatGroup>
      </div>
      {/* A `right` card with a footer and no sparkline reserves one footer line, not a visual band. */}
      {([true, false] as const).map((withFooter) => (
        // theme-allow -- the wrapper width IS the fixture's payload
        <div
          key={String(withFooter)}
          data-testid={`foot-right-${withFooter ? 'footer' : 'bare'}`}
          style={{ width: 360 }}
        >
          <StatCard
            title="Latency"
            value="42"
            unit="ms"
            sparklinePlacement="right"
            {...(withFooter && { subtitle: 'Source: probes' })}
          />
        </div>
      ))}
      {/* The `right` placement holds its 72x22 slot while pending, so the card does not jump. */}
      {(['pending', 'ready'] as const).map((state) => (
        // theme-allow -- the wrapper width IS the fixture's payload
        <div key={state} data-testid={`foot-right-${state}`} style={{ width: 360 }}>
          <StatCard
            title="Latency"
            value="42"
            unit="ms"
            sparklinePlacement="right"
            sparkline={spark}
            breakdown={[
              { label: 'Peak', value: '88 ms' },
              { label: 'Median', value: '31 ms' },
            ]}
            loading={state === 'pending'}
          />
        </div>
      ))}
    </>
  )
}

/** Bare Card / Paper, a flush Card, a Card with a Section, a Card with its own `padding: 0` class. */
function CardInsetFixture(): ReactElement {
  return (
    <>
      <style>{'.inset-probe-zero { padding: 0; }'}</style>
      <Card data-testid="inset-card">bare</Card>
      <Paper data-testid="inset-paper">bare</Paper>
      <Card variant="flush" data-testid="inset-flush">
        flush
      </Card>
      <Card data-testid="inset-section">
        <Card.Section data-testid="inset-section-bar">bleed</Card.Section>
        body
      </Card>
      <Card className="inset-probe-zero" data-testid="inset-override">
        override
      </Card>
    </>
  )
}

/** StatCards at exact container widths + a ChartCard stretched by a fixed-height grid row. */
function CardsFixture({ spec }: { spec: CardsSpec }): ReactElement {
  return (
    <>
      {spec.footprint === true && <FootprintFixture />}
      {spec.foldNote?.map((w) => (
        // theme-allow -- the wrapper width IS the fixture's payload (a container-class probe)
        <div key={w} data-testid={`fold-${w}`} style={{ width: w }}>
          <ChartCard title="Availability" subtitle="Last 24 hours" info="How it is measured.">
            {/* theme-allow -- a body taller than the 280px short-card fold, so only width folds */}
            <div style={{ height: 320 }} />
          </ChartCard>
        </div>
      ))}
      {spec.widths.map((w) => (
        // theme-allow -- the wrapper width IS the fixture's payload (a container-class probe)
        <div key={w} data-testid={`card-${w}`} style={{ width: w }}>
          <StatCard
            title="Revenue"
            subtitle="Trailing 30 days"
            value="$12,847,301.55"
            delta={4.2}
            actions={
              <ActionIcon variant="subtle" aria-label="Menu">
                ⋯
              </ActionIcon>
            }
          />
        </div>
      ))}
      {spec.groupWidth !== undefined && (
        // theme-allow -- the wrapper width IS the fixture's payload (a container-class probe)
        <div data-testid="group" style={{ width: spec.groupWidth }}>
          <StatGroup cols={4} divided>
            {[1, 2, 3, 4].map((n) => (
              <div key={n}>{`Metric ${n}`}</div>
            ))}
          </StatGroup>
        </div>
      )}
      {spec.gridProbes?.map((w) => (
        // theme-allow -- the wrapper width IS the fixture's payload (a container-class probe)
        <div key={w} data-testid={`grid-probe-${w}`} style={{ width: w }}>
          <StatGroup cols={5}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n}>{`Metric ${n}`}</div>
            ))}
          </StatGroup>
        </div>
      ))}
      {spec.stretchedRow !== undefined && (
        // theme-allow -- the row height IS the fixture's payload (a stretch probe)
        <div
          data-testid="stretch-row"
          style={{ display: 'grid', gridTemplateRows: `${spec.stretchedRow}px` }}
        >
          <ChartCard title="Stretched">
            {/* theme-allow -- a short fixed body: the spare row height must reach the body wrapper */}
            <div style={{ height: 60 }} />
          </ChartCard>
        </div>
      )}
      {spec.shortHeader !== undefined && (
        // theme-allow -- the wrapper width IS the fixture's payload (a container-class probe)
        <div data-testid="card-short" style={{ width: spec.shortHeader.width }}>
          <ChartCard
            title="Availability"
            subtitle="Last 24 hours"
            value="99.982%"
            delta={0.4}
            actions={
              <ActionIcon variant="subtle" aria-label="Menu">
                ⋯
              </ActionIcon>
            }
          >
            {/* theme-allow -- a short fixed body: the header/card ratio probe's own payload */}
            <div style={{ height: spec.shortHeader.bodyHeight }} />
          </ChartCard>
        </div>
      )}
      {spec.oscillationScan?.bodyHeights.map((bodyHeight) => (
        // theme-allow -- the wrapper width IS the fixture's payload (a container-class probe)
        <div
          key={bodyHeight}
          data-testid={`card-osc-${bodyHeight}`}
          style={{ width: spec.oscillationScan!.width }}
        >
          <ChartCard
            title="Availability"
            subtitle="Last 24 hours"
            value="99.982%"
            delta={0.4}
            actions={
              <ActionIcon variant="subtle" aria-label="Menu">
                ⋯
              </ActionIcon>
            }
          >
            {/* theme-allow -- a fixed body: the oscillation-scan probe's own payload */}
            <div style={{ height: bodyHeight }} />
          </ChartCard>
        </div>
      ))}
    </>
  )
}

/** `FormRow` at exact container widths — the `@container basalt-form-row` probe (n2). */
function FormsFixture({ spec }: { spec: FormsSpec }): ReactElement {
  return (
    <>
      {spec.widths.map((w) => (
        // theme-allow -- the wrapper width IS the fixture's payload (a container-class probe)
        <div key={w} data-testid={`form-row-${w}`} style={{ width: w }}>
          <FormRow label="Project name">
            <input aria-label="Project name" defaultValue="My project" />
          </FormRow>
        </div>
      ))}
    </>
  )
}

// ── The shell's own chrome: header globals, sidebar footer ────────────────────────────────────

/**
 * `globalActions` — bare `ActionIcon`s, which is the shape `app-header.module.css`'s `.global` rule
 * exists for: the consumer passes a NODE, so basalt cannot hand it a size and the enclosing
 * `CtlSlot` supplies the `ctl` tier instead (law C5). Passing an already-sized control would grade a
 * shape the framework does not have to defend.
 */
function globalActionsFor(count: number): GlobalAction[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `g${i}`,
    node: (
      <ActionIcon variant="subtle" aria-label={`Global ${i + 1}`}>
        <Glyph />
      </ActionIcon>
    ),
  }))
}

/**
 * A settled, signed-in account row. `authenticated` rather than `loading` on purpose: the loading
 * form is a skeleton with its own height, and the footer rhythm this fixture exists to measure is
 * the one a reader actually sees.
 */
const FIXTURE_ACCOUNT: BasaltAccountProps = {
  state: {
    status: 'authenticated',
    identity: { id: 'u1', name: 'Fixture User', email: 'fixture@example.com' },
  },
}

/** Flat settings rows — the form with a rhythm; four or more collapse into one gear row instead. */
function settingsItemsFor(count: number): SettingsMenuItem[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `s${i}`,
    label: `Setting ${i + 1}`,
    onClick: () => {},
  }))
}

// ── The aside ─────────────────────────────────────────────────────────────────────────────────

/**
 * Called by the fixture host before every mount, so each `remount(spec)` counts from zero.
 *
 * The counters live on `window`, not in module state, because a test has to read them while
 * NOTHING is mounted — the phone projection renders no node at all until its sheet is opened, and
 * "the children were never mounted before that" is half the invariant.
 */
export function resetAsideMounts(): void {
  window.basaltAsideMounts = { total: 0, live: 0 }
}

/**
 * The aside's payload, counting its own mounts.
 *
 * `live` is how many instances exist RIGHT NOW: a CSS-only responsive twin — the shape law C9
 * mandates for every other control — would render this component in both halves and `live` would
 * be 2, with every bound control beside it subscribed to its field twice. `total` is the
 * page-lifetime ordinal, so a projection that tears the subtree down and rebuilds it reads 2 even
 * though `live` never left 1. `data-mounts` mirrors the ordinal onto the node itself, so a failure
 * says which of the two shapes it was without a second query.
 */
function AsideProbe(): ReactElement {
  const [mounts, setMounts] = useState(0)
  useEffect(() => {
    const counts = window.basaltAsideMounts
    counts.total += 1
    counts.live += 1
    setMounts(counts.total)
    return () => {
      counts.live -= 1
    }
  }, [])
  return (
    <div data-testid="aside-probe" data-mounts={mounts}>
      Composition
    </div>
  )
}

/**
 * A row-2 payload, so `PageBar` publishes the `panelHost` claim the phone projection hangs its
 * `Panel` pill off. Deliberately NOT a BOUND control: this fixture measures where the aside goes,
 * and a store would put a second stateful thing in the tree that the mount count would then have
 * to account for. A plain `ctl`-tier `Button` is bound to nothing and is exactly the box a real
 * filter pill occupies, so it buys the height without the state.
 *
 * THE HEIGHT IS THE POINT, and it used to be a bare `<span>Filters</span>`. Row 2 has no
 * `min-height` of its own (`shell/page-bar.module.css` `.row2` is `padding-block:
 * --vx-space-stack-xs` around whatever it holds), so a text stand-in made the band 8.75px SHORTER
 * than any real bar's: MEASURED at 1440x900, content 23.25px → band 31.25px → painted 32.25px,
 * against a real control's 32 → 40 → 41. `PageAside`'s shell header sizes itself to that published
 * band (`--basalt-page-bar-h`) and carries its own 32px fold toggle, so the too-short band put the
 * header 0.75px past the seam it exists to meet — a fixture artifact wearing a layout defect's
 * clothes. It only surfaced when `controlHeightCtl` grew 30 → 32; below that the fold happened to
 * fit inside the stand-in's band and the seam met by coincidence, which is the worst way for an
 * invariant to be true. See `page-aside.layout.test.ts` INVARIANT 4, which asserts the precondition
 * outright so the coincidence cannot come back.
 */
function AsideBar(): ReactElement {
  return (
    <PageBar
      filters={
        <Button variant="default" size="ctl" data-testid="bar-filters">
          Filters
        </Button>
      }
    />
  )
}

/** Section ids are `s1…sN`; the rail's labels are `Section 1…N`. */
function TocFixture({ spec }: { spec: TocSpec }): ReactElement {
  const articleRef = useRef<HTMLDivElement>(null)
  const ids = Array.from({ length: spec.sections }, (_, i) => `s${i + 1}`)
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          data-testid="toc-bar"
          style={{
            position: 'sticky',
            top: 0,
            height: TOC_SCROLL_MARGIN_PX,
            background: 'canvas',
            zIndex: 1,
          }}
        >
          Title
        </div>
        <div ref={articleRef}>
          {ids.map((id, i) => (
            <section
              key={id}
              style={{ height: i === ids.length - 1 ? spec.lastHeight : spec.sectionHeight }}
            >
              <h2
                id={id}
                style={{ scrollMarginTop: TOC_SCROLL_MARGIN_PX, margin: 0, lineHeight: '24px' }}
              >
                Section {i + 1}
              </h2>
            </section>
          ))}
        </div>
      </div>
      <div style={{ position: 'sticky', top: TOC_SCROLL_MARGIN_PX, alignSelf: 'flex-start' }}>
        <TableOfContents containerRef={articleRef} />
      </div>
    </div>
  )
}

function AsideFixture({ spec }: { spec: AsideSpec }): ReactElement {
  return (
    <PageAside title={spec.title}>
      <AsideProbe />
    </PageAside>
  )
}

// ── Charts ────────────────────────────────────────────────────────────────────────────────────

type ChartPoint = { at: Date; values: number[] }

/** Distinct swatches — a plain hex set: series color is consumer data, the framework ships none. */
const CHART_COLORS = [
  '#3b82f6',
  '#f97316',
  '#22c55e',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#eab308',
  '#ef4444',
]

const CHART_DAYS = 30

/** UTC days, so the fixture is deterministic whatever the host's timezone. */
function buildChartData(seriesCount: number, days: number = CHART_DAYS): ChartPoint[] {
  return Array.from({ length: days }, (_, i) => ({
    at: new Date(Date.UTC(2024, 0, 1 + i)),
    values: Array.from(
      { length: seriesCount },
      (_, s) => 20 + Math.round(12 * Math.sin((i + s * 2) / 4)) + s * 3,
    ),
  }))
}

function buildLineSeries(seriesCount: number, label?: string): ChartSeries<ChartPoint>[] {
  return Array.from({ length: seriesCount }, (_, i) => ({
    key: `s${i}`,
    label: label ?? `Series ${i + 1}`,
    color: CHART_COLORS[i % CHART_COLORS.length] as string,
    getValue: (d: ChartPoint) => d.values[i] ?? null,
  }))
}

function buildBars(seriesCount: number): BarsBar<ChartPoint>[] {
  return buildLineSeries(seriesCount)
}

const chartX = (d: ChartPoint): Date => d.at

type StripSlot = { at: Date; state: 'up' | 'down' }
const STRIP_STATES = [
  { key: 'up', label: 'Up', color: CHART_COLORS[0] as string },
  { key: 'down', label: 'Down', color: CHART_COLORS[1] as string },
] as const satisfies readonly BandStripSeries<StripSlot>[]

const MIRRORED_SERIES = [
  { key: 'rx', label: 'Up', color: CHART_COLORS[0] as string, getValue: () => 10 },
  { key: 'tx', label: 'Down', color: CHART_COLORS[1] as string, getValue: () => 5 },
]

/** Fixed-width buckets, the first at 18:13 UTC — the odd start that exposed the uneven ticks. */
function buildStripData(buckets: number, bucketMs: number): StripSlot[] {
  const start = Date.UTC(2024, 0, 1, 18, 13)
  return Array.from({ length: buckets }, (_, i) => ({
    at: new Date(start + i * bucketMs),
    state: i % 17 === 0 ? 'down' : 'up',
  }))
}

/** The rail idiom: `px` along the top of a `[0, RAIL_DOMAIN_MAX]` plot, sized from the plot area. */
function railMark(data: readonly ChartPoint[], plotHeight: number): ReturnType<typeof rect> {
  return rect([0], {
    id: 'rail',
    x1: () => data[0]?.at,
    x2: () => data.at(-1)?.at,
    y1: () => RAIL_DOMAIN_MAX - (RAIL_PX * RAIL_DOMAIN_MAX) / plotHeight,
    y2: () => RAIL_DOMAIN_MAX,
    fill: CHART_COLORS[1] as string,
    inset: 0,
  })
}

/** A composed (two-pane) chart whose TOP pane draws the rail: the composed path's plot sizes. */
function PanelRailChart({
  data,
  height,
}: {
  data: readonly ChartPoint[]
  height: number | undefined
}): ReactElement {
  const series = useMemo(() => buildLineSeries(1), [])
  const plan = useCallback(
    (_input: PanelInput): PanelPlan<ChartPoint> => {
      const model = xScaleFor<Date>(data.map(chartX), false)
      const [lo, hi] = model.extent ?? [0, 1]
      const xScale = () => scaleUtc().domain([new Date(lo), new Date(hi)])
      const yScale = () => scaleLinear().domain([0, RAIL_DOMAIN_MAX])
      const share = 0.6
      const pane = (
        ctx: PaneContext,
        marks: ChartMarks,
        shareOf: number,
        withX: boolean,
      ): ReturnType<PaneBuilder> => {
        const cls = resolveContainerClass(ctx.width)
        const whole = chartHeightOf(ctx.height, shareOf, 8)
        return {
          marks,
          scales: {
            x: withX
              ? paneX({ scale: xScale(), model, format: String, cls, height: whole })
              : { scale: xScale(), axis: false },
            y: paneY({
              scale: yScale(),
              domain: [0, RAIL_DOMAIN_MAX],
              format: String,
              ticks: 3,
              cls,
              height: whole,
            }),
          },
        }
      }
      return {
        keys: model.values,
        topFraction: share,
        gap: 8,
        rows: () => [],
        top: (ctx) => {
          const plot = plotContext<ChartPoint, Date>(
            {
              rows: () => [],
              visible: series,
              highlighted: null,
              containerClass: resolveContainerClass(ctx.width),
              width: ctx.width,
              height: ctx.height,
              data,
              y2: undefined,
              yDomain: [0, RAIL_DOMAIN_MAX],
              y2Domain: undefined,
              xFraction: model.fraction,
            },
            ctx.plot,
          )
          return pane(ctx, [railMark(data, plot.plotHeight)], share, false)
        },
        bottom: (ctx) =>
          pane(
            ctx,
            [ruleY([0], { id: 'zero', stroke: CHART_COLORS[0] as string })],
            1 - share,
            true,
          ),
      }
    },
    [data, series],
  )
  return (
    <PanelRung
      ariaLabel="Fixture panel rail"
      series={series}
      plan={plan}
      {...(height !== undefined && { height })}
    />
  )
}

/** One real `basalt-ui/charts` kind, picked by `spec.kind`, in a `data-testid` box so a test has one
 * stable selector for "the chart's own container" — fixed-width when `width` pins its class. */
function ChartsFixture({ spec }: { spec: ChartsSpec }): ReactElement {
  const seriesCount = spec.legendEntries ?? 3
  const data = useMemo(() => buildChartData(seriesCount), [seriesCount])
  const stripData = useMemo(
    () => buildStripData(spec.stripBuckets ?? 60, spec.bucketMs ?? 60_000),
    [spec.stripBuckets, spec.bucketMs],
  )
  const height = spec.height === undefined ? {} : { height: spec.height }
  const domain = useMemo(() => {
    const first = data[0]
    const last = data.at(-1)
    const mid = data[Math.floor(data.length / 2)]
    if (!spec.xDomain || !first || !last || !mid) return {}
    return { xDomain: [first.at, last.at] as const, xTicks: [mid.at] }
  }, [data, spec.xDomain])
  const followerData = useMemo(
    () =>
      spec.xDomain
        ? data.slice(Math.floor(data.length / 3), Math.floor((data.length * 2) / 3))
        : data,
    [data, spec.xDomain],
  )
  const originAxes = useMemo(() => {
    const first = data[0]
    const mid = data[Math.floor(data.length / 2)]
    return first && mid ? { y: { domain: [0, 50] as const }, xTicks: [first.at, mid.at] } : {}
  }, [data])
  const chart =
    spec.kind === 'dual' ? (
      <DualPanel
        ariaLabel="Fixture dual"
        data={data}
        x={chartX}
        series={buildLineSeries(1)}
        bar={{
          label: 'Delta',
          getValue: (d) => (d.values[0] ?? 0) - 25,
          positive: CHART_COLORS[0] as string,
          negative: CHART_COLORS[1] as string,
          format: String,
        }}
        {...height}
      />
    ) : spec.kind === 'rail' ? (
      <CartesianChart
        ariaLabel="Fixture rail"
        data={data}
        x={chartX}
        series={buildLineSeries(1)}
        y={{ domain: [0, RAIL_DOMAIN_MAX] }}
        marks={(plot) => [railMark(data, plot.plotHeight)]}
        {...height}
      />
    ) : spec.kind === 'spark' && spec.sparkIn !== undefined ? (
      <div style={{ width: spec.sparkIn === 'right' ? 520 : 300 }}>
        {spec.sparkIn === 'card' || spec.sparkIn === 'right' ? (
          <StatCard
            title="Slot"
            value="12"
            {...(spec.sparkIn === 'right' && { sparklinePlacement: 'right' as const })}
            sparkline={(size) => <Sparkline ariaLabel="Slot spark" data={SLOT_SPARK} {...size} />}
          />
        ) : (
          <StatGroup
            variant="strip"
            label="Slot strip"
            cells={[
              {
                key: 'a',
                caption: 'Slot',
                value: '12',
                visual: <Sparkline ariaLabel="Slot spark" data={SLOT_SPARK} height={28} />,
              },
            ]}
          />
        )}
      </div>
    ) : spec.kind === 'spark' ? (
      <Sparkline
        ariaLabel="Fixture spark"
        data={
          spec.sparkBars
            ? [0, 0, 1, 0, 2, 3, 3, 3]
            : Array.from(
                { length: spec.sparkRows ?? 3000 },
                (_, i) => 20 + 12 * Math.sin(i / 9) + (i % 13),
              )
        }
        {...(spec.sparkBars && { mark: 'bar' as const })}
        height={spec.height ?? 40}
        emphasizeLast
      />
    ) : spec.kind === 'mirrored' ? (
      <MirroredBars
        ariaLabel="Fixture mirrored"
        data={stripData}
        x={(d) => d.at}
        series={MIRRORED_SERIES}
        up={{ key: 'rx', format: String }}
        down={{ key: 'tx', format: String }}
        {...height}
      />
    ) : spec.kind === 'strip' ? (
      <BandStrip
        ariaLabel="Fixture strip"
        data={stripData}
        x={(d) => d.at}
        states={STRIP_STATES}
        getBand={(d) => ({ state: d.state })}
        {...height}
      />
    ) : spec.kind === 'panel-rail' ? (
      <PanelRailChart data={data} height={spec.height} />
    ) : spec.kind === 'bars' ? (
      <Bars
        ariaLabel="Fixture bars"
        data={data}
        x={chartX}
        bars={buildBars(seriesCount)}
        {...height}
      />
    ) : (
      <Lines
        ariaLabel="Fixture lines"
        data={data}
        x={chartX}
        series={buildLineSeries(seriesCount, spec.endLabel)}
        {...domain}
        {...(spec.origin && originAxes)}
        {...height}
      />
    )
  // theme-allow -- the wrapper width IS the fixture's payload (a container-class probe)
  const box = spec.width === undefined ? undefined : { width: spec.width }
  return (
    <>
      <div data-testid="chart-frame" style={box}>
        {chart}
      </div>
      {spec.pair && (
        <div data-testid="chart-frame-2" style={box}>
          <Lines
            ariaLabel="Fixture follower"
            data={followerData}
            x={chartX}
            series={buildLineSeries(1)}
            {...domain}
            {...height}
          />
        </div>
      )}
    </>
  )
}

// ── The agent transcript ──────────────────────────────────────────────────────────────────────

/** Deliberately non-uniform lengths — a one-line ack beside a several-sentence reply — so a
 * uniform fixture never masks a `measureElement` regression the way `AgentTranscriptVirtualizeDemoPage`'s
 * own doc warns about. */
const AGENT_MESSAGE_BODIES = [
  'Got it.',
  'Here is a longer reply that spans a couple of lines to vary the measured row height across the seeded thread — a uniform-height fixture would hide exactly this regression class.',
  'Sure, one moment.',
  'Let me check that for you — a medium-length reply with enough words to wrap onto a second line on a narrow viewport.',
  'Done.',
]

function buildAgentMessages(count: number): ChatMessage<TranscriptPart>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `agent-m${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    parts: [
      {
        id: `agent-m${i}-p1`,
        type: 'text',
        text: AGENT_MESSAGE_BODIES[i % AGENT_MESSAGE_BODIES.length] as string,
      },
    ],
    createdAt: i,
  }))
}

/** `mode: 'virtualized'` (default) — a bare, windowed `ThreadTranscript`. `className` reaches the
 * virtualizer's own scroll root (`BasaltProps`), which is the stable selector a layout test reads
 * scroll geometry off. */
function VirtualizedTranscriptFixture({ spec }: { spec: AgentSpec }): ReactElement {
  const messages = useMemo(() => buildAgentMessages(spec.messages), [spec.messages])
  return (
    <ThreadTranscript
      className="lyt-agent-scroll"
      messages={messages}
      virtualize
      height={spec.height}
    />
  )
}

/** `mode: 'inlineRow'` — the same transcript nested inside a collapsed→expandable `ThreadFeedRow`,
 * for the lazy-mount-then-kept-mounted `display: none` remount-measure path. */
function InlineRowFixture({ spec }: { spec: AgentSpec }): ReactElement {
  const messages = useMemo(() => buildAgentMessages(spec.messages), [spec.messages])
  const [expanded, setExpanded] = useState(false)
  const thread: AgentThread<TranscriptPart> = useMemo(
    () => ({
      id: 'agent-row',
      messages,
      outcome: { title: 'Fixture thread', summary: `${spec.messages} messages`, status: 'done' },
      status: 'done',
      read: true,
      createdAt: 0,
      updatedAt: 0,
    }),
    [messages, spec.messages],
  )
  return (
    <>
      <button type="button" data-testid="agent-row-toggle" onClick={() => setExpanded((v) => !v)}>
        Toggle
      </button>
      <ThreadFeedRow
        thread={thread}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onSend={() => {}}
        virtualize
        height={spec.height}
      />
    </>
  )
}

const STREAM_WORDS = Array.from({ length: 40 }, (_, i) => `word${i}`)
const STREAM_STEP_MS = 60

/** `mode: 'anchorToEnd'` — virtualized, plus a live turn driven purely through `liveParts`/
 * `liveStatus` (no transport needed) so a test can watch `anchorTo: 'end'` + `followOnAppend`
 * track a live append against a real scroll, then hold once the reader scrolls away. */
function AnchorToEndFixture({ spec }: { spec: AgentSpec }): ReactElement {
  const [messages, setMessages] = useState<ChatMessage<TranscriptPart>[]>(() =>
    buildAgentMessages(spec.messages),
  )
  const [liveParts, setLiveParts] = useState<TranscriptPart[] | undefined>(undefined)
  const [liveStatus, setLiveStatus] =
    useState<ComponentProps<typeof ThreadFeedRow>['liveStatus']>(undefined)

  const start = useCallback(() => {
    let i = 0
    setLiveStatus('streaming')
    setLiveParts([{ id: 'live-p1', type: 'text', text: '' }])
    const interval = setInterval(() => {
      i += 1
      const text = STREAM_WORDS.slice(0, i).join(' ')
      setLiveParts([{ id: 'live-p1', type: 'text', text }])
      if (i >= STREAM_WORDS.length) {
        clearInterval(interval)
        setMessages((prev) => [
          ...prev,
          {
            id: 'live-final',
            role: 'assistant',
            parts: [{ id: 'live-p1', type: 'text', text }],
            createdAt: Date.now(),
          },
        ])
        setLiveParts(undefined)
        setLiveStatus(undefined)
      }
    }, STREAM_STEP_MS)
  }, [])

  return (
    <>
      <button type="button" data-testid="agent-start-stream" onClick={start}>
        Start streaming
      </button>
      <ThreadTranscript
        className="lyt-agent-scroll"
        messages={messages}
        {...(liveParts !== undefined && { liveParts })}
        {...(liveStatus !== undefined && { liveStatus })}
        virtualize
        height={spec.height}
      />
    </>
  )
}

function AgentFixture({ spec }: { spec: AgentSpec }): ReactElement {
  if (spec.mode === 'inlineRow') return <InlineRowFixture spec={spec} />
  if (spec.mode === 'anchorToEnd') return <AnchorToEndFixture spec={spec} />
  return <VirtualizedTranscriptFixture spec={spec} />
}

/** `overlays.confirm` (danger) behind a button — the modal-as-sheet invariant's only trigger. */
function ConfirmFixture(): ReactElement {
  return (
    <>
      <button
        type="button"
        data-testid="open-confirm"
        onClick={
          () =>
            overlays
              .confirm({
                title: 'Revoke access?',
                body: 'The key stops working immediately.',
                confirmLabel: 'Revoke',
                danger: true,
                onConfirm: () => {},
              })
              .catch(() => {}) // the modals layer is lazy: a too-early tap rejects, the test retries
        }
      >
        Open confirm
      </button>
    </>
  )
}

function AnchorFixture(): ReactElement {
  return (
    <>
      <PageBar title="Anchors" tabs={<span>Overview</span>} />
      {[1, 2, 3].map((n) => (
        <Section key={n} id={`anchor-${n}`} title={`Anchor ${n}`}>
          {/* theme-allow -- a measured filler height IS the fixture's payload, not a themed size */}
          <div style={{ height: 1200 }} />
        </Section>
      ))}
    </>
  )
}

/** The breadcrumb the shell used to derive from the active item: its section, and parent if nested. */
function crumbOf(sections: SidebarSection[]): ActiveCrumb | undefined {
  const find = (
    items: SidebarItem[],
    parent?: SidebarItem,
  ): Omit<ActiveCrumb, 'section'> | undefined => {
    for (const item of items) {
      const nested = item.children && find(item.children, item)
      if (nested) return nested
      if (item.active) {
        return {
          page: item.label,
          ...(parent && { parent: parent.label, parentAnchor: parent.Anchor }),
        }
      }
    }
  }
  for (const section of sections) {
    const found = find(section.items)
    if (found) return { section: section.label, ...found }
  }
}

/** Meter / BarList probes at fixed widths — the geometry happy-dom cannot see (SPEC § 6.3, § 6.4). */
/** Four zones whose longest name cannot fit its quarter of a 160px row. */
const TRAINING_ZONES = [
  { from: 0, to: 250, label: 'Low' },
  { from: 250, to: 500, label: 'Optimal' },
  { from: 500, to: 750, label: 'High' },
  { from: 750, to: 1000, label: 'Overreaching' },
]

/** The S2 training-load shape: four zones, end ticks and one caption. */
const LOAD_ZONES = [
  { from: 0, to: 0.8, label: 'Under' },
  { from: 0.8, to: 1.3, label: 'Optimal' },
  { from: 1.3, to: 1.5, label: 'Caution' },
  { from: 1.5, to: 2, label: 'Danger' },
]
const LOAD_TICKS = [
  { at: 0, label: '0' },
  { at: 2, label: '2.0' },
]

function DashFixture(): ReactElement {
  const items = [
    {
      label: 'Support bot with a deliberately long label that must truncate',
      value: 321,
      secondary: '41%',
    },
    { label: 'Infra', value: 160, secondary: '20%' },
    { label: 'Tools', value: 40 },
  ]
  return (
    <>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-barlist" style={{ width: 320 }}>
        <BarList label="Spend" variant="inline" items={items} format={(v) => `€${v}`} />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-bar-thin" style={{ width: 342 }}>
        <BarList
          label="Waiting or blocked"
          format={(v) => `${v} h`}
          items={[
            {
              label: 'Upgrade the dependency graph resolver · basalt-ui',
              value: 58,
              secondary: (
                <StatusVerdict
                  color="var(--vx-status-bad)"
                  word="Blocked · Waits on the API change"
                />
              ),
            },
            {
              label: 'Drop the legacy exporter · argo',
              value: 14,
              secondary: <StatusVerdict color="var(--vx-faint)" word="Needs you" />,
            },
            {
              label: 'Sleep',
              value: 8,
              secondary: <StatusVerdict color="var(--vx-faint)" word="Good" />,
            },
          ]}
        />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-meter-orphans" style={{ width: 96 }}>
        <Meter
          label="Oldest wait"
          value={26}
          max={168}
          startCaption="Warden abandons an item at 7 d"
          endCaption="forecast over budget"
        />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-chart-error" style={{ width: 342 }}>
        <ChartCard
          title="Goal"
          state={{ error: new Error('The request failed.') }}
          placeholderHeight={96}
          stateAction={<button type="button">Retry</button>}
        >
          <div />
        </ChartCard>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-barlist-states" style={{ width: 320 }}>
        <BarList label="Loading" items={[]} loading />
        <BarList label="Empty" items={[]} />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-meter-parts" style={{ width: 160 }}>
        <Meter
          label="Spend split"
          max={3000}
          format={(v) => `€${v}`}
          segments={[
            { value: 1200, label: 'Support bot', color: 'var(--vx-accent)' },
            { value: 900, label: 'Infrastructure' },
            { value: 400, label: 'Tooling' },
          ]}
        />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-meter-wrap" style={{ width: 160 }}>
        <Meter
          label="Budget"
          max={3000}
          target={2400}
          format={(v) => `€${v}`}
          segments={[
            { value: 1800, label: 'Spent' },
            { value: 850, label: 'Planned', forecast: true },
          ]}
        />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-meter-long" style={{ width: 160 }}>
        <Meter
          label="Long names"
          max={3000}
          segments={[
            { value: 1200, label: 'Infrastructure-and-observability-platform-costs' },
            { value: 400, label: 'Tooling' },
          ]}
        />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-meter-zones-160" style={{ width: 160 }}>
        <Meter label="Training load" max={1000} value={400} zones={TRAINING_ZONES} />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-meter-zones-360" style={{ width: 360 }}>
        <Meter label="Training load" max={1000} value={400} zones={TRAINING_ZONES} />
      </div>
      {[120, 170, 220, 342].map((w) => (
        // theme-allow -- the wrapper width IS the fixture's payload (a container probe)
        <div key={w} data-testid={`dash-zl-${w}`} style={{ width: w }}>
          <Meter
            label="Training load"
            min={0}
            max={2}
            value={1.1}
            zones={LOAD_ZONES}
            ticks={LOAD_TICKS}
            endCaption="rest < 40 · push ≥ 70"
          />
        </div>
      ))}
      {/* A tick at 15% lands on "Under"'s centre: the tick wins, the name hides. */}
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-zl-clash" style={{ width: 220 }}>
        <Meter
          label="Training load"
          min={0}
          max={2}
          value={1.1}
          zones={LOAD_ZONES}
          ticks={[{ at: 0.3, label: 'Rest' }, ...LOAD_TICKS]}
        />
      </div>
      <div data-testid="dash-zl-strip">
        <StatGroup
          variant="strip"
          label="Load"
          cols={5}
          cells={[
            {
              key: 'load',
              caption: 'Load',
              value: '1.1',
              visual: (
                <Meter
                  label="Training load"
                  min={0}
                  max={2}
                  value={1.1}
                  zones={LOAD_ZONES}
                  ticks={LOAD_TICKS}
                  endCaption="rest < 40 · push ≥ 70"
                />
              ),
            },
            ...[2, 3, 4, 5].map((n) => ({
              key: `c${n}`,
              caption: `Metric ${n}`,
              value: String(n),
            })),
          ]}
        />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-zl-card" style={{ width: 360 }}>
        <StatCard
          title="Load"
          value="1.1"
          sparkline={
            <Meter
              label="Training load"
              min={0}
              max={2}
              value={1.1}
              zones={LOAD_ZONES}
              ticks={LOAD_TICKS}
              endCaption="rest < 40 · push ≥ 70"
            />
          }
        />
      </div>
      {(['ltr', 'rtl'] as const).flatMap((dir) =>
        [160, 360].flatMap((w) =>
          [0, 500, 1000].map((v) => (
            // theme-allow -- the wrapper width IS the fixture's payload (a container probe)
            <div
              key={`${dir}-${w}-${v}`}
              dir={dir}
              data-testid={`dash-meter-reading-${dir}-${w}-${v}`}
              style={{ width: w }}
            >
              <Meter label="Training load" max={1000} value={v} zones={TRAINING_ZONES} />
            </div>
          )),
        ),
      )}
      {[
        ['spark', <div key="s" />],
        ['meter', <Meter key="m" label="Budget" value={1800} max={3000} />],
      ].map(([kind, visual]) => (
        // theme-allow -- the wrapper width IS the fixture's payload (a container probe)
        <div
          key={String(kind)}
          data-testid={`dash-card-loading-${String(kind)}`}
          style={{ width: 360 }}
        >
          <StatCard title="Spend" value="€2,650" loading sparkline={visual} />
        </div>
      ))}
      <div data-testid="dash-card-slot-meter-loading" style={{ width: 360 }}>
        <StatCard
          title="Spend"
          value="€2,650"
          sparkline={<Meter label="Budget" value={1800} max={3000} loading />}
        />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-card-loading-right" style={{ width: 360 }}>
        <StatCard
          title="Latency"
          value="42"
          loading
          sparklinePlacement="right"
          sparkline={<div />}
          breakdown={[
            { label: 'Peak', value: '88 ms' },
            { label: 'Median', value: '31 ms' },
          ]}
        />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-meter-ring" style={{ width: 160 }}>
        <Meter
          shape="ring"
          label="Users"
          value={12483}
          max={20000}
          format={(v) => `€${v.toLocaleString('en-US')}`}
        />
      </div>
      {[360, 560].map((w) => (
        // theme-allow -- the wrapper width IS the fixture's payload (a container probe)
        <div key={w} data-testid={`dash-card-${w}`} style={{ width: w }}>
          <StatCard
            title="Spend"
            value="€2,650"
            sparkline={<Meter label="Budget" value={1800} max={3000} target={2400} />}
          />
        </div>
      ))}
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container probe) */}
      <div data-testid="dash-card-spark" style={{ width: 360 }}>
        <StatCard
          title="Users"
          value="12,483"
          sparkline={
            // theme-allow -- fills the slot so the slot's own box is what is measured
            <div data-testid="dash-spark" style={{ height: '100%' }} />
          }
        />
      </div>
      {[360, 560].map((w) => (
        // theme-allow -- the wrapper width IS the fixture's payload (a container probe)
        <div key={w} data-testid={`dash-card-right-${w}`} style={{ width: w }}>
          <StatCard
            title="Spend"
            value="€2,650"
            sparklinePlacement="right"
            sparkline={<Meter label="Budget" value={1800} max={3000} target={2400} />}
          />
        </div>
      ))}
    </>
  )
}

export function ShellFixture({ spec }: { spec: FixtureSpec }): ReactElement {
  if (spec.anchor?.shell === false) return <AnchorFixture />
  const icons = spec.icons ?? true
  const sections: SidebarSection[] = spec.sections.map((section) => ({
    label: section.label,
    items: section.items.map((item) => toItem(item, icons)),
    ...(section.tab ? { mobile: { tab: true as const } } : {}),
    ...(section.collapsible ? { collapsible: true } : {}),
    ...(section.defaultCollapsed ? { defaultCollapsed: true } : {}),
  }))
  return (
    <ShellFrame
      activeCrumb={crumbOf(sections)}
      brand={{ name: 'Fixture' }}
      sections={sections}
      {...(spec.headerHeight !== undefined && { headerHeight: spec.headerHeight })}
      {...(spec.nav && { mobileNav: spec.nav })}
      {...(spec.globals !== undefined && { globalActions: globalActionsFor(spec.globals) })}
      {...(spec.sidebar?.account === true && { account: FIXTURE_ACCOUNT })}
      {...(spec.sidebar?.settings !== undefined && {
        settingsMenuItems: settingsItemsFor(spec.sidebar.settings),
      })}
    >
      {spec.anchor && <AnchorFixture />}
      {spec.aside && !spec.aside.noBar && <AsideBar />}
      {spec.bar && <BarFixture spec={spec.bar} />}
      {spec.stats !== undefined && (
        <StatsFixture count={spec.stats} wide={spec.statsWide === true} />
      )}
      {spec.cardInset && <CardInsetFixture />}
      {spec.cards && <CardsFixture spec={spec.cards} />}
      {spec.dash && <DashFixture />}
      {spec.infoRing && <InfoRingFixture />}
      {spec.retryParity && <RetryParityFixture />}
      {spec.codeBlock && <CodeBlockFixture spec={spec.codeBlock} />}
      {spec.forms && <FormsFixture spec={spec.forms} />}
      {spec.table && <TableFixture spec={spec.table} />}
      {spec.charts && <ChartsFixture spec={spec.charts} />}
      {spec.agent && <AgentFixture spec={spec.agent} />}
      {spec.toc && <TocFixture spec={spec.toc} />}
      {spec.confirm && <ConfirmFixture />}
      {/* theme-allow -- a measured filler height IS the fixture's payload, not a themed size */}
      <div style={{ height: spec.bodyHeight ?? 0 }} />
      <div data-testid="content-end">end of content</div>
      {/* Written AFTER the main column on purpose — that is the order the in-flow mobile form
          inherits, and the order a consumer page uses. */}
      {spec.aside && <AsideFixture spec={spec.aside} />}
    </ShellFrame>
  )
}
