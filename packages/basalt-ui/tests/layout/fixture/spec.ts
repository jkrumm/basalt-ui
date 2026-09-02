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
export type SectionSpec = { label: string; items: ItemSpec[]; tab?: true }

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
  /** How many row-1 actions ride the header portal. */
  actions?: number
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
 * One chart from `basalt-ui/charts`, mounted in the shell body. Exists for the invariants happy-dom
 * cannot see at all: measured margins, the phone-tier tick font, a real pointer-driven tooltip
 * anchor, and the plot-floor/legend-rollup arithmetic in `chart-frame-layout.ts` — all of them
 * ResizeObserver- and getBoundingClientRect-driven (`docs/CHARTS-SPEC.md` §1, §6, §8).
 */
export type ChartsSpec = {
  /** A real kind from `basalt-ui/charts` — never a hand-rolled stand-in. */
  kind: 'multiLine' | 'bars' | 'heatmap' | 'donut'
  /** Number of series (legend entries) `multiLine`/`bars`/`donut` draw. Default 3. */
  legendEntries?: number
  /** Fixed height in px, forwarded to the kind. Default 240 (the kind's own default). */
  height?: number
  /** Fill the parent's measured height instead of a fixed one — `heatmap` only exposes this. */
  fill?: boolean
  /** height = round(containerWidth / aspectRatio) — `heatmap` only exposes this. */
  aspectRatio?: number
  /** Wraps the chart in a fixed-height container of this many px, so `fill` has a real box to
   * fill. Omitted ⇒ the chart sits in the shell body's normal flow. */
  containerHeight?: number
  /** `'short'` (the kind's own default `fmtAxisDate`) or `'wide'` — an unavoidably wide label
   * (`'Mar 08 14:00'`-shaped) that forces the §1 tick-spacing/rotation laws to actually fire. */
  formatX?: 'short' | 'wide'
  /** Forwarded verbatim — `0` opts out of the phone tier's auto-rotation, `45`/`90` forces it. */
  xLabelRotate?: 0 | 45 | 90
}

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

export type FixtureSpec = {
  sections: SectionSpec[]
  nav?: { maxTabs?: number; menuMax?: number; moreLabel?: string }
  /** −3..+3 density knob. Every touch-target floor must hold at every level. */
  density?: number
  /**
   * `false` builds every destination WITHOUT an `icon` — a consumer shipping no icon dependency,
   * which basalt supports. The active pill is the icon slot's own background, so this is the shape
   * that used to collapse it to a 24x4px dash.
   */
  icons?: boolean
  /** −5..+5 radius knob. */
  radius?: number
  colorScheme?: 'light' | 'dark'
  /** Filler height in px above the `[data-testid="content-end"]` sentinel. */
  bodyHeight?: number
  /** Renders a `BasaltDataTable` above the filler. Omitted ⇒ no table in the tree. */
  table?: TableSpec
  /** Renders a `PageBar` carrying real controls. Omitted ⇒ no bar of its own (see `aside`). */
  bar?: BarSpec
  /** Renders a `StatGroup` of this many `StatCard`s, each with a bled `BarSparkline`. */
  stats?: number
  /** Renders a `PageAside` (and, by default, the `PageBar` row 2 it projects into below `sm`). */
  aside?: AsideSpec
  /** Renders one `basalt-ui/charts` kind above the filler. Omitted ⇒ no chart in the tree. */
  charts?: ChartsSpec
  /** Renders a `basalt-ui/agent-chat` transcript above the filler. Omitted ⇒ no transcript. */
  agent?: AgentSpec
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
