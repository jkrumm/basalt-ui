/**
 * One horizontal inset on a phone (Issue 3211): at 390 px a Card, a StatGroup and a ChartCard put their
 * content on one left edge, a ChartCard's plot is at least 350 px wide (370 with `bleed`), the y tick
 * labels sit inside the plot, and a line chart names its lines at their ends when they fit.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import type { LayoutPage } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'phone-density-'))
  const cssOut = join(scratch, 'phone-density.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'phone-density.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`phone-density: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'phone-density-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`phone-density: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>phone-density</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, PHONE, documentPath, 'reduce')
  await page.raw.waitForSelector('[data-testid="pd-chart"] svg')
  await page.settle()
  return page
}

type Probe = {
  /** The leftmost text of the card's content: its title, its figure, its label. */
  left: number
  cardLeft: number
}

type Plot = {
  frame: { left: number; right: number }
  plot: { left: number; right: number; width: number }
  labels: { left: number; right: number; text: string }[]
  texts: string[]
  legend: string | null
}

/** The plot's extent (the grid's rules), the y tick labels, the chart's text and the legend's display. */
const plotOf = (page: LayoutPage, id: string): Promise<Plot> =>
  page.raw.evaluate((testid) => {
    const root = document.querySelector(`[data-testid="${testid}"]`)!
    const svg = root.querySelector('svg.ts-chart')!
    const frame = svg.getBoundingClientRect()
    const rules = [...svg.querySelectorAll('line')]
      .map((l) => l.getBoundingClientRect())
      .filter((r) => r.height === 0 && r.width > 100)
    const left = Math.min(...rules.map((r) => r.left))
    const right = Math.max(...rules.map((r) => r.right))
    const labels = [...svg.querySelectorAll('text[data-ts-key^="y-tick-label"]')].map((t) => {
      const r = t.getBoundingClientRect()
      return { left: r.left, right: r.right, text: t.textContent ?? '' }
    })
    const legend = root.querySelector('fieldset[data-basalt-chart-legend]')
    return {
      frame: { left: frame.left, right: frame.right },
      plot: { left, right, width: right - left },
      labels,
      texts: [...svg.querySelectorAll('text')].map((t) => t.textContent ?? ''),
      legend: legend === null ? null : getComputedStyle(legend).display,
    }
  }, id)

/** The left edge of the first text in a probe's element, and the card surface's own left edge. */
const probeOf = (page: LayoutPage, id: string, selector: string): Promise<Probe> =>
  page.raw.evaluate(
    ({ testid, sel }) => {
      const root = document.querySelector(`[data-testid="${testid}"]`)!
      const el = root.querySelector(sel)!
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) =>
          n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
      })
      const range = document.createRange()
      range.selectNodeContents(walker.nextNode()!)
      return {
        left: range.getBoundingClientRect().left,
        cardLeft: root.querySelector('[data-surface="card"]')!.getBoundingClientRect().left,
      }
    },
    { testid: id, sel: selector },
  )

