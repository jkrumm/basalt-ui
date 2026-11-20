/**
 * What the measurements alone cannot say: the cause of a difference, read from the source, and the plan row
 * (docs/plan.yaml) that fixes it where the part should not need JavaScript for its picture. scripts/matrix.ts
 * prints each finding under the numbers; one whose parts have all become static-clean is printed as resolved,
 * so the record shows when it can be deleted.
 */
export type Finding = {
  /** Part ids (src/parts/<family>/index.ts), or \`*\` for every page. */
  parts: readonly string[] | '*'
  /** The cause, with the file that carries it. */
  cause: string
  /** The plan row key that carries the fix; none where the part needs JavaScript or a router by contract. */
  row?: string
}

const CHART_KINDS = [
  'lines',
  'bars',
  'cartesian-chart',
  'chart-card',
  'heatmap',
  'interval-track',
  'band-strip',
]

export const FINDINGS: readonly Finding[] = [
  {
    parts: CHART_KINDS,
    cause:
      "Correct at the declared width: the server SVG is drawn for the frame the server assumes (`INITIAL_WIDTH`, 640 px, in `packages/basalt-ui/src/charts/sizing.ts`; a `ChartCard` less its two 16 px edges) at the height the box resolves to there (`boxHeightAt` in `box.tsx`, handed to the engine on the server pass only, in `host.tsx`), and the engine measures text from basalt's generated label widths on both sides (`text-measure.ts`), so at 1440 the static picture is the hydrated one to the pixel. The residual is at 390: the box there is 342 px, narrower than the 640 px the server drew for, and HTML rendered before any browser cannot know the viewport, so the browser scales the 640 px picture into the box (the svg's viewBox), with smaller text and a letterbox, until an island redraws it at its measured width; a page with no island keeps the scaled picture. Two more boxes the server cannot know draw the same way: a `fill` box (a ChartCard with `height: 'fill'`, a Heatmap that fills its parent), whose height is its parent's, gets the engine's 320 px; a coarse pointer's 45svh cap on the box is the viewport's. Sparkline draws its own SVG, scaled per axis, and is static-clean at every width. Hover on top is the same kind as a client:visible island; the engine is most of its 100 to 120 kB further cost.",
  },
  {
    parts: ['inner-nav', 'split-page', 'controls', 'control-home', 'app-shell'],
    cause:
      'App parts: they read field handles or the registered nav from a TanStack Router (no router: "Cannot read properties of null (reading \'stores\')", "Invalid value used as weak map key"), on the server and in the browser alike. They are not island parts by contract; an Astro page uses links and the site profile instead.',
  },
  {
    parts: ['connection-indicator'],
    cause: 'Reads `useConnection`, which needs a QueryClient: an app part, not an island part.',
  },
  {
    parts: ['refresh-button'],
    cause:
      "The age text is relative to the browser's clock and absent until hydration; a static page cannot know it.",
  },
  {
    parts: ['dock'],
    cause: 'The dock takes focus on mount: the focus ring is the whole difference (0.03%).',
  },
]

/** Why an export is in no demo: it renders only inside an open overlay or a queued toast, which no static page shows. */
export const UNCOVERED_WHY =
  'they render only inside an open dialog or sheet, a queued toast or an open combobox, which a page at rest never shows'
