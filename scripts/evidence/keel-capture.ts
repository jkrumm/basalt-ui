/* oxlint-disable no-console -- CLI entry point: progress goes to the terminal */
/* oxlint-disable unicorn/consistent-function-scoping -- functions run inside the page and must be self-contained */
/**
 * `bun scripts/evidence/keel-capture.ts [--stage routes|patterns|scales|all]` — look-only capture of the
 * Keel Workspace benchmark: screenshots plus measured numbers and colour roles. Nothing of Keel's
 * DOM, CSS, JS, assets or copy is written to a file; the only Keel-derived artefacts are PNGs (under
 * the gitignored `.design-parity/keel/`) and committed JSON of numbers and role names. Sequential,
 * one page at a time, with a pause between navigations.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import type { Locator, Page } from 'playwright-core'
import { IMG_KEEL, PARITY_DIR } from './paths'

const ORIGIN = 'https://keel-workspace.vercel.app'
/** Crop paths recorded in inventory.json: repo-root-relative. */
const IMG_REL = '.design-parity/keel'
const OUT = join(PARITY_DIR, 'keel')
/** `view` re-selects an alternate view of the same path (a board/table or board/list toggle). */
type Route = { path: string; slug: string; view?: string }
const ROUTES: readonly Route[] = [
  { path: '/', slug: 'root' },
  { path: '/crew', slug: 'crew' },
  { path: '/crew#scout', slug: 'crew-scout' },
  { path: '/records/companies', slug: 'records-companies' },
  { path: '/records/people', slug: 'records-people' },
  { path: '/records/deals', slug: 'records-deals' },
  { path: '/records/deals', slug: 'records-deals-table', view: 'main [role=radio] >> nth=1' },
  { path: '/records/companies/oakline-freight', slug: 'records-companies-oakline-freight' },
  { path: '/work', slug: 'work' },
  { path: '/work', slug: 'work-list', view: 'main [role=radio] >> nth=1' },
]
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
] as const
const SCHEMES = ['dark', 'light'] as const
type Viewport = (typeof VIEWPORTS)[number]
type Scheme = (typeof SCHEMES)[number]
const FULL_PAGE_CAP = 3600
const PAUSE_MS = 600
const READY_TIMEOUT_MS = 10_000

/** Per-route and per-pattern failures; any entry fails the run after everything else is written. */
const failures: string[] = []

const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ── Navigation ────────────────────────────────────────────────────────────────────────────────

/** Navigates and waits for the app to render. Returns the readiness marker: the page shell has a
 * visible main region with at least one heading, link or button in it. A page that never reaches it
 * is unverified, never "absent". */
async function settle(page: Page, route: Route): Promise<boolean> {
  await page.goto(ORIGIN + route.path, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await pause(PAUSE_MS)
  const ready = await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('main h1, main a, main button')].some((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        }),
      undefined,
      { timeout: READY_TIMEOUT_MS },
    )
    .then(
      () => true,
      () => false,
    )
  if (ready && route.view) {
    await page.locator(route.view).click()
    await pause(PAUSE_MS)
  }
  return ready
}

/** The shell scrolls an inner container, so `fullPage` alone sees one viewport. Grow the viewport to
 * the container's content height (capped), shoot, restore. */
async function shootFull(page: Page, vp: Viewport, file: string): Promise<number> {
  const needed = await page.evaluate(() => {
    let best = 0
    for (const el of document.querySelectorAll<HTMLElement>('*')) {
      const overflow = getComputedStyle(el).overflowY
      if (overflow !== 'auto' && overflow !== 'scroll') continue
      const extra = el.scrollHeight - el.clientHeight
      if (extra > best) best = extra
    }
    return Math.max(best + window.innerHeight, document.documentElement.scrollHeight)
  })
  const height = Math.min(Math.max(needed, vp.height), FULL_PAGE_CAP)
  try {
    await page.setViewportSize({ width: vp.width, height })
    await pause(300)
    await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' })
  } finally {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await pause(200)
  }
  return needed
}

// ── Stage 1: routes ───────────────────────────────────────────────────────────────────────────

async function captureRoutes(open: (v: Viewport, s: Scheme) => Promise<Page>): Promise<number> {
  const dir = join(IMG_KEEL, 'routes')
  await rm(dir, { recursive: true, force: true }) // an orphan PNG must never survive a re-run
  await mkdir(dir, { recursive: true })
  let count = 0
  for (const scheme of SCHEMES) {
    for (const vp of VIEWPORTS) {
      const page = await open(vp, scheme)
      try {
        for (const route of ROUTES) {
          const label = `${route.slug} ${scheme} ${vp.name}`
          try {
            if (!(await settle(page, route))) throw new Error('route did not render')
            const base = join(dir, `${route.slug}--${scheme}--${vp.name}`)
            await page.screenshot({ path: `${base}.png`, animations: 'disabled', caret: 'hide' })
            const needed = await shootFull(page, vp, `${base}--full.png`)
            count += 2
            console.log(`routes ${label} (content ${needed}px)`)
          } catch (error) {
            failures.push(`routes ${label}: ${error instanceof Error ? error.message : error}`)
          }
        }
      } finally {
        await page.context().close()
      }
    }
  }
  return count
}

// ── Stage 2: patterns ─────────────────────────────────────────────────────────────────────────

type PatternDef = {
  id: string
  name: string
  route: string
  /** Playwright selector over structure only (tags, roles, relations) — never class names. */
  selector: string
  /** Which visible match is the representative one. */
  pick?: number
  /** Row-like patterns report their height as `rowHeight`. */
  rowLike?: boolean
  selectorNote: string
  notes: string
  /** Selector to click first on mobile, when the pattern lives behind a drawer. */
  mobileOpen?: string
}