layout('phone density at 390', () => {
  test('a card, a stat group and a chart card put their content on one left edge', async () => {
    const page = await open()
    const card = await probeOf(page, 'pd-card', '[data-testid="pd-card-text"]')
    const stat = await probeOf(page, 'pd-stat', '[data-slot="stat-cell"]')
    const chart = await probeOf(page, 'pd-chart', '[data-slot="card-band"]')
    const figure = await probeOf(page, 'pd-chart', '[data-slot="chart-figure"]')
    const bleed = await probeOf(page, 'pd-bleed', '[data-slot="card-band"]')
    // The page gutter is 8 and the card pays 12 on a phone: the content starts 20 px from the screen's edge.
    for (const p of [card, stat, chart, figure, bleed]) expect(p.left).toBeCloseTo(20, 0)
    for (const p of [card, stat, chart]) expect(p.cardLeft).toBeCloseTo(8, 0)
  })

  test('the plot is at least 350 px wide, and 370 with bleed', async () => {
    const page = await open()
    const plain = await plotOf(page, 'pd-chart')
    const bleed = await plotOf(page, 'pd-bleed')
    expect(plain.plot.width).toBeGreaterThanOrEqual(350)
    expect(bleed.plot.width).toBeGreaterThanOrEqual(370)
    // No axis column is reserved: the plot is the frame.
    expect(plain.plot.left).toBeCloseTo(plain.frame.left, 0)
    expect(bleed.plot.left).toBeCloseTo(bleed.frame.left, 0)
  })

  test('a bleeding plot reaches the card edge and the legend keeps the card edge', async () => {
    const page = await open()
    const bleed = await plotOf(page, 'pd-bleed')
    const sides = await page.raw.evaluate(() => {
      const root = document.querySelector('[data-testid="pd-bleed"]')!
      const card = root.querySelector('[data-surface="card"]')!.getBoundingClientRect()
      const entry = [...root.querySelectorAll('fieldset[data-basalt-chart-legend] button')]
        .map((b) => b.getBoundingClientRect())
        .find((r) => r.width > 0)!
      return { left: card.left, right: card.right, entry: entry.left }
    })
    expect(bleed.plot.left).toBeCloseTo(sides.left, 0)
    expect(bleed.plot.right).toBeCloseTo(sides.right, 0)
    expect(sides.entry).toBeGreaterThanOrEqual(sides.left + 12 - 0.5)
  })

  test('the y tick labels sit inside the plot', async () => {
    const page = await open()
    for (const id of ['pd-chart', 'pd-bleed']) {
      const p = await plotOf(page, id)
      expect(p.labels.length).toBeGreaterThanOrEqual(2)
      for (const l of p.labels) {
        expect(l.left).toBeGreaterThanOrEqual(p.plot.left)
        expect(l.right).toBeLessThanOrEqual(p.plot.right)
      }
    }
  })

  test('every x label stays inside the frame, the first and last of a category axis included', async () => {
    const page = await open()
    for (const id of ['pd-chart', 'pd-cat']) {
      const found = await page.raw.evaluate((testid) => {
        const svg = document.querySelector(`[data-testid="${testid}"] svg.ts-chart`)!
        const frame = svg.getBoundingClientRect()
        return {
          frame: { left: frame.left, right: frame.right },
          labels: [...svg.querySelectorAll('text[data-ts-key^="x-tick-label"]')].map((t) => {
            const r = t.getBoundingClientRect()
            return { left: r.left, right: r.right, text: t.textContent ?? '' }
          }),
        }
      }, id)
      expect(found.labels.length, id).toBeGreaterThanOrEqual(2)
      for (const l of found.labels) {
        expect(l.left, `${id} ${l.text}`).toBeGreaterThanOrEqual(found.frame.left - 0.5)
        expect(l.right, `${id} ${l.text}`).toBeLessThanOrEqual(found.frame.right + 0.5)
      }
    }
  })

  test('lines that end apart are named at their ends and the legend gives way', async () => {
    const page = await open()
    const p = await plotOf(page, 'pd-names')
    expect(p.texts).toContain('Requests')
    expect(p.texts).toContain('Errors')
    expect(p.legend).toBe('none')
  })

  test('lines that end together keep the legend and draw no end label', async () => {
    const page = await open()
    const p = await plotOf(page, 'pd-near')
    expect(p.texts).not.toContain('Retries')
    expect(p.legend).not.toBe('none')
  })

  test('a wrapped legend keeps a 44 px pitch between rows, so its toggles never overlap', async () => {
    const page = await open()
    const tops: number[] = await page.raw.evaluate(() => {
      const buttons = [
        ...document.querySelectorAll(
          '[data-testid="pd-wrap"] fieldset[data-basalt-chart-legend] button',
        ),
      ]
      return [...new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top)))].toSorted(
        (a, b) => a - b,
      )
    })
    expect(tops.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < tops.length; i++) expect(tops[i]! - tops[i - 1]!).toBeGreaterThanOrEqual(43)
  })
})
