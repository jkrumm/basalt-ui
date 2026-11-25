/**
 * The `/charts` gallery's patterns in real Chrome at 1440: two charts on one cursor that both paint
 * their readout, a rich tooltip row (change, status, reference), a line colored by a second value on a
 * log right axis with its ramp legend, events and extremes, a waterfall's floating bars, a range
 * navigator's brush on its window handle, and a heat grid's data rows. Asserted here because
 * happy-dom has no layout, no gradients and no pointer.
 *
 * The page is self-contained: `fixture/charts-gallery.css` is compiled with the Tailwind CLI into a
 * temp directory and `fixture/charts-gallery-fixture.tsx` is bundled in memory (its CSS modules
 * included), both inlined into a document served beside the shared fixture.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
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
  scratch = mkdtempSync(join(tmpdir(), 'charts-gallery-'))
  const cssOut = join(scratch, 'charts-gallery.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-gallery.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-gallery: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-gallery-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-gallery: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-gallery</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, DESKTOP_1440, documentPath, 'reduce')
  for (const id of ['g-linked-a', 'g-cycle', 'g-waterfall', 'g-navigator', 'g-heatmap'])
    await page.raw.waitForSelector(`[data-testid="${id}"] svg.ts-chart`)
  await page.settle()
  return page
}

/** Points the mouse at a share of a probe's plot svg, after scrolling it into view. */
async function pointAt(page: LayoutPage, testId: string, fx: number, fy: number): Promise<void> {
  await page.raw.evaluate((id) => {
    document.querySelector(`[data-testid="${id}"] svg.ts-chart`)!.scrollIntoView({
      block: 'center',
      behavior: 'instant',
    })
  }, testId)
  await page.quiesce()
  const at = await page.raw.evaluate(
    ({ id, fx, fy }) => {
      const r = document
        .querySelector(`[data-testid="${id}"] svg.ts-chart`)!
        .getBoundingClientRect()
      return { x: r.left + r.width * fx, y: r.top + r.height * fy }
    },
    { id: testId, fx, fy },
  )
  await page.raw.mouse.move(at.x, at.y)
  // The tooltip shows after its delay (`TOOLTIP_DELAY`) and the rich body mounts a frame later.
  await page.raw.waitForTimeout(450)
  await page.settle()
}

/** The text of every tooltip on screen, in document order. */
const tooltips = (page: LayoutPage): Promise<string[]> =>
  page.raw.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.ts-chart-tooltip')]
      .filter((t) => !t.hidden && t.getBoundingClientRect().width > 0)
      .map((t) => t.innerText.replace(/\s+/g, ' ').trim()),
  )

