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
      "The server SVG is drawn at the engine's default 640 x 320: `packages/basalt-ui/src/charts/host.tsx` passes the engine `initialWidth` only, `@tanstack/charts` then takes `initialHeight = options.height ?? 320` (its `adapter-shared.js`), while the CSS box is the declared height, so the picture is scaled down and letterboxed (the band strip shrinks to a sliver). Measured 2026-11-20 with host.tsx also passing a numeric `height` (an uncommitted probe): the 1440 diff fell to 2.8% lines, 2.2% bars, 3.0% CartesianChart, 7.0% Heatmap, 0% IntervalTrack and 2.8% BandStrip, the rest being axis gutters the engine sizes from text it measures in the browser; at 390 the 640 server width stays wrong (8 to 55%). The fix: pass the box height, give the server a width (a declared width or the container class's), and size gutters from basalt's generated label widths on both sides. Sparkline draws its own SVG and is static-clean already. Hover on top is the same kind as a client:visible island; the engine is most of its 100 to 120 kB further cost.",
    row: 'astro-chart-server-picture',
  },
  {
    parts: ['code-block', 'markdown'],
    cause:
      'Shiki highlights in the browser after mount: the static page shows the code uncoloured (1 to 5% of pixels). Highlighted on the server, a static page ships coloured code with no JavaScript, and the copy button is the one thing left for an island.',
    row: 'astro-server-highlight',
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