const BOARD = 'main section:has(> header)'
const PATTERNS: readonly PatternDef[] = [
  {
    id: 'metric-card',
    name: 'KPI card with a sparkline and delta',
    route: '/',
    selector: 'main section > div > a',
    pick: 1,
    selectorNote:
      'second link-card in the grid of six KPI tiles directly under the greeting header; the tile with a compact trend line',
    notes:
      'Tiles in the strip differ by inline visual: ring gauge, trend line, segmented bar, equalizer bar, stacked bar, event dots. The label row pairs an uppercase mono caption with a muted qualifier on the right.',
  },
  {
    id: 'metric-card-gauge',
    name: 'KPI card with a ring gauge',
    route: '/',
    selector: 'main section > div > a',
    pick: 0,
    selectorNote: 'first tile of the KPI strip on the home route',
    notes:
      'Gauge replaces the sparkline; the value sits centred inside the arc and a footnote runs below.',
  },
  {
    id: 'metric-card-bar',
    name: 'KPI card with a segmented progress bar',
    route: '/',
    selector: 'main section > div > a',
    pick: 2,
    selectorNote: 'third tile of the KPI strip on the home route',
    notes:
      'A thin multi-segment bar carries a target and a forecast split; axis captions sit under it in mono type.',
  },
  {
    id: 'decision-card',
    name: 'Decision card with an inline preview pane',
    route: '/',
    selector: 'main article',
    pick: 1,
    selectorNote:
      'second article in the primary column of the home route (the first is the emphasised one)',
    notes:
      'Two-column grid: actor line, question title, linked record and facts on the left; a recessed preview or chart panel on the right; action row of one filled, one outlined and one ghost button below. The first card of the list is emphasised with an accent outline instead of a border.',
  },
  {
    id: 'entity-card',
    name: 'Agent profile card with a stats panel',
    route: '/crew',
    selector: 'main article',
    pick: 0,
    selectorNote: 'first article in the three-column card grid on the crew route',
    notes:
      'Header with avatar, name, status and a menu; a 2x2 recessed stat panel (each cell: mono caption, large figure, small inline visual); a status line; a three-way segmented control; a one-line description.',
  },
  {
    id: 'table-header',
    name: 'Data table header row',
    route: '/records/companies',
    selector: 'thead tr',
    rowLike: true,
    selectorNote: 'the header row of the only table on the companies route',
    notes:
      'Sticky, same fill as the surface, no divider colour contrast beyond a hairline; sortable columns show a small arrow.',
  },
  {
    id: 'table-row',
    name: 'Data table body row',
    route: '/records/companies',
    selector: 'tbody tr',
    pick: 1,
    rowLike: true,
    selectorNote: 'second body row of the table on the companies route',
    notes:
      'Cells: selection checkbox, entity chip with avatar, stage pill, owner chip, right-aligned figure, health meter with delta, last-touch chip, linked next step with date.',
  },
  {
    id: 'kanban-column',
    name: 'Work board column',
    route: '/work',
    selector: BOARD,
    pick: 0,
    selectorNote: 'first section on the work route that opens with a header element',
    notes:
      'Header: status glyph, title, count, right-aligned summary figures; cards stack with a small gap; the column scrolls on its own.',
  },
  {
    id: 'kanban-card',
    name: 'Work board card',
    route: '/work',
    selector: `${BOARD} li > article`,
    pick: 0,
    selectorNote: 'first card inside the first board column of the work route',
    notes:
      'Actor and type line, title, linked record, status line with icon. Variants add a progress bar or an inline preview.',
  },
  {
    id: 'pipeline-column',
    name: 'Deal pipeline column',
    route: '/records/deals',
    selector: BOARD,
    pick: 0,
    selectorNote: 'first board column on the deals route (board view is the default)',
    notes:
      'Header adds a stage glyph, an aggregate amount and a thin progress bar under the title row.',
  },
  {
    id: 'deal-card',
    name: 'Deal card',
    route: '/records/deals',
    selector: `${BOARD} li > a`,
    pick: 0,
    selectorNote: 'first link-card of the first column on the deals route',
    notes:
      'Title and amount on one row, subtitle with a status qualifier, then a health meter, owner chip and date, then a divider and a one-line next step.',
  },
  {
    id: 'timeline-event',
    name: 'Record timeline event',
    route: '/records/companies/oakline-freight',
    selector: 'main ol > li:has(p)',
    pick: 0,
    selectorNote: 'first list item of the ordered timeline in the record detail route',
    notes:
      'Avatar on a vertical rail, a bold actor plus sentence line with a right-aligned mono time, a muted body line, an evidence chip row. Day group labels separate runs.',
  },
  {
    id: 'activity-item',
    name: 'Activity stream item',
    route: '/',
    selector: 'aside section:nth-of-type(2) li > a',
    pick: 0,
    rowLike: true,
    selectorNote: 'first entry of the second panel in the right-hand column of the home route',
    notes:
      'Actor avatar, a one-line sentence with a trailing relative time, and a second line with a record chip and muted context.',
  },
  {
    id: 'schedule-item',
    name: 'Meeting list item',
    route: '/',
    selector: 'aside section:nth-of-type(1) li > a',
    pick: 0,
    rowLike: true,
    selectorNote: 'first entry of the first panel in the right-hand column of the home route',
    notes:
      'Time and duration stack on the left, a title row with record chip and a relative pill, a subtitle, a status on the right.',
  },
  {
    id: 'form-field',
    name: 'Search input',
    route: '/records/companies',
    selector: 'main input',
    pick: 0,
    selectorNote: 'first text input in the toolbar above the table on the companies route',
    notes: 'Recessed fill, leading icon, trailing keyboard hint, no visible border at rest.',
  },
  {
    id: 'filter-toolbar',
    name: 'List toolbar',
    route: '/records/companies',
    selector: 'main input >> xpath=../..',
    pick: 0,
    selectorNote:
      'the flex row that holds the search input, the filter button and the sort and group controls',
    notes: 'One row of 28 px controls with 8 px gaps; right-aligned secondary controls.',
  },
  {
    id: 'nav-item',
    name: 'Sidebar navigation item',
    route: '/work',
    selector: 'a[href="/work"]',
    pick: 0,
    rowLike: true,
    selectorNote: 'the sidebar link whose path is the current route (active state)',
    notes:
      'Leading icon, label, optional trailing count; active state is a raised fill, no accent bar.',
    mobileOpen: 'button[aria-label]:visible >> nth=0',
  },
  {
    id: 'nav-item-idle',
    name: 'Sidebar navigation item, idle',
    route: '/work',
    selector: 'a[href="/crew"]',
    pick: 0,
    rowLike: true,
    selectorNote: 'a sidebar link that is not the current route',
    notes: 'Same anatomy as the active item with a muted label and no fill.',
    mobileOpen: 'button[aria-label]:visible >> nth=0',
  },
  {
    id: 'empty-state',
    name: 'Empty / invitation tile',
    route: '/crew',
    selector: 'main div:has(> article) > :not(article)',
    pick: 0,
    selectorNote: 'the one non-card tile in the agent card grid',
    notes:
      'Dashed or flat tile with a row of four glyph buttons, a title, one muted sentence and a secondary button; centred.',
  },
  {
    id: 'page-header',
    name: 'Page header',
    route: '/work',
    selector: 'main h1 >> xpath=../..',
    pick: 0,
    selectorNote: 'the grandparent of the primary heading on the work route',
    notes:
      'Large headline plus a one-line summary with inline emphasis; a right-aligned live-status line.',
  },
  {
    id: 'record-header',
    name: 'Record header with avatar and facts',
    route: '/records/companies/oakline-freight',
    selector: 'main h1 >> xpath=../../..',
    pick: 0,
    selectorNote: 'the block three levels above the primary heading on the record detail route',
    notes:
      'Large avatar tile, title with two small badges, a mono domain plus facts line; right side holds owner chip, link button and primary action.',
  },
  {
    id: 'stat-strip',
    name: 'Record stat strip',
    route: '/records/companies/oakline-freight',
    selector: 'main ol >> nth=1 >> xpath=../..',
    pick: 0,
    selectorNote: 'the four-cell grid under the record header (grandparent of the stage stepper)',
    notes:
      'Four cells divided by 1 px gaps over a faint fill; a full-width next-step row sits below.',
  },
  {
    id: 'stat-cell',
    name: 'Record stat cell',
    route: '/records/companies/oakline-freight',
    selector: 'main ol >> nth=1 >> xpath=..',
    pick: 0,
    selectorNote: 'the first cell of the record stat strip (holds the stage stepper)',
    notes:
      'Mono uppercase caption, then the figure or stepper; qualifier text right-aligned on the caption row.',
  },
  {
    id: 'side-panel-card',
    name: 'Side panel card with list',
    route: '/records/companies/oakline-freight',
    selector: 'main aside > section',
    pick: 1,
    selectorNote: 'second section of the right-hand column on the record detail route',
    notes:
      'Header row with title, count and an action glyph; list items are 8 px-radius rows with leading avatar, title, meta line and trailing glyph.',
  },
  {
    id: 'segmented-control',
    name: 'Segmented control',
    route: '/records/companies/oakline-freight',
    selector: '[role=radiogroup]',
    pick: 0,
    selectorNote: 'first radio group on the record detail route (the timeline filter)',
    notes: 'Recessed track with 2 px inset, selected segment raised; 24 px segments, 6 px radius.',
  },
  {
    id: 'tab-bar',
    name: 'List view tabs',
    route: '/records/companies',
    selector: '[role=tablist]',
    pick: 0,
    selectorNote: 'the first tab list on the companies route (the view tabs with counts)',
    notes:
      'Underline tabs with a trailing count; the active tab carries a 2 px bar and brighter label.',
  },
  {
    id: 'status-pill',
    name: 'Stage pill',
    route: '/records/companies',
    selector: 'tbody tr:first-child td:first-of-type span >> nth=1',
    pick: 0,
    selectorNote: 'the pill inside the first data cell (the stage column) of the first table row',
    notes: 'Tinted fill, 20 px high, 6 px radius, leading mini bar-glyph encoding the stage.',
  },
  {
    id: 'button-primary',
    name: 'Primary action button',
    route: '/',
    selector: 'main article:first-of-type button',
    pick: 0,
    selectorNote: 'first button inside the first decision card',
    notes: 'Filled with the accent; trailing key-hint glyph.',
  },
  {
    id: 'button-secondary',
    name: 'Secondary action button',
    route: '/',
    selector: 'main article:first-of-type button',
    pick: 1,
    selectorNote: 'second button inside the first decision card',
    notes: 'Outlined, transparent fill, leading icon.',
  },
  {
    id: 'button-ghost',
    name: 'Ghost action button',
    route: '/',
    selector: 'main article:first-of-type button',
    pick: 2,
    selectorNote: 'third button inside the first decision card',
    notes: 'No fill, no border, muted label.',
  },
]

