/**
 * Spike table-fit (docs/v3/concepts/data-table.md section 9: S3 and S4). Throwaway harness, no tests.
 *
 * The real `DataTable` parts (packages/basalt-ui/src/table, read only) render synthetic copies of
 * argo's tables in Chrome.
 *
 *   S3  five tables (ledger, slots-list, net-worth, catalog, spark-grid) at container widths 500, 800,
 *       1000, 1200 and 1800 px, in the shipped fixed layout and in today's auto layout. Counted: cells
 *       (th and td, tier-visible) whose scrollWidth is above clientWidth, outside a `scroll` table.
 *   S4  nine card sites (eight argo `renderCard` sites and the tax queue) at 390 px. The plan places
 *       every column; each thing argo's card shows is judged against that place (fits / goes to the
 *       sheet / needs a slot) and the clamped card elements are measured for truncation.
 *
 * Prints ONE JSON object on stdout and exits 0 (0 = the harness ran, not "the hypothesis held").
 * Progress goes to stderr. Shots land in shots/.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'

const ROOT = import.meta.dir
const REPO = resolve(ROOT, '../../..')
const BUILD = resolve(ROOT, '.build')
const SHOTS = resolve(ROOT, 'shots')
const FONTS = resolve(REPO, 'packages/basalt-ui/node_modules/@fontsource-variable')
const SHOT_MAX_BYTES = 250 * 1024

const S3_SITES = ['ledger', 'slots-list', 'net-worth', 'catalog', 'spark-grid'] as const
const S3_WIDTHS = [500, 800, 1000, 1200, 1800] as const
const S4_SITES = [
  'ledger',
  'catalog',
  'slots-list',
  'spending',
  'net-worth',
  'recurring-subscriptions',
  'recurring-bills',
  'recurring-apart',
  'tax',
] as const
const THEMES = ['light', 'dark'] as const
const CH_PX = 8
const CELL_PAD_PX = 24

const log = (msg: string): void => {
  process.stderr.write(`${msg}\n`)
}

// ---- build and serve -------------------------------------------------------------------------

async function build(): Promise<{ html: string; js: string }> {
  rmSync(BUILD, { recursive: true, force: true })
  mkdirSync(BUILD, { recursive: true })
  const cssOut = join(BUILD, 'app.css')
  const tw = Bun.spawnSync(
    [
      join(REPO, 'node_modules/.bin/tailwindcss'),
      '--input',
      join(ROOT, 'fixture/app.css'),
      '--output',
      cssOut,
    ],
    { cwd: REPO, stdout: 'pipe', stderr: 'pipe' },
  )
  if (tw.exitCode !== 0) throw new Error(`tailwind failed:\n${tw.stderr.toString()}`)
  const fontUrl = /url\((['"]?)@fontsource-variable\/([^'")]+)\1\)/g
  const css = readFileSync(cssOut, 'utf8').replace(
    fontUrl,
    (_m, _q, path: string) => `url('/fonts/${path}')`,
  )
  const tiers = readFileSync(join(REPO, 'packages/basalt-ui/src/table/table.css'), 'utf8')
  const spike = readFileSync(join(ROOT, 'fixture/spike.css'), 'utf8')
  const out = await Bun.build({
    entrypoints: [join(ROOT, 'fixture/app.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!out.success) throw new Error(`fixture did not build:\n${out.logs.join('\n')}`)
  const js = await out.outputs[0]!.text()
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" /><title>table-fit</title>` +
    `<style>${css}</style><style>${tiers}</style><style>${spike}</style></head>` +
    `<body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`
  return { html, js }
}

// ---- in-page measurement ---------------------------------------------------------------------

type OverflowCell = {
  column: string
  kind: string
  part: 'head' | 'body'
  /** `header`; `name` and `sub-line` for an entity (the name alone does or does not fit); else the kind. */
  cause: string
  scrollWidth: number
  clientWidth: number
  text: string
}
type ColumnStat = {
  column: string
  kind: string
  fixedPx: number
  headNeedPx: number
  bodyNeedPx: number
}
type Measure = {
  tier: 'full' | 'reduced' | 'card'
  fullAt: string | null
  below: string | null
  visibleColumns: string[]
  hiddenColumns: string[]
  overflow: OverflowCell[]
  columns: ColumnStat[]
  tableWidth: number
  scrollerWidth: number
  scrollerScrollWidth: number
  cardTruncated: { part: string; rows: number }[]
  rowHeights: { min: number; max: number }
  /** Card rows whose content is taller than the row (a fixed row height clipping or spilling). */
  cardRowsOverflowingHeight: number
}

