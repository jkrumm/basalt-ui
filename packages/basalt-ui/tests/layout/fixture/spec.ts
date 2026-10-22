import type { BasaltDensityLevel, BasaltRadiusLevel } from '../../../src/theme'

/**
 * The wire format between a layout test (Bun) and the fixture app (browser).
 *
 * Everything here is JSON-serializable on purpose — it crosses `page.evaluate`. Icons, anchors and
 * handlers are NOT expressible and are supplied by `fixtures.tsx`, which is the point: a fixture
 * describes a NAV SHAPE, never a rendering. The rendering is `BasaltShell`'s, unmodified.
 *
 * This is the extension seam. A new invariant is usually a new spec literal in the test file and
 * nothing else; a new nav shape is one field here plus one line in `fixtures.tsx`, type-checked on
 * both sides of the bridge.
 */
export type ItemSpec = {
  key: string
  label: string
  short?: string
  mobile?: 'tab' | 'more' | 'hidden'
  active?: boolean
  disabled?: boolean
  count?: number
  children?: ItemSpec[]
}

/** `tab: true` gives the whole SECTION one bar slot — the menu/sheet cardinality-inference path. */
export type SectionSpec = {
  label: string
  items: ItemSpec[]
  tab?: true
  /** A foldable section; `defaultCollapsed` seeds it folded — argo's "Other" shape. */
  collapsible?: true
  defaultCollapsed?: true
}

/**
 * A `BasaltDataTable` rendered in the shell body. Exists for ONE invariant class: a sticky
 * `<thead>` inside `Table.ScrollContainer`, whose anchor is the scroller's own top edge and not
 * the page's. happy-dom cannot observe it at all — `position: sticky` is a layout outcome.
 */
export type TableSpec = {
  /** Body rows. Enough of them that `maxHeight` actually overflows. */
  rows: number
  /** Caps the body, so the container is a real vertical scrollport. */
  maxHeight?: number
  /** Horizontal floor — the `/data-stress` shape, which turns the container on without a cap. */
  minWidth?: number
  /** What a consumer passes for PAGE scroll (`PageBar` row 2's band, inside Main's scrollport). */
  stickyHeaderOffset?: number | string
  /**
   * Column count. Two by default (the sticky-header invariants only need a header POSITION), but
   * the phone-overflow guard needs a table wide enough to widen the page if nothing contains it —
   * which a two-column table never is.
   */
  columns?: number
  /**
   * `stickyHeader`. Defaults to `true`, because the sticky-header invariants were written before
   * anything else mounted a table here. The two values take two different containment roads — the
   * static `Table.ScrollContainer` when `false`, the MEASURED wrapper when `true` and neither
   * `maxHeight` nor `minWidth` is set (`useMeasuredContainment` in `data/data-table.tsx`) — and
   * both are exercised, here and in the overflow guard.
   */
  stickyHeader?: boolean
  /** A failed `query` (no data): the table's error body, with the empty state's search glyph supplied. */
  error?: true
  /**
   * `enableGlobalFilter` — the toolbar's search field. It states a width, which is what made the
   * toolbar the widest box on a phone `/data` page (MEASURED at 390x844: `main.scrollWidth` 505
   * against `clientWidth` 390) once a facet pill row sat beside it.
   */
  search?: boolean
  /**
   * How many faceted filter pills ride the toolbar beside the search. Each is a real `EnumFilter`
   * over one of the generated columns, so the `_pillRow_` box the overflow guard reports is the
   * production one and not a stand-in.
   */
  facets?: number
  /** Opens the first facet preset to its first option, so the pill shows its bright value. */
  preset?: true
  /** Adds the pagination footer (rows-per-page Select + pager). */
  paginate?: true
  /** Adds an `actions` button (`Export CSV`) to the toolbar's right edge. */
  actions?: true
  /** Pins the table's own container to this many px — the toolbar reads it, never the viewport. */
  containerWidth?: number
  /**
   * Adds a `State` column of `Badge` cells beside breakable prose columns, the shape that shrank
   * `WORKING` to `WOR…` in argo: a Badge's clipped label has a ~0 min-content, so an auto-layout
   * column of nothing else gave up its width to the wrapping text next to it.
   */
  badges?: true
}

/**
 * A `PageBar` with row-2 pills and row-1 actions, mounted for its own sake rather than as the
 * aside's projection host. Exists for the phone-overflow guard: `PageBar`'s rows are
 * `flex-wrap: nowrap` with no `overflow-x` by law C7, so a bar carrying several controls is one of
 * the two shapes that can widen a 320px page.
 */