/** Runs inside the page: numbers and colour roles for one element and its parts. */
function measureInPage(root: Element, rowLike: boolean): Record<string, number | string> {
  type RGBA = [number, number, number, number]
  const num = (v: string): number => Math.round(parseFloat(v) * 100) / 100
  const srgb = (c: number): number => {
    const v = Math.min(1, Math.max(0, c))
    return Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255)
  }
  const parse = (css: string): RGBA => {
    const nums = (css.match(/-?[\d.]+(?:e-?\d+)?%?/g) ?? []).map((n) =>
      n.endsWith('%') ? parseFloat(n) / 100 : parseFloat(n),
    )
    if (css.startsWith('oklab(') || css.startsWith('oklch(')) {
      let [L = 0, a = 0, b = 0] = nums
      const alpha = nums[3] ?? 1
      if (css.startsWith('oklch(')) {
        const h = (b * Math.PI) / 180
        b = a * Math.sin(h)
        a = a * Math.cos(h)
      }
      const lc = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
      const mc = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
      const sc = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
      return [
        srgb(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc),
        srgb(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc),
        srgb(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc),
        alpha,
      ]
    }
    if (css.startsWith('color(srgb')) {
      const [r = 0, g = 0, b = 0, a = 1] = nums
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), a]
    }
    const [r = 0, g = 0, b = 0, a = 1] = nums
    return [r, g, b, a]
  }
  const over = (top: RGBA, under: RGBA): RGBA => {
    const a = top[3] + under[3] * (1 - top[3])
    if (a === 0) return [0, 0, 0, 0]
    const mix = (i: 0 | 1 | 2): number => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a
    return [mix(0), mix(1), mix(2), a]
  }
  const lum = (c: RGBA): number => {
    const f = (v: number): number => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
  }
  const contrast = (a: RGBA, b: RGBA): number => {
    const [hi, lo] = [lum(a), lum(b)].toSorted((x, y) => y - x) as [number, number]
    return (hi + 0.05) / (lo + 0.05)
  }
  const bgOf = (el: Element | null): RGBA => {
    const layers: RGBA[] = []
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor)
      if (c[3] > 0) layers.push(c)
      if (c[3] >= 0.99) break
    }
    let acc: RGBA = [255, 255, 255, 1]
    for (const l of layers.toReversed()) acc = over(l, acc)
    return acc
  }
  const hueRole = (c: RGBA): string | null => {
    const [r, g, b] = [c[0] / 255, c[1] / 255, c[2] / 255]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    const d = max - min
    if (d < 0.18) return null
    const s = d / (1 - Math.abs(2 * l - 1))
    if (s < 0.35) return null
    let h = 0
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
    if (h < 12 || h >= 330) return 'negative'
    if (h < 38) return 'accent'
    if (h < 70) return 'warning'
    if (h < 170) return 'positive'
    return 'categorical'
  }
  const textRole = (css: string, bg: RGBA): string => {
    const c = over(parse(css), bg)
    const hue = hueRole(c)
    if (hue) return hue
    const onFill = hueRole(bg)
    if (onFill) return `on-${onFill}`
    const ratio = contrast(c, bg)
    if (ratio >= 10) return 'ink'
    if (ratio >= 5.5) return 'ink-muted'
    if (ratio >= 3) return 'ink-subtle'
    return 'ink-faint'
  }
  const lineRole = (css: string, bg: RGBA): string => {
    const ratio = contrast(over(parse(css), bg), bg)
    if (ratio < 1.25) return 'hairline-subtle'
    if (ratio < 1.8) return 'hairline-default'
    return 'hairline-strong'
  }

  const out: Record<string, number | string> = {}
  const rect = root.getBoundingClientRect()
  out['width'] = Math.round(rect.width)
  out['height'] = Math.round(rect.height)
  if (rowLike) out['rowHeight'] = Math.round(rect.height)

  // Table rows keep their box on the cells.
  const box = root.tagName === 'TR' ? (root.children[1] ?? root.firstElementChild ?? root) : root
  const cs = getComputedStyle(box)
  out['paddingTop'] = num(cs.paddingTop)
  out['paddingRight'] = num(cs.paddingRight)
  out['paddingBottom'] = num(cs.paddingBottom)
  out['paddingLeft'] = num(cs.paddingLeft)
  out['radius'] = num(cs.borderTopLeftRadius)

  // Gap: the root's own, else the first flex/grid descendant that declares one.
  const gapOf = (el: Element): number | null => {
    const s = getComputedStyle(el)
    if (s.display !== 'flex' && s.display !== 'grid' && s.display !== 'inline-flex') return null
    const g = num(s.rowGap)
    return Number.isFinite(g) && g > 0 ? g : null
  }
  let gap = gapOf(root)
  if (gap === null) {
    for (const el of root.querySelectorAll('*')) {
      gap = gapOf(el)
      if (gap !== null) break
    }
  }
  if (gap !== null) out['gap'] = gap

  const rootBg = bgOf(box)
  const parentBg = bgOf(box.parentElement)
  const own = parse(cs.backgroundColor)
  const lumDelta = lum(rootBg) - lum(parentBg)
  const bgHue = own[3] > 0 ? hueRole(rootBg) : null
  let backgroundRole = 'surface'
  if (own[3] === 0) backgroundRole = 'transparent'
  else if (bgHue) backgroundRole = `${bgHue}-${own[3] >= 0.9 ? 'fill' : 'tint'}`
  else if (lumDelta > 0.004) backgroundRole = 'surface-raised'
  else if (lumDelta < -0.004) backgroundRole = 'sunken'
  out['backgroundRole'] = backgroundRole

  // Border: a real border, else a 0-blur ring shadow, else none.
  const widths = [
    cs.borderTopWidth,
    cs.borderRightWidth,
    cs.borderBottomWidth,
    cs.borderLeftWidth,
  ].map(num)
  const shadows =
    cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,(?![^(]*\))/).map((s) => s.trim())
  const shadowParts = shadows.map((s) => {
    const color = s.match(/(?:rgba?|oklab|oklch|color)\([^)]*\)/)?.[0] ?? 'rgba(0,0,0,0)'
    const lengths = (s.replace(color, '').match(/-?[\d.]+px/g) ?? []).map(num)
    return {
      color,
      x: lengths[0] ?? 0,
      y: lengths[1] ?? 0,
      blur: lengths[2] ?? 0,
      spread: lengths[3] ?? 0,
    }
  })
  const ring = shadowParts.find((s) => s.x === 0 && s.y === 0 && s.blur === 0 && s.spread > 0)
  const drop = shadowParts.filter((s) => !(s.blur === 0 && s.x === 0 && s.y === 0 && s.spread > 0))
  const maxWidth = Math.max(...widths)
  if (maxWidth > 0) {
    out['borderWidth'] = maxWidth
    out['borderRole'] = lineRole(cs.borderTopColor, rootBg)
  } else if (ring) {
    out['borderWidth'] = ring.spread
    out['borderRole'] = `${lineRole(ring.color, rootBg)} (ring shadow)`
  } else {
    out['borderWidth'] = 0
    out['borderRole'] = 'none'
  }
  const blur = Math.max(0, ...drop.map((s) => s.blur))
  let shadow = 'subtle'
  if (drop.length === 0) shadow = 'none'
  else if (blur >= 16) shadow = 'strong'
  out['shadow'] = shadow
  if (root.tagName === 'TR') {
    // A row's hairline lives on its cells (as a border or an inset shadow), so it is a divider.
    out['shadow'] = 'none'
    const hair = shadowParts[0]
    if (hair) out['dividerRole'] = lineRole(hair.color, rootBg)
    else if (widths[2]! > 0) out['dividerRole'] = lineRole(cs.borderBottomColor, rootBg)
  }

  // Text parts: smallest = label, largest = value, long running text = body.
  type Part = {
    size: number
    weight: number
    lh: number | null
    color: string
    len: number
    bg: RGBA
  }
  const parts: Part[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent ?? '').trim()
    const el = n.parentElement
    if (!text || !el) continue
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    if (r.width === 0 || r.height === 0 || s.visibility === 'hidden') continue
    if (text.length <= 2 && num(s.fontSize) < 9) continue // avatar initials
    const lh = s.lineHeight === 'normal' ? null : num(s.lineHeight)
    parts.push({
      size: num(s.fontSize),
      weight: Number(s.fontWeight),
      lh,
      color: s.color,
      len: text.length,
      bg: bgOf(el),
    })
  }
  if (parts.length > 0) {
    const sizes = [...new Set(parts.map((p) => p.size))]
    const byGroup = (p: Part): string => `${p.size}|${p.weight}`
    const smallest = parts.filter((p) => p.size === Math.min(...sizes))
    const largest = parts
      .filter((p) => p.size === Math.max(...sizes))
      .toSorted((a, b) => b.weight - a.weight)
    const pick = (list: Part[]): Part => list.toSorted((a, b) => b.len - a.len)[0]!
    const write = (prefix: string, p: Part): void => {
      out[`${prefix}Size`] = p.size
      out[`${prefix}Weight`] = p.weight
      if (p.lh !== null) out[`${prefix}LineHeight`] = p.lh
      out[`${prefix}Role`] = textRole(p.color, p.bg)
    }
    if (sizes.length > 1) {
      write('label', pick(smallest))
      write('value', largest[0]!)
    }
    const bodyList = parts.filter((p) => p.len >= 25)
    if (bodyList.length > 0) {
      const counts = new Map<string, number>()
      for (const p of bodyList) counts.set(byGroup(p), (counts.get(byGroup(p)) ?? 0) + 1)
      const top = [...counts.entries()].toSorted((a, b) => b[1] - a[1])[0]![0]
      write(
        'body',
        bodyList.find((p) => byGroup(p) === top)!,
      )
    } else if (sizes.length === 1) {
      write('body', parts[0]!)
    }
  }

  // Icon and chart.
  const svgs = [...root.querySelectorAll('svg')].map((s) => s.getBoundingClientRect())
  const icon = svgs.find((r) => r.width > 0 && r.width <= 32 && Math.abs(r.width - r.height) < 1)
  if (icon) out['iconSize'] = Math.round(icon.width)
  const charts = svgs.filter((r) => r.width >= 40 && r.height >= 14)
  if (charts.length > 0) {
    out['chartHeight'] = Math.round(
      charts.toSorted((a, b) => b.width * b.height - a.width * a.height)[0]!.height,
    )
  }

  // Divider: the first inner or own hairline.
  for (const el of [root, ...root.querySelectorAll('*')].slice(0, 80)) {
    if (root.tagName === 'TR') break
    const s = getComputedStyle(el)
    let side: string | null = null
    if (num(s.borderBottomWidth) > 0) side = s.borderBottomColor
    else if (num(s.borderTopWidth) > 0) side = s.borderTopColor
    if (side && !(el === root && maxWidth > 0 && widths.every((w) => w > 0))) {
      out['dividerRole'] = lineRole(side, bgOf(el))
      break
    }
  }
  return out
}

