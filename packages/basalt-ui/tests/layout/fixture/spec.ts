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
  /** What a consumer passes for WINDOW scroll (app header + `PageBar` row 2). */
  stickyHeaderOffset?: number | string
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
}

declare global {
  interface Window {
    /** Mounts `spec`; resolves after the React commit and two animation frames. */
    basaltMountFixture: (spec: FixtureSpec) => Promise<void>
    /** Paths the fixture anchor swallowed, newest last. Reset on every mount. */
    basaltNavigations: string[]
  }
}