export type BarSpec = {
  /** Shell-less title / row-1 lead. Ignored inside a shell, where the breadcrumb names the page. */
  title?: string
  /** How many filter pills ride row 2. */
  pills?: number
  /**
   * How many options ride row 2's `ViewTabs` strip (`PageBar.tabs`), 0 ⇒ no strip at all.
   *
   * Exists because round 2 put a `ViewTabs` in `tabs` on nearly every playground route, and the
   * strip has a WIDTH LAW no other row-2 slot has: `ViewTabs` renders a real segmented strip up to
   * three options and collapses to a `Select` past it, in CSS. Three and four are therefore two
   * different components in the same slot, and only the four-up case exercises the collapse — so
   * the count is the knob, not a boolean. The labels are `BAR_LABELS`' production-length ones
   * (`Organic search`, …), because a strip of `Tab 1`s fits at a width no real strip fits at.
   */
  tabs?: number
  /** How many row-1 actions ride the header portal. */
  actions?: number
  /**
   * Gives every action an `icon`. OPT-IN rather than the default, because it moves geometry in two
   * places at once and only one of them is wanted: it is the precondition for `BarEntry`'s `md`
   * label fold (a secondary with no icon has nothing to fall back to and keeps its label at every
   * width), and it also widens the compact mobile primary that the phone-overflow tests measure.
   * A desktop test opts in; the phone sweeps keep the shape they were written against.
   */
  actionIcons?: true
}

/**
 * The sidebar's pinned FOOTER region — the block below the nav scroll area holding the settings
 * rows and the account row (`app-sidebar.tsx`).
 *
 * It renders ONLY when the consumer supplies at least one of these props, which is why the footer's
 * rhythm — the gap that separates it from the scroll region, and the gap between its own rows —
 * had no fixture to be measured in until this field existed.
 */
export type SidebarSpec = {
  /** Mounts the account row (`status: 'authenticated'`) — the footer's bottom-most child. */
  account?: true
  /**
   * How many `settingsMenuItems` ride the footer. Three or fewer render as FLAT rows, four or more
   * collapse into the single gear menu (`AppSidebarProps.settingsMenuItems` documents the
   * threshold) — the flat form is the one with a rhythm to measure.
   */
  settings?: number
}

/**
 * A `PageAside` claiming the shell's aside region, plus the `PageBar` row 2 its phone projection
 * needs a pill to hang off.
 *
 * Exists for ONE invariant class, and it is the class happy-dom is worst at: WHICH of the aside's
 * two projections is live is decided by a viewport read (law C9's declared exception,
 * `docs/ASIDE-SPEC.md` §0), and happy-dom's `matchMedia` answers for one hard-coded width. Only a
 * real browser can show the desktop panel and the phone pill in the same suite — and, crucially,
 * that the aside's children are mounted exactly ONCE at each of them.
 */
export type AsideSpec = {
  /** The aside's `title` — the sheet's heading and the `Panel` pill's accessible name. */
  title: string
  /**
   * Skips the accompanying `AsideBar` — the one shape the desktop panel's mobile projection needs
   * a `PageBar` row 2 for. Exists for ONE invariant: with no `PageBar` anywhere on the route, the
   * shell's page-bar band never mounts, `--basalt-page-bar-h` is never published, and the aside's
   * shell header falls back to the ordinary `appShellHeaderHeight` band
   * (`shell/page-aside.module.css`, `docs/ASIDE-SPEC.md`). Desktop-only in practice: below `sm` a
   * `noBar` aside has nowhere to project and stays in flow (wave 1), which this flag does not test.
   */
  noBar?: true
}

/**
 * One chart from `basalt-ui/charts`, mounted in the shell body. Exists for what happy-dom cannot see
 * at all: the measured container class and the guide ladder it drives, the engine's real pointer
 * focus, crosshair and portalled tooltip, and CSS inheritance from `:root` (docs/V2-SPEC.md § 9.5,
 * § 9.6).
 */