/** `absent`: the route rendered and no visible match exists. `unverified`: the route never reached
 * the readiness marker or the lookup failed, so nothing is known about the pattern in this slot. */
type SlotStatus = 'absent' | 'unverified'
type Measured = {
  count: number
  metrics: Record<string, number | string>
  crop: string | null
  status?: SlotStatus
}

async function visibleIndex(loc: Locator, pick: number): Promise<{ count: number; index: number }> {
  const visible = await loc.evaluateAll((els) =>
    els.flatMap((el, i) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' ? [i] : []
    }),
  )
  return { count: visible.length, index: visible[pick] ?? -1 }
}

async function measurePattern(
  page: Page,
  def: PatternDef,
  vp: Viewport,
  scheme: Scheme,
  dir: string,
): Promise<Measured> {
  if (vp.mobile && def.mobileOpen) {
    await page.locator(def.mobileOpen).click()
    await pause(400)
  }
  const loc = page.locator(def.selector)
  const { count, index } = await visibleIndex(loc, def.pick ?? 0)
  if (index < 0) return { count, metrics: {}, crop: null, status: 'absent' }
  const target = loc.nth(index)
  const metrics = await target.evaluate(measureInPage, def.rowLike ?? false)
  const file = `${def.id}--${scheme}--${vp.name}.png`
  await target.screenshot({ path: join(dir, file), animations: 'disabled', caret: 'hide' })
  return { count, metrics, crop: `${IMG_REL}/patterns/${file}` }
}