layout('charts gallery patterns', () => {
  test('two charts on one cursor both paint the readout at the shared x', async () => {
    const page = await open()
    await pointAt(page, 'g-linked-a', 0.5, 0.5)
    const fromA = await tooltips(page)
    expect(fromA).toHaveLength(2)
    const titleOf = (text: string): string => text.split(/ (?:Load|Resting HR) /)[0] ?? ''
    expect(titleOf(fromA[0] ?? '')).toBe(titleOf(fromA[1] ?? ''))
    expect(fromA.some((t) => t.includes('Load'))).toBe(true)
    expect(fromA.some((t) => t.includes('Resting HR'))).toBe(true)

    await pointAt(page, 'g-linked-b', 0.25, 0.5)
    const fromB = await tooltips(page)
    expect(fromB).toHaveLength(2)
    expect(titleOf(fromB[0] ?? '')).toBe(titleOf(fromB[1] ?? ''))
    expect(titleOf(fromB[0] ?? '')).not.toBe(titleOf(fromA[0] ?? ''))
  })

  test('a rich row reads its change, its status and its reference', async () => {
    const page = await open()
    await pointAt(page, 'g-linked-b', 0.6, 0.5)
    const rich = (await tooltips(page)).find((t) => t.includes('Resting HR')) ?? ''
    expect(rich).toMatch(/bpm [\u25B2\u25BC\u2013] [+\u2212]?\d+\.\d%/)
    expect(rich).toMatch(/Strained|Rested/)
    expect(rich).toMatch(/7-day mean \d+\.\d bpm/)
    // The rich body draws the engine's surface itself: a padded, raised box in the tooltip's font.
    const surface = await page.raw.evaluate(() => {
      const tip = document.querySelector<HTMLElement>('.basalt-tip')
      if (tip === null) return null
      const s = getComputedStyle(tip)
      return { padding: Number.parseFloat(s.paddingTop), font: Number.parseFloat(s.fontSize) }
    })
    expect(surface?.padding).toBeGreaterThan(0)
    expect(surface?.font).toBeLessThanOrEqual(13)
  })

  test('a colorBy line strokes its ramp and the legend draws the ramp key', async () => {
    const page = await open()
    const cycle = await page.raw.evaluate(() => {
      const probe = document.querySelector('[data-testid="g-cycle"]')!
      const stroked = [...probe.querySelectorAll('path')].find((p) =>
        (p.getAttribute('stroke') ?? '').includes('basalt-ramp'),
      )
      const id = /url\(#([^)]+)\)/.exec(stroked?.getAttribute('stroke') ?? '')?.[1]
      const gradient = id === undefined ? null : probe.querySelector(`[id="${id}"]`)
      return {
        stops: gradient?.querySelectorAll('stop').length ?? 0,
        ramp: probe.querySelector('[data-legend-ramp]')?.textContent ?? '',
        text: probe.querySelector('svg.ts-chart')?.textContent ?? '',
      }
    })
    expect(cycle.stops).toBeGreaterThan(2)
    expect(cycle.ramp).toContain('Score')
    // The right axis is on decades.
    expect(cycle.text).toContain('$100')
    expect(cycle.text).toContain('$1000')
    expect(cycle.text).toContain('Halving')
    expect(cycle.text).toMatch(/High \S+/)
    expect(cycle.text).toMatch(/Low \S+/)
  })

  test('the extremes and the event caption sit inside the plot', async () => {
    const page = await open()
    const out = await page.raw.evaluate(() => {
      const svg = document.querySelector('[data-testid="g-cycle"] svg.ts-chart')!
      const frame = svg.getBoundingClientRect()
      return [...svg.querySelectorAll('text')]
        .filter((t) => /^(High|Low|Halving)/.test(t.textContent ?? ''))
        .map((t) => {
          const r = t.getBoundingClientRect()
          return r.top < frame.top - 0.5 || r.bottom > frame.bottom + 0.5 ? t.textContent : null
        })
        .filter((t) => t !== null)
    })
    expect(out).toEqual([])
  })

  test('the tooltip at an event names it', async () => {
    const page = await open()
    // The event sits on week 60 of 120: the middle of the x axis.
    await pointAt(page, 'g-cycle', 0.5, 0.5)
    const tip = (await tooltips(page)).join(' ')
    expect(tip).toContain('Halving')
  })

  test('waterfall steps float on the running total, the totals stand on the baseline', async () => {
    const page = await open()
    const bars = await page.raw.evaluate(() => {
      const svg = document.querySelector('[data-testid="g-waterfall"] svg.ts-chart')!
      return [...svg.querySelectorAll('path, rect')]
        .filter((el) =>
          el.closest('[data-ts-key]')?.getAttribute('data-ts-key')?.startsWith('bars'),
        )
        .map((el) => {
          const r = el.getBoundingClientRect()
          return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
        })
        .filter((r) => r.bottom > r.top)
        .sort((a, b) => a.top - b.top)
    })
    expect(bars.length).toBe(5)
    const baseline = Math.max(...bars.map((b) => b.bottom))
    const standing = bars.filter((b) => Math.abs(b.bottom - baseline) <= 1)
    expect(standing.length).toBe(2)
    expect(bars.filter((b) => b.bottom < baseline - 2).length).toBe(3)
    const labels = await page.raw.evaluate(
      () => document.querySelector('[data-testid="g-waterfall"] svg.ts-chart')!.textContent ?? '',
    )
    expect(labels).toContain('+40')
    expect(labels).toContain('\u221225')
  })

  test('the navigator brush commits a custom window; a preset moves it back', async () => {
    const page = await open()
    const windowOf = (): Promise<string> =>
      page.raw.evaluate(
        () =>
          document.querySelector('[data-testid="g-navigator"]')!.getAttribute('data-window') ?? '',
      )
    expect(await windowOf()).toBe('1m 2026-12-01 2026-12-31')
    const handle = page.raw
      .locator('[data-testid="g-navigator"] [aria-label="Window start"]')
      .first()
    await handle.focus()
    await page.raw.keyboard.press('ArrowLeft')
    await page.settle()
    expect(await windowOf()).toMatch(/^custom /)
    await page.raw.locator('[data-testid="g-navigator"]').getByText('All', { exact: true }).click()
    await page.settle()
    expect(await windowOf()).toBe('all 2026-01-01 2026-12-31')
  })

  test('the data rows of a heat cell read its row average and its rank', async () => {
    const page = await open()
    await pointAt(page, 'g-heatmap', 0.55, 0.45)
    const tip = (await tooltips(page)).join(' ')
    expect(tip).toMatch(/(Mon|Tue|Wed) average/)
    expect(tip).toMatch(/Rank in row \d of 4/)
  })
})