export type ChartsSpec = {
  /** A real kind from `basalt-ui/charts` — never a hand-rolled stand-in. */
  kind:
    | 'lines'
    | 'bars'
    | 'dual'
    | 'rail'
    | 'panel-rail'
    | 'spark'
    | 'strip'
    | 'mirrored'
    | 'heatmap'
    | 'error-card'
    | 'ref-bars'
  /** `spark`: the row count of the one `Sparkline` (default 3000), in a `width`-px cell. */
  sparkRows?: number
  /** `spark`: draw bars (a short fixed series with zeros) instead of the sine line. */
  sparkBars?: true
  /** `spark`: mount the Sparkline in a 300px `StatCard` sparkline slot (`card`), the same card with `sparklinePlacement="right"` in a 520px box (`right`) or a strip cell
   * `visual` (`strip`) instead of bare. */
  sparkIn?: 'card' | 'right' | 'strip'
  /** `heatmap`: a status grid (`tone` states) under a `data-testid="heatmap-caption"` row. */
  /** `strip`/`mirrored`: the bucket count of the `BandStrip`/`MirroredBars` (default 60)... */
  stripBuckets?: number
  /** ...and each bucket's width in ms (default one minute — a one-hour range). */
  bucketMs?: number
  /** `lines`: every series' label (and so its end label). Default `Series N`. */
  endLabel?: string
  /** `lines`: each series' own label (name column probe); wins over `endLabel`. */
  names?: readonly string[]
  /** `lines`: y domain `[0, 50]` and an x tick on the first datum — a tick label at each axis' origin. */
  origin?: true
  /** Number of series (legend entries). Default 3. */
  legendEntries?: number
  /** Fixed height in px, forwarded to the kind. Omitted ⇒ the height law. */
  height?: number
  /** Wraps the chart in a box exactly this many px wide, pinning its container class. */
  width?: number
  /** Mounts a second `Lines` on the same Date x (`data-testid="chart-frame-2"`): the cursor pair. */
  pair?: true
  /**
   * With `pair`: both charts pin the same `xDomain` (the full data's extent) and one `xTicks`
   * instant, but the follower draws only the middle third of the rows — so the same instant is
   * only the same pixel column if the explicit domain, not the data, sets the scale.
   */
  xDomain?: true
}

/** The `rail` probe: a stated pixel thickness along the top of a plot whose y domain tops out at
 * {@link RAIL_DOMAIN_MAX}. The test asserts the rail measures {@link RAIL_PX} px. */
export const RAIL_PX = 3
export const RAIL_DOMAIN_MAX = 100

/**
 * A `basalt-ui/agent-chat` transcript, mounted in the shell body. Exists for the invariants happy-
 * dom cannot see at all (`docs/AGENT-CHAT-SPEC.md`'s `@tanstack/react-virtual` integration):
 * `measureElement` actually measuring variable-height rows, a virtualized scroll node recovering
 * after a `display: none` ancestor toggle, and `anchorTo: 'end'` + `followOnAppend` staying pinned
 * to a live turn's tail against a real scroll.
 */
export type AgentSpec = {
  /** Seed message count, oldest first — deliberately non-uniform height (see `buildAgentMessages`). */
  messages: number
  /** Fixed px height for the windowed transcript body. */
  height: number
  /**
   * `'virtualized'` (default) — a bare, windowed `ThreadTranscript`. `'inlineRow'` — the same
   * transcript nested inside a collapsed→expandable `ThreadFeedRow` (the lazy-mount-then-kept-
   * mounted, `display: none` remount-measure path). `'anchorToEnd'` — virtualized, plus a
   * `data-testid="agent-start-stream"` button that drives one live turn through `liveParts`/
   * `liveStatus`, for `anchorTo: 'end'` + `followOnAppend` against a real scroll.
   */
  mode?: 'virtualized' | 'inlineRow' | 'anchorToEnd'
}

/**
 * Card chrome by container width (docs/DESIGN-CORE.md § Layout, elevation, shapes). One `StatCard` (production-length value,
 * subtitle) per width, each in a wrapper of exactly that many px, plus a `ChartCard` in a
 * 400px-tall grid row. Exists because `@container` outcomes are a layout fact happy-dom cannot see.
 */