async function runPatterns(
  open: (v: Viewport, s: Scheme) => Promise<Page>,
): Promise<Map<string, Record<string, Measured>>> {
  const dir = join(IMG_KEEL, 'patterns')
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  const results = new Map<string, Record<string, Measured>>()
  const routes = [...new Set(PATTERNS.map((p) => p.route))]
  for (const scheme of SCHEMES) {
    for (const vp of VIEWPORTS) {
      const key = `${scheme}-${vp.name}`
      const page = await open(vp, scheme)
      try {
        for (const path of routes) {
          const defs = PATTERNS.filter((p) => p.route === path)
          let ready = false
          try {
            ready = await settle(page, { path, slug: path })
          } catch (error) {
            failures.push(
              `patterns ${path} ${key}: ${error instanceof Error ? error.message : error}`,
            )
          }
          if (!ready && !failures.some((f) => f.startsWith(`patterns ${path} ${key}:`))) {
            failures.push(`patterns ${path} ${key}: route did not render`)
          }
          const markUnverified = (def: PatternDef): void => {
            const slot = results.get(def.id) ?? {}
            results.set(def.id, slot)
            slot[key] = { count: 0, metrics: {}, crop: null, status: 'unverified' }
          }
          for (const [n, def] of defs.entries()) {
            if (!ready) {
              markUnverified(def)
              continue
            }
            const slot = results.get(def.id) ?? {}
            results.set(def.id, slot)
            try {
              slot[key] = await measurePattern(page, def, vp, scheme, dir)
            } catch (error) {
              markUnverified(def)
              failures.push(
                `patterns ${def.id} ${key}: ${error instanceof Error ? error.message : error}`,
              )
            }
            console.log(
              `patterns ${def.id} ${key}: ${slot[key]?.status ?? `${slot[key]?.count} visible`}`,
            )
            if (vp.mobile && def.mobileOpen) {
              // Reset the overlay; if the page cannot be restored, the rest of the route is unknown.
              try {
                await page.keyboard.press('Escape')
                ready = await settle(page, { path, slug: path })
                if (!ready) throw new Error('route did not render after the overlay reset')
              } catch (error) {
                failures.push(
                  `patterns ${path} ${key}: ${error instanceof Error ? error.message : error}`,
                )
                ready = false
                for (const rest of defs.slice(n + 1)) markUnverified(rest)
                break
              }
            }
          }
        }
      } finally {
        await page.context().close()
      }
    }
  }
  return results
}