function measureInPage(): Measure {
  const root = document.querySelector<HTMLElement>('[data-slot="table-root"]')!
  const scroller = root.querySelector<HTMLElement>('[data-slot="table-scroller"]')!
  const table = root.querySelector<HTMLElement>('[data-slot="table"]')!
  const shown = (el: Element): boolean => el.getClientRects().length > 0
  const heads = [...root.querySelectorAll<HTMLElement>('thead th')]
  const headName = (th: HTMLElement): string => (th.textContent ?? '').trim()
  const firstRow = root.querySelector<HTMLElement>('tbody tr')
  const card = firstRow !== null && getComputedStyle(firstRow).display === 'grid'
  const nameOf = (cell: HTMLElement): string => {
    const th = heads[cell.cellIndex]
    return th === undefined ? (cell.dataset.slot ?? 'cell') : headName(th)
  }
  const contentWidth = (el: HTMLElement): number => {
    const range = document.createRange()
    range.selectNodeContents(el)
    const style = getComputedStyle(el)
    return (
      Math.ceil(range.getBoundingClientRect().width) +
      parseFloat(style.paddingLeft) +
      parseFloat(style.paddingRight)
    )
  }

  const overflow: OverflowCell[] = []
  for (const cell of root.querySelectorAll<HTMLElement>('thead th, tbody td')) {
    if (!shown(cell)) continue
    // the card tier hides the head visually (a 1 px clip): its cells are not on screen
    if (card && cell.tagName === 'TH') continue
    if (cell.scrollWidth > cell.clientWidth) {
      const head = cell.tagName === 'TH'
      const name = cell.querySelector<HTMLElement>('[data-slot="table-entity-name"]')
      const style = getComputedStyle(cell)
      const room = cell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      overflow.push({
        column: nameOf(cell),
        kind: cell.dataset.kind ?? '',
        cause: head
          ? 'header'
          : name !== null
            ? name.getBoundingClientRect().width > room
              ? 'name'
              : 'sub-line'
            : (cell.dataset.kind ?? 'cell'),
        part: head ? 'head' : 'body',
        scrollWidth: cell.scrollWidth,
        clientWidth: cell.clientWidth,
        text: (cell.textContent ?? '').trim().slice(0, 48),
      })
    }
  }

  const columns: ColumnStat[] = []
  if (!card) {
    for (const th of heads) {
      if (!shown(th)) continue
      const body = [...root.querySelectorAll<HTMLElement>('tbody tr')]
        .map((row) => row.cells[th.cellIndex])
        .filter((cell): cell is HTMLTableCellElement => cell !== undefined)
      columns.push({
        column: headName(th),
        kind: th.dataset.kind ?? '',
        fixedPx: Math.round(th.getBoundingClientRect().width * 10) / 10,
        headNeedPx: contentWidth(th),
        bodyNeedPx: body.reduce((max, cell) => Math.max(max, contentWidth(cell)), 0),
      })
    }
  }

  const clamped = (selector: string, part: string) => ({
    part,
    rows: [...root.querySelectorAll<HTMLElement>(selector)].filter(
      (el) => shown(el) && el.scrollHeight > el.clientHeight + 1,
    ).length,
  })
  const heights = [...root.querySelectorAll<HTMLElement>('tbody tr')].map(
    (r) => r.getBoundingClientRect().height,
  )
  const fullAt = root.dataset.fullAt ?? null
  const below = root.dataset.below ?? null
  const scrollerWidth = scroller.clientWidth
  const hiddenHeads = heads.filter((th) => !shown(th)).map(headName)
  const tier = card ? 'card' : hiddenHeads.length > 0 ? 'reduced' : 'full'
  return {
    tier,
    fullAt,
    below,
    visibleColumns: heads.filter(shown).map(headName),
    hiddenColumns: hiddenHeads,
    overflow,
    columns,
    tableWidth: Math.round(table.getBoundingClientRect().width * 10) / 10,
    scrollerWidth,
    scrollerScrollWidth: scroller.scrollWidth,
    cardTruncated: [
      clamped('[data-spike-run]', 'meta-run'),
      clamped('[data-place="subtitle"]', 'subtitle'),
    ],
    cardRowsOverflowingHeight: card
      ? [...root.querySelectorAll<HTMLElement>('tbody tr')].filter(
          (row) => row.scrollHeight > row.clientHeight + 1,
        ).length
      : 0,
    rowHeights: {
      min: Math.round(Math.min(...heights)),
      max: Math.round(Math.max(...heights)),
    },
  }
}