export type CardsSpec = {
  /** One StatCard per entry, in a wrapper this many px wide (`data-testid="card-<w>"`). */
  widths: number[]
  /** Adds a ChartCard inside `data-testid="stretch-row"` with a short body, in a grid row this many px tall. */
  stretchedRow?: number
  /** A `divided` `StatGroup` of four cards in a wrapper this many px wide (`data-testid="group"`). */
  groupWidth?: number
  /**
   * A `StatGroup cols={5}` per width, each in a wrapper of exactly that
   * many px (`data-testid="grid-probe-<w>"`) — the `basalt-grid` container boundaries, measured.
   */
  gridProbes?: number[]
  /**
   * A SHORT, auto-height `ChartCard` with a full title+subtitle+value+delta+actions header — the
   * `/charts` Primitives "Availability"/"Negotiated link speed" shape (wave 8's header-economy law,
   * `docs/waves/PLAN.md`). Rendered at `data-testid="card-short"`, NOT stretched by a grid row, so
   * the card's own height is whatever the header + `bodyHeight` naturally sum to.
   */
  shortHeader?: { width: number; bodyHeight: number }
  /**
   * The same "Availability" header shape as {@link shortHeader}, once per `bodyHeights` entry, each
   * in its own `data-testid="card-osc-<bodyHeight>"` wrapper — a scan across the band where the
   * card's own measured height straddles `CARD_SHORT_HEIGHT` (280px), where the short flag used to
   * self-referentially oscillate forever (`docs/waves/PLAN.md` wave 3, P0-1: the flag folds the
   * header, which changes the card's own measured height, which can flip the flag back).
   */
  oscillationScan?: { width: number; bodyHeights: number[] }
  /**
   * StatCard footprint probes (SPEC § 6.1): `data-testid="foot-natural"` holds four 240px cards in a
   * NON-stretching flex row — a visual + footer, a visual only, a footer only, neither — so each
   * card's own height is measurable; `data-testid="foot-grid"` holds three of them in a `StatGroup`
   * grid row, where the row must stretch them to one height. `data-testid="foot-right-pending"` and
   * `"foot-right-ready"` hold the same `sparklinePlacement="right"` card pending and ready.
   */
  footprint?: true
  /**
   * A `ChartCard` with `info` AND `subtitle` per width (`data-testid="fold-<w>"`): the folded note must
   * show inside the open top-layer bubble below 480px and stay hidden from 480px.
   */
  foldNote?: number[]
}

/**
 * `FormRow` at fixed container widths (`docs/waves/PLAN.md` wave 5, n2) — one `data-testid="form-
 * row-<w>"` wrapper per width, since the label/control swap keys on the row's OWN measured width
 * via `@container`, a layout fact happy-dom cannot see.
 */
export type FormsSpec = {
  widths: number[]
}

/** The `TocSpec` fixture's sticky title bar height, which is also each heading's `scroll-margin-top`. */
export const TOC_SCROLL_MARGIN_PX = 48

/**
 * A `TableOfContents` beside an article in the shell body — the scroll-spy's only real-geometry
 * test. The article scrolls inside Main under a STICKY title bar and its headings carry a
 * `scroll-margin-top`, so a clicked heading comes to rest ABOVE the spy's activation band.
 */
export type TocSpec = {
  /** Section count; every section but the last is `sectionHeight` tall. */
  sections: number
  sectionHeight: number
  /** The last section's height — short enough that the scrollport bottoms out first. */
  lastHeight: number
}