/** Keys whose value is a colour role; they legitimately differ between schemes. */
const isColourKey = (k: string): boolean => k.endsWith('Role') || k === 'shadow'

const schemeNote = (drift: string[], compared: boolean): string => {
  if (drift.length > 0) return `Light scheme geometry differs: ${drift.join('; ')}.`
  if (!compared) return 'Light scheme geometry was not compared (a slot is missing).'
  return 'Light scheme changes colour only; geometry is identical.'
}

/** A state the crawl could not provoke: navigation is instant and no pending or skeleton view
 * appeared, even with the network throttled. Unverified, not absent: nothing proves it does not exist. */
const LOADING_STATE = {
  id: 'loading-state',
  name: 'Loading / pending state',
  route: '/',
  selectorNote: 'none: no pending or skeleton view could be provoked on any route',
  instances: 0,
  crops: {},
  metrics: { desktop: {}, mobile: {} },
  notes:
    'Could not be observed: in-app navigation is instant and throttling the network produced no placeholder view. Treat as unverified, not as missing.',
  slotStatus: {
    'dark-desktop': 'unverified',
    'dark-mobile': 'unverified',
    'light-desktop': 'unverified',
    'light-mobile': 'unverified',
  },
} as const

async function writeInventory(results: Map<string, Record<string, Measured>>): Promise<void> {
  const patterns = PATTERNS.map((def) => {
    const slot = results.get(def.id) ?? {}
    const crops: Record<string, string> = {}
    for (const [key, m] of Object.entries(slot)) if (m.crop) crops[key] = m.crop
    const geometryDrift: string[] = []
    const bothSchemesMeasured = VIEWPORTS.every(
      (v) =>
        Object.keys(slot[`dark-${v.name}`]?.metrics ?? {}).length > 0 &&
        Object.keys(slot[`light-${v.name}`]?.metrics ?? {}).length > 0,
    )
    for (const vp of VIEWPORTS) {
      const dark = slot[`dark-${vp.name}`]?.metrics ?? {}
      const light = slot[`light-${vp.name}`]?.metrics ?? {}
      for (const [k, v] of Object.entries(dark)) {
        if (!isColourKey(k) && k in light && light[k] !== v)
          geometryDrift.push(`${vp.name} ${k}: dark ${v}, light ${light[k]}`)
      }
    }
    const lightRoles = ['desktop', 'mobile']
      .map((v) => slot[`light-${v}`]?.metrics['backgroundRole'])
      .filter(Boolean)
    const slotStatus: Record<string, SlotStatus> = {}
    for (const [key, m] of Object.entries(slot)) if (m.status) slotStatus[key] = m.status
    const absent = VIEWPORTS.filter((v) => slotStatus[`dark-${v.name}`] === 'absent').map(
      (v) => v.name,
    )
    const unverified = Object.entries(slotStatus)
      .filter(([, st]) => st === 'unverified')
      .map(([key]) => key)
    const notes = [
      def.notes,
      absent.length > 0
        ? `Not present on ${absent.join(' and ')} (collapsed or restructured at that width).`
        : '',
      unverified.length > 0 ? `Unverified slots: ${unverified.join(', ')}.` : '',
      schemeNote(geometryDrift, bothSchemesMeasured),
      lightRoles.length > 0 ? `Light background role: ${[...new Set(lightRoles)].join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
    return {
      id: def.id,
      name: def.name,
      route: def.route,
      selectorNote: def.selectorNote,
      instances: slot['dark-desktop']?.count ?? 0,
      crops,
      metrics: {
        desktop: slot['dark-desktop']?.metrics ?? {},
        mobile: slot['dark-mobile']?.metrics ?? {},
      },
      notes,
      ...(Object.keys(slotStatus).length > 0 ? { slotStatus } : {}),
    }
  })
  const inventory = {
    capturedAt: new Date().toISOString(),
    origin: ORIGIN,
    patterns: [...patterns, LOADING_STATE],
  }
  await writeFile(join(OUT, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n')
}

// ── Stage 3: scales survey ────────────────────────────────────────────────────────────────────

type Counts = Record<string, number>
type ChartSample = {
  width: number
  height: number
  paths: number
  lines: number
  rects: number
  circles: number
  textNodes: number
  dashed: boolean
  maxStroke: number
  minStroke: number
  insideCard: boolean
}
type Survey = {
  type: Counts
  padding: Counts
  gap: Counts
  radius: Counts
  border: Counts
  ring: Counts
  shadow: Counts
  charts: ChartSample[]
  density: Record<string, number | number[]>
}

/** Runs inside the page: histograms of computed values over every visible element. */
function surveyInPage(): Survey {
  const bump = (m: Counts, k: string): void => {
    m[k] = (m[k] ?? 0) + 1
  }
  const n = (v: string): number => Math.round(parseFloat(v) * 100) / 100
  const out: Survey = {
    type: {},
    padding: {},
    gap: {},
    radius: {},
    border: {},
    ring: {},
    shadow: {},
    charts: [],
    density: {},
  }
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden') continue
    const hasText = [...el.childNodes].some(
      (c) => c.nodeType === 3 && (c.textContent ?? '').trim().length > 2,
    )
    if (hasText) {
      const family = /mono/i.test(s.fontFamily) ? 'mono' : 'sans'
      const caps = s.textTransform === 'uppercase' ? ' caps' : ''
      const ls = n(s.letterSpacing)
      bump(
        out.type,
        `${n(s.fontSize)}px/${s.fontWeight}/${s.lineHeight === 'normal' ? 'normal' : n(s.lineHeight) + 'px'} ${family}${caps}${Number.isFinite(ls) && ls !== 0 ? ` ls${ls}` : ''}`,
      )
    }
    for (const side of [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft]) {
      const v = n(side)
      if (v > 0 && v <= 64) bump(out.padding, `${v}`)
    }
    if (s.display === 'flex' || s.display === 'grid' || s.display === 'inline-flex') {
      for (const g of new Set([s.rowGap, s.columnGap])) {
        const v = n(g)
        if (v > 0 && v <= 64) bump(out.gap, `${v}`)
      }
    }
    const rad = n(s.borderTopLeftRadius)
    if (rad > 0 && r.height >= 8) bump(out.radius, rad >= 999 ? 'pill' : `${rad}`)
    for (const w of [
      s.borderTopWidth,
      s.borderBottomWidth,
      s.borderLeftWidth,
      s.borderRightWidth,
    ]) {
      if (n(w) > 0) bump(out.border, `${n(w)}`)
    }
    if (s.boxShadow !== 'none') {
      for (const part of s.boxShadow.split(/,(?![^(]*\))/)) {
        const len = (
          part.replace(/(?:rgba?|oklab|oklch|color)\([^)]*\)/, '').match(/-?[\d.]+px/g) ?? []
        ).map(n)
        const [x = 0, y = 0, blur = 0, spread = 0] = len
        if (x === 0 && y === 0 && blur === 0 && spread > 0) bump(out.ring, `${spread}`)
        else bump(out.shadow, `${x} ${y} ${blur} ${spread}`)
      }
    }
    if (el.tagName === 'svg') {
      if (r.width >= 40 && r.height >= 14) {
        const count = (sel: string): number => el.querySelectorAll(sel).length
        const strokes = [...el.querySelectorAll('*')]
          .map((c) => n(getComputedStyle(c).strokeWidth))
          .filter((v) => v > 0)
        out.charts.push({
          width: Math.round(r.width),
          height: Math.round(r.height),
          paths: count('path'),
          lines: count('line'),
          rects: count('rect'),
          circles: count('circle'),
          textNodes: count('text'),
          dashed: [...el.querySelectorAll('*')].some(
            (c) => getComputedStyle(c).strokeDasharray !== 'none',
          ),
          maxStroke: strokes.length > 0 ? Math.max(...strokes) : 0,
          minStroke: strokes.length > 0 ? Math.min(...strokes) : 0,
          insideCard: Boolean(el.closest('article, section, a')),
        })
      }
    }
  }
  // Density: rows and cards fully visible in the scroll viewport.
  const view = document.documentElement.clientHeight - 8
  const fullyVisible = (sel: string): number[] =>
    [...document.querySelectorAll(sel)].flatMap((e) => {
      const b = e.getBoundingClientRect()
      return b.height > 0 && b.top >= 0 && b.bottom <= view ? [Math.round(b.height)] : []
    })
  const rows = fullyVisible('tbody tr')
  out.density['tableRowsVisible'] = rows.length
  out.density['tableRowHeight'] = rows[0] ?? 0
  out.density['articleHeights'] = fullyVisible('main article')
  out.density['listItemHeights'] = fullyVisible('main li').slice(0, 12)
  return out
}

const merge = (into: Counts, from: Counts): void => {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v
}
const sorted = (c: Counts): Counts =>
  Object.fromEntries(
    Object.entries(c).toSorted(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { numeric: true }),
    ),
  )

async function surveyScales(open: (v: Viewport, s: Scheme) => Promise<Page>): Promise<void> {
  const result: Record<string, unknown> = {}
  for (const vp of VIEWPORTS) {
    const page = await open(vp, 'dark')
    const total: Survey = {
      type: {},
      padding: {},
      gap: {},
      radius: {},
      border: {},
      ring: {},
      shadow: {},
      charts: [],
      density: {},
    }
    const perRoute: Record<string, { charts: number; density: Survey['density'] }> = {}
    const routeCharts: Array<ChartSample & { route: string }> = []
    const unverifiedRoutes: string[] = []
    try {
      for (const route of ROUTES) {
        try {
          if (!(await settle(page, route))) throw new Error('route did not render')
          const s = await page.evaluate(surveyInPage)
          for (const key of [
            'type',
            'padding',
            'gap',
            'radius',
            'border',
            'ring',
            'shadow',
          ] as const)
            merge(total[key], s[key])
          routeCharts.push(...s.charts.map((c) => ({ ...c, route: route.slug })))
          perRoute[route.slug] = { charts: s.charts.length, density: s.density }
          console.log(`scales ${route.slug} ${vp.name}`)
        } catch (error) {
          unverifiedRoutes.push(route.slug)
          failures.push(
            `scales ${route.slug} ${vp.name}: ${error instanceof Error ? error.message : error}`,
          )
        }
      }
    } finally {
      await page.context().close()
    }
    result[vp.name] = {
      viewport: `${vp.width}x${vp.height}`,
      type: sorted(total.type),
      padding: sorted(total.padding),
      gap: sorted(total.gap),
      radius: sorted(total.radius),
      border: sorted(total.border),
      ring: sorted(total.ring),
      shadow: sorted(total.shadow),
      charts: routeCharts,
      perRoute,
      unverifiedRoutes,
    }
  }
  await writeFile(
    join(OUT, 'scales.json'),
    JSON.stringify({ capturedAt: new Date().toISOString(), origin: ORIGIN, ...result }, null, 2) +
      '\n',
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────────────────────

const STAGES = ['routes', 'patterns', 'scales', 'all'] as const
const { values } = parseArgs({ options: { stage: { type: 'string', default: 'all' } } })
const stage = values.stage ?? 'all'
if (!(STAGES as readonly string[]).includes(stage)) {
  console.error(`unknown --stage "${stage}"; valid stages: ${STAGES.join(', ')}`)
  process.exit(1)
}

const chrome = await chromium.launchServer({
  channel: 'chrome',
  chromiumSandbox: !process.env['CI'],
})
try {
  const browser = await chromium.connect(chrome.wsEndpoint())
  const open = async (vp: Viewport, scheme: Scheme): Promise<Page> => {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      colorScheme: scheme,
      reducedMotion: 'reduce',
    })
    return context.newPage()
  }
  if (stage === 'routes' || stage === 'all')
    console.log(`route screenshots: ${await captureRoutes(open)}`)
  if (stage === 'patterns' || stage === 'all') await writeInventory(await runPatterns(open))
  if (stage === 'scales' || stage === 'all') await surveyScales(open)
} finally {
  chrome.kill()
}
if (failures.length > 0) {
  console.error(`${failures.length} failure(s):\n${failures.map((f) => `  ${f}`).join('\n')}`)
  process.exitCode = 1
}