// ---- driving Chrome --------------------------------------------------------------------------

type Fit = {
  site: string
  argo: string
  plan: {
    columns: {
      id: string
      kind: string
      place: string
      priority: number | null
      visible: boolean
      widthPx: number
    }[]
    fullAt: number | null
    reducedFrom: number
    demoted: string[]
  }
  warnings: string[]
  needs: {
    label: string
    cols: string[]
    kind: 'read' | 'edit' | 'tap' | 'action'
    expect?: 'title' | 'value'
  }[]
  reorder: string[] | null
  rows: number
}

type Query = {
  site: string
  width?: number | 'full'
  layout?: 'fixed' | 'auto'
  cards?: 'shipped' | 'spike'
  order?: 'argo' | 'reordered'
  sub?: 'inline' | 'block'
  theme?: 'light' | 'dark'
}

async function load(page: Page, base: string, q: Query): Promise<Fit> {
  const search = new URLSearchParams({
    site: q.site,
    width: String(q.width ?? 'full'),
    layout: q.layout ?? 'fixed',
    cards: q.cards ?? 'shipped',
    order: q.order ?? 'argo',
    sub: q.sub ?? 'inline',
    theme: q.theme ?? 'light',
  })
  await page.goto(`${base}/?${search}`)
  await page.waitForFunction(
    () => (window as unknown as { tableFit?: unknown }).tableFit !== undefined,
  )
  await page.evaluate(() =>
    document.fonts.ready.then(
      () =>
        new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))),
    ),
  )
  return page.evaluate(() => (window as unknown as { tableFit: Fit }).tableFit)
}

let shotCount = 0
let shotMaxBytes = 0
const oversize: string[] = []

async function shoot(page: Page, name: string): Promise<void> {
  const target = page.locator('[data-slot="table-root"]')
  let file = `${name}.png`
  let buffer = await target.screenshot({ type: 'png' })
  if (buffer.length > SHOT_MAX_BYTES) {
    file = `${name}.jpg`
    buffer = await target.screenshot({ type: 'jpeg', quality: 80 })
  }
  if (buffer.length > SHOT_MAX_BYTES) oversize.push(file)
  writeFileSync(join(SHOTS, file), buffer)
  shotCount += 1
  shotMaxBytes = Math.max(shotMaxBytes, buffer.length)
}

// ---- S4 judging ------------------------------------------------------------------------------

type NeedResult = { label: string; result: 'ok' | 'sheet' | 'slot' | 'displaced'; places: string[] }