export type FixtureSpec = {
  sections: SectionSpec[]
  /**
   * Renders the Meter / BarList probes (`data-testid="dash-*"`) at fixed container widths:
   * a BarList with a long label and a secondary column, its skeleton and empty states, a wrapping
   * segment Meter and a forecast Meter in a narrow box, and StatCards holding a Meter or a plain
   * sparkline node in the visual slot (bleed, and right).
   */
  dash?: true
  nav?: { maxTabs?: number; menuMax?: number; moreLabel?: string }
  /** −3..+3 density knob. Every touch-target floor must hold at every level. */
  density?: BasaltDensityLevel
  /**
   * `false` builds every destination WITHOUT an `icon` — a consumer shipping no icon dependency,
   * which basalt supports. The active pill is the icon slot's own background, so this is the shape
   * that used to collapse it to a 24x4px dash.
   */
  icons?: boolean
  /** −5..+5 radius knob. */
  radius?: BasaltRadiusLevel
  colorScheme?: 'light' | 'dark'
  /** Filler height in px above the `[data-testid="content-end"]` sentinel. */
  bodyHeight?: number
  /** Renders a `BasaltDataTable` above the filler. Omitted ⇒ no table in the tree. */
  table?: TableSpec
  /** Renders every Button size x variant with no / a left / a right section (`button-section`). */
  buttonSections?: true
  /** Renders disabled Buttons and every Badge flavour the Wave 37 chrome decides (`chrome-w37`). */
  chromeW37?: true
  /** Renders a `PageBar` carrying real controls. Omitted ⇒ no bar of its own (see `aside`). */
  bar?: BarSpec
  /** Renders a `StatGroup` of this many `StatCard`s, each with a bled `BarSparkline`. */
  stats?: number
  /**
   * Gives every KPI a PRODUCTION-LENGTH value (`$12,847,301.55`) instead of the four-digit
   * stand-in. Opt-in for the same reason `BarSpec.actionIcons` is: the phone sweeps were measured
   * against the short values. It is the precondition for observing a clamp at all — `.value`
   * ellipsizes, so a column one tier too narrow is invisible until the number is long enough to
   * reach the edge (`fixtures.tsx`'s `WIDE_STAT_VALUES` states the measured widths).
   */
  statsWide?: true
  /**
   * Renders the theme-owned card inset probes (`data-testid="inset-*"`): a bare Card and Paper, a
   * flush Card, a Card with a `Card.Section`, and a Card whose own class sets `padding: 0`.
   */
  cardInset?: true
  /** Renders card-chrome probes: StatCards at fixed container widths, a stretched ChartCard. */
  cards?: CardsSpec
  /** A `StatCard` with `info` + `tone` (`data-testid="info-ring-stat"`) — the info glyph's focus-ring probe. */
  infoRing?: true
  /** An argo-shaped `ChartCard` with a long `info`, `facts` and a basis line (`data-testid="info-header"`) — the bubble-vs-header probe. */
  infoHeader?: true
  /** A Mantine `Button size="xs" variant="default"` beside the shared `RetryButton` (`data-testid="retry-mantine"` / `"retry-shared"`). */
  retryParity?: true
  /** Wave 38: zone-keyed charts at a 340px card (`w38-*`) and a strip-cell sparkline at 150px (`w38-strip`). */
  w38Legend?: true
  /** Four `ChartCard`s around a `BarList`: loaded, loading, empty, error, each at two widths (`data-testid="list-<state>-<narrow|wide>"`). */
  barListStates?: true
  /** Wave 38: a facts `ChartCard` over a chart and over a `content` list, at rest and pending (`w38-load-<chart|list>-<rest|loading>`). */
  w38Loading?: true
  /** Wave 38: `Bars` and a `Sparkline` in a StatCard slot each (`w38-bars-card`, `w38-spark-card`) and in a strip cell (`w38-bars-strip`, `w38-spark-strip`). */
  w38BarsSlot?: true
  /** Wave 41: argo's Reading pace strip cell, a slotted `Bars` at focus (`w41-chip-strip`). */
  w41ChipStrip?: true
  /** Wave 43: a table with one `danger` icon row action and one plain one (`w43-danger`). */
  w43Danger?: true
  /** Wave 38: argo's ACWR load Meter (four zones, one `short`) in a 5-col strip cell (`w38-acwr-strip`). */
  w38Zones?: true
  /** Wave 38: strip cells, Meters and a forecast Meter loaded and loading side by side, a StatGroup's hero sizes (`w38l-*`). */
  w38StripMeter?: true
  /** Wave 39: argo's Garmin ACWR strip (`w39-garmin`), Agents oldest-wait strip (`w39-agents`) and a wide ACWR Meter (`w39-home`). */
  w39Meter?: true
  /** Wave 38: a high-line Sparkline in a 150px strip cell and card (`w38r2-strip`, `w38r2-card`), a slotted `Bars` (`w38r2-bars`) and two `ChartCard` line charts (`w38r2-lines-narrow`, `w38r2-lines-wide`). */
  w38Readout2?: true
  /** Wave 39: a mixed one-row strip (Meter, Sparkline, Bars, a wrapping qualifier, a footer `under`) and a multi-row cell with row Sparklines (`w39-strip`, `w39-rows`). */
  w39Strip?: true
  /** Wave 42: a table with a sorted and an unsorted header and an entity beside a text cell in a narrow box (`w42-kinds`). */
  w42Kinds?: true
  /** Wave 42: a 4-column kinded table with an active facet pill and a pager; `loading` shows its skeleton; `pinned: true` is a sticky-header card, `'striped-page'` a striped table on the page (`w42-states`). */
  w42States?: { loading?: true; empty?: true; pinned?: true | 'striped-page'; longError?: true }
  /** Wave 42: argo's workouts table and S2's sessions table in a fixed-width card (`w42-responsive`). */
  w42Responsive?: {
    /** argo's workouts (no `meta.priority`) or the playground's S2 sessions. */
    shape: 'workouts' | 'sessions'
    /** The card's width in px; omitted ⇒ the shell body's own width. */
    width?: number
    /** `isLoading` skeleton rows instead of data. */
    loading?: true
    /** Render on the page surface instead of inside a card. */
    onPage?: true
    /** A button that flips the mounted table into `isLoading` and back (a refetch). */
    reload?: true
  }
  /** Wave 39: a tall tooltip in a short `ChartCard` (`w39-tip`, `w39-tip-tall`), a slotted `Bars` in a strip cell (`w39-strip`), a 28px bare `Sparkline` (`w39-spark`). */
  w39Readout?: true
  /**
   * Renders a `CodeBlock` in a `Prose` between `data-testid="codeblock-before"` and
   * `"codeblock-after"` paragraphs, over a long first line. `language` defaults to `'ts'`; pass
   * `null` for the plain-`<pre>` fallback state. `showCopy: false` drops the button.
   */
  codeBlock?: { title?: string; language?: string | null; showCopy?: false }
  /** Renders `FormRow` container-width probes (n2). */
  forms?: FormsSpec
  /**
   * A `PageBar` + three tall `Section id="anchor-1..3"` blocks. `shell: false` renders them with
   * NO `BasaltShell` (the documented single-page shape, the document is the scrollport); `true`
   * renders them as shell children. Exists for the anchor-clearance invariant.
   */
  anchor?: { shell: boolean }
  /**
   * Wave 37's shell half (`data-testid="w37-*"`): a `PageSummary` whose facts wrap, a page-scope
   * `SyncButton` with an age, a 5-option `ViewTabs` (phone `Select`), a filter pill over a very long
   * option name, and an untitled `Section` (tabs only). Each item renders only when named.
   */
  w37?: {
    summary?: true
    sync?: true
    phoneSelect?: true
    pill?: true
    untitled?: true
    alertCode?: true
    cardTabs?: true
    radiusTabs?: true
  }
  /**
   * Wave 38: argo's Strength-page Section shells. `data-testid="w38-strength-plain"` is a titled
   * Section over two `ChartCard`s (title + info, a three-series `Lines` with a legend);
   * `w38-strength-diagnostics` is a collapsible Section with an `xs` `Text` summary over one card.
   */
  w38Strength?: true
  /**
   * Wave 38: argo's Section subtitle and summary. `w38-subtitle-head` is a titled Section with a
   * `subtitle`, a `count` and a 13 body; `w38-subtitle-backlog` is argo's reading backlog shell: a
   * bare `Text` summary sized by the consumer's own class (13) over rows with a 12 meta line.
   */
  w38Subtitle?: true
  /** Renders a `PageAside` (and, by default, the `PageBar` row 2 it projects into below `sm`). */
  aside?: AsideSpec
  /** A `TableOfContents` + article inside Main's scrollport (the scroll-spy invariants). */
  toc?: TocSpec
  /** Renders one `basalt-ui/charts` kind above the filler. Omitted ⇒ no chart in the tree. */
  charts?: ChartsSpec
  /** Renders a `basalt-ui/agent-chat` transcript above the filler. Omitted ⇒ no transcript. */
  agent?: AgentSpec
  /** Renders a button (`data-testid="open-confirm"`) opening `overlays.confirm`. */
  confirm?: true
  /** `BasaltShell`'s `headerHeight` in px. Omitted ⇒ the token default. */
  headerHeight?: number
  /** Fills the sidebar's pinned FOOTER region, which otherwise does not render at all. */
  sidebar?: SidebarSpec
  /**
   * How many `globalActions` ride the header's trailing cluster.
   *
   * Omitting it renders NO `.global` node at all (`HeaderGlobalActions` returns `null` on an empty
   * list), which is exactly the shape that made the desktop header row look roomier here than on
   * any real page: production spends ~100px there before the page's own actions get a pixel.
   */
  globals?: number
}

declare global {
  interface Window {
    /** Mounts `spec`; resolves after the React commit and two animation frames. */
    basaltMountFixture: (spec: FixtureSpec) => Promise<void>
    /** Paths the fixture anchor swallowed, newest last. Reset on every mount. */
    basaltNavigations: string[]
    /**
     * The aside probe's mount census — `live` is how many instances exist now (a responsive twin
     * reads 2), `total` the page-lifetime ordinal (a remount reads 2 while `live` stays 1). Reset
     * on every mount, so a test may read it while nothing is mounted at all.
     */
    basaltAsideMounts: { total: number; live: number }
  }
}