function judge(fit: Fit): NeedResult[] {
  const placeOf = new Map(fit.plan.columns.map((c) => [c.id, c.place]))
  return fit.needs.map((need): NeedResult => {
    const places = need.cols.map((id) => placeOf.get(id) ?? 'absent')
    if (need.kind === 'tap') return { label: need.label, result: 'slot', places }
    if (need.kind === 'action') {
      return {
        label: need.label,
        result: places.every((p) => p === 'kebab') ? 'ok' : 'slot',
        places,
      }
    }
    if (need.kind === 'edit') {
      return {
        label: need.label,
        result: places.every((p) => p === 'edit') ? 'ok' : 'slot',
        places,
      }
    }
    if (places.some((p) => p === 'detail' || p === 'hidden' || p === 'absent')) {
      return { label: need.label, result: 'sheet', places }
    }
    if (need.expect !== undefined && places[0] !== need.expect) {
      return { label: need.label, result: 'displaced', places }
    }
    return { label: need.label, result: 'ok', places }
  })
}

// ---- main ------------------------------------------------------------------------------------

async function main(): Promise<void> {
  rmSync(SHOTS, { recursive: true, force: true })
  mkdirSync(SHOTS, { recursive: true })
  const built = await build()
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === '/app.js')
        return new Response(built.js, { headers: { 'content-type': 'text/javascript' } })
      if (url.pathname.startsWith('/fonts/')) {
        const file = Bun.file(join(FONTS, url.pathname.slice('/fonts/'.length)))
        return file.size > 0 ? new Response(file) : new Response('missing font', { status: 404 })
      }
      return new Response(built.html, { headers: { 'content-type': 'text/html' } })
    },
  })
  const base = `http://localhost:${server.port}`
  const browser: Browser = await chromium.launch({ channel: 'chrome' })
  const chromeVersion = browser.version()
  const consoleErrors: string[] = []

  const newPage = async (
    width: number,
    height: number,
    scheme: 'light' | 'dark',
  ): Promise<Page> => {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: scheme,
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    page.on('pageerror', (e) => consoleErrors.push(String(e)))
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text())
    })
    return page
  }

  try {
    // ---- S3 ----
    const s3Cells: (OverflowCell & { site: string; width: number })[] = []
    const stackedCells: (OverflowCell & { site: string; width: number })[] = []
    const shippedCards: unknown[] = []
    const s3Tables: unknown[] = []
    const kindNeed = new Map<
      string,
      { kind: string; maxBodyNeed: number; maxHeadNeed: number; minFixed: number; samples: number }
    >()
    const page = await newPage(1800, 1200, 'light')
    for (const site of S3_SITES) {
      for (const width of S3_WIDTHS) {
        const fit = await load(page, base, { site, width, layout: 'fixed' })
        const fixed = await page.evaluate(measureInPage)
        await load(page, base, { site, width, layout: 'auto' })
        const auto = await page.evaluate(measureInPage)
        for (const cell of fixed.overflow) s3Cells.push({ site, width, ...cell })
        await load(page, base, { site, width, layout: 'fixed', sub: 'block' })
        const stacked = await page.evaluate(measureInPage)
        for (const cell of stacked.overflow) stackedCells.push({ site, width, ...cell })
        if (fixed.tier !== 'card') {
          for (const c of fixed.columns) {
            const spec = fit.plan.columns.find((p) => p.kind === c.kind)
            const entry = kindNeed.get(c.kind) ?? {
              kind: c.kind,
              maxBodyNeed: 0,
              maxHeadNeed: 0,
              minFixed: Infinity,
              samples: 0,
            }
            entry.maxBodyNeed = Math.max(entry.maxBodyNeed, c.bodyNeedPx)
            entry.maxHeadNeed = Math.max(entry.maxHeadNeed, c.headNeedPx)
            entry.minFixed = Math.min(entry.minFixed, spec === undefined ? c.fixedPx : spec.widthPx)
            entry.samples += 1
            kindNeed.set(c.kind, entry)
          }
        }
        s3Tables.push({
          site,
          width,
          plan: {
            fullAt: fit.plan.fullAt,
            reducedFrom: fit.plan.reducedFrom,
            demoted: fit.plan.demoted,
            warnings: fit.warnings,
          },
          fixed: {
            tier: fixed.tier,
            fullAt: fixed.fullAt,
            below: fixed.below,
            visible: fixed.visibleColumns,
            hidden: fixed.hiddenColumns,
            overflowCells: fixed.overflow.length,
            tableWidth: fixed.tableWidth,
            scrollerWidth: fixed.scrollerWidth,
            scrollerScrollWidth: fixed.scrollerScrollWidth,
            columns: fixed.columns,
          },
          auto: {
            tier: auto.tier,
            visible: auto.visibleColumns,
            tableWidth: auto.tableWidth,
            scrollerWidth: auto.scrollerWidth,
            clippedPx: Math.max(0, Math.round(auto.tableWidth - auto.scrollerWidth)),
            columns: auto.columns.map((c) => ({ column: c.column, autoPx: c.fixedPx })),
          },
        })
        log(
          `s3 ${site} @${width}: ${fixed.tier}, ${fixed.visibleColumns.length} cols, ${fixed.overflow.length} overflowing, auto clips ${Math.max(0, Math.round(auto.tableWidth - auto.scrollerWidth))}px`,
        )
      }
    }
    await page.context().close()

    // the shipped card tier at 390 (cards=shipped): does its row height follow its content?
    const narrow = await newPage(390, 844, 'light')
    for (const site of S3_SITES) {
      await load(narrow, base, { site, width: 'full' })
      const m = await narrow.evaluate(measureInPage)
      shippedCards.push({
        site,
        tier: m.tier,
        rows: m.rowHeights,
        rowsTallerThanTheirHeight: m.cardRowsOverflowingHeight,
        overflowCells: m.overflow.length,
      })
    }
    await narrow.context().close()

    // S3 shots: five widths at 1800x1200, and the phone, per theme.
    for (const theme of THEMES) {
      const desk = await newPage(1800, 1200, theme)
      for (const site of S3_SITES) {
        for (const width of S3_WIDTHS) {
          await load(desk, base, { site, width, theme })
          await shoot(desk, `s3-${site}-w${width}-${theme}`)
        }
      }
      await desk.context().close()
      const phone = await newPage(390, 844, theme)
      for (const site of S3_SITES) {
        await load(phone, base, { site, width: 'full', theme })
        await shoot(phone, `s3-${site}-390x844-${theme}`)
      }
      await phone.context().close()
    }

    // ---- S4 ----
    const phone = await newPage(390, 844, 'light')
    const s4Sites: unknown[] = []
    const needsSlot: string[] = []
    const sheet: string[] = []
    const reordered: string[] = []
    const fit: string[] = []
    for (const site of S4_SITES) {
      let used: 'argo' | 'reordered' = 'argo'
      let f = await load(phone, base, { site, cards: 'spike', order: 'argo' })
      let results = judge(f)
      const displaced = results.some((r) => r.result === 'displaced')
      if (displaced && f.reorder !== null) {
        used = 'reordered'
        f = await load(phone, base, { site, cards: 'spike', order: 'reordered' })
      }
      const natural = results
      results = judge(f)
      const m = await phone.evaluate(measureInPage)
      const truncated = m.cardTruncated.filter((t) => t.rows > 0)
      const slot = results.filter((r) => r.result === 'slot').map((r) => r.label)
      const toSheet = results.filter((r) => r.result === 'sheet').map((r) => r.label)
      const stillDisplaced = results.filter((r) => r.result === 'displaced').map((r) => r.label)
      const status: 'fit' | 'sheet' | 'slot' =
        slot.length > 0
          ? 'slot'
          : toSheet.length > 0 || truncated.length > 0 || stillDisplaced.length > 0
            ? 'sheet'
            : 'fit'
      if (status === 'slot') needsSlot.push(site)
      else if (status === 'sheet') sheet.push(site)
      else fit.push(site)
      if (used === 'reordered') reordered.push(site)
      const places = Object.fromEntries(f.plan.columns.map((c) => [c.id, c.place]))
      s4Sites.push({
        site,
        argo: f.argo,
        status,
        columnOrder: used,
        displacedInArgoOrder: natural.filter((r) => r.result === 'displaced').map((r) => r.label),
        places,
        slot,
        toSheet,
        stillDisplaced,
        truncated,
        cardOverflowCells: m.overflow.length,
        overflowCells: m.overflow,
        rowHeights: m.rowHeights,
        demoted: f.plan.demoted,
        reducedFrom: f.plan.reducedFrom,
        fullAt: f.plan.fullAt,
        warnings: f.warnings,
        needs: results,
      })
      log(
        `s4 ${site}: ${status}${used === 'reordered' ? ' (after reorder)' : ''}; slot=${slot.length} sheet=${toSheet.length} truncated=${truncated.map((t) => `${t.part}:${t.rows}`).join(',') || '-'}`,
      )
    }
    await phone.context().close()

    for (const theme of THEMES) {
      for (const [w, h] of [
        [1800, 1200],
        [390, 844],
      ] as const) {
        const p = await newPage(w, h, theme)
        for (const site of S4_SITES) {
          const argoFit = await load(p, base, { site, cards: 'spike', order: 'argo', theme })
          const used = (s4Sites as { site: string; columnOrder: string }[]).find(
            (s) => s.site === site,
          )?.columnOrder
          if (used === 'reordered' && argoFit.reorder !== null)
            await load(p, base, { site, cards: 'spike', order: 'reordered', theme })
          await shoot(p, `s4-${site}-${w}x${h}-${theme}`)
        }
        await p.context().close()
      }
    }

    // ---- result ----
    const overflowOutsideScroll = s3Cells.length
    const stackedByCause: Record<string, number> = {}
    for (const c of stackedCells) stackedByCause[c.cause] = (stackedByCause[c.cause] ?? 0) + 1
    const byColumn: Record<string, number> = {}
    const byCause: Record<string, number> = {}
    for (const c of s3Cells) {
      const key = `${c.site}/${c.column}/${c.part}`
      byColumn[key] = (byColumn[key] ?? 0) + 1
      byCause[c.cause] = (byCause[c.cause] ?? 0) + 1
    }
    const kinds = [...kindNeed.values()].map((k) => ({
      kind: k.kind,
      planWidthPx: Number.isFinite(k.minFixed) ? k.minFixed : null,
      maxBodyNeedPx: k.maxBodyNeed,
      maxHeadNeedPx: k.maxHeadNeed,
      samples: k.samples,
    }))
    const s3Pass = overflowOutsideScroll === 0
    const s4Pass = needsSlot.length === 0
    const shotBytes = readdirSync(SHOTS).reduce((sum, f) => sum + statSync(join(SHOTS, f)).size, 0)
    const result = {
      harness: {
        chrome: chromeVersion,
        date: new Date().toISOString(),
        chPx: CH_PX,
        cellPadPx: CELL_PAD_PX,
      },
      s3: {
        overflowOutsideScroll,
        overflowByCause: byCause,
        stackedSubLine: { overflowCells: stackedCells.length, byCause: stackedByCause },
        shippedCardTier390: shippedCards,
        overflowByColumn: byColumn,
        overflowCells: s3Cells,
        kinds,
        tables: s3Tables,
        verdict: s3Pass ? 'PASS' : 'REFUTED',
      },
      s4: {
        sites: S4_SITES.length,
        fitCount: fit.length,
        fit,
        needsSlot,
        toSheet: sheet,
        reordered,
        detail: s4Sites,
        verdict: s4Pass ? 'PASS' : 'REFUTED',
      },
      shots: { count: shotCount, maxBytes: shotMaxBytes, totalBytes: shotBytes, oversize },
      consoleErrors,
      ownerS3: 'pending',
      ownerS4: 'pending',
      verdict: s3Pass && s4Pass ? 'PASS' : 'REFUTED',
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } finally {
    await browser.close()
    void server.stop(true)
  }
}

await main()
