/**
 * Owner review 2 rerun, chart items (`v3-owner-2-rerun-kit-fixes`), in real Chrome:
 *
 * - charts stacked on one x draw the x chip once, on the panel that labels the axis, and no chip covers
 *   a tick label (the same check the quality matrix's hover guard runs);
 * - a stack of zeros reads 0 under the pointer, never the 0.03 its zero tick is drawn at;
 * - a y title keeps clear of the keyboard focus ring.
 *
 * The page is self-contained: `fixture/charts-owner2-rerun.css` is compiled with the Tailwind CLI into a
 * temp directory and `fixture/charts-owner2-rerun-fixture.tsx` is bundled in memory.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chipFindingsNow } from '../quality/matrix/hover-shift'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const DESKTOP: Viewport = { name: 'desktop', width: 1800, height: 1200 }
/** The days of the `or-zero` fixture. */
const DAYS_IN_ZERO = 6
const SHARES = Array.from({ length: 25 }, (_, i) => 0.04 + i * 0.038)

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-owner2-rerun-'))
  const cssOut = join(scratch, 'charts-owner2-rerun.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-owner2-rerun.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-owner2-rerun: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-owner2-rerun-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-owner2-rerun: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-owner2-rerun</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, DESKTOP, documentPath, 'reduce')
  await page.raw.waitForSelector('[data-testid="or-title"] svg')
  await page.settle()
  return page
}

const frame = (page: LayoutPage): Promise<void> =>
  page.raw.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  )

/** Moves the pointer over the first chart of the box `id` at `share` of its width, half way down. */
async function hoverAt(page: LayoutPage, id: string, share: number): Promise<void> {
  const box = await page.raw.evaluate((testid) => {
    const svg = document.querySelector(`[data-testid="${testid}"] svg`)!
    svg.scrollIntoView({ block: 'center' })
    const r = svg.getBoundingClientRect()
    return { l: r.left, t: r.top, w: r.width, h: r.height }
  }, id)
  await page.raw.mouse.move(box.l + box.w * Math.max(0.02, share - 0.02), box.t + box.h / 2)
  await page.raw.mouse.move(box.l + box.w * share, box.t + box.h / 2)
  await frame(page)
}

/** The text of each hover chip of the box `id` on the axis `axis`. */
const chipsOf = (page: LayoutPage, id: string, axis: 'x' | 'y'): Promise<string[]> =>
  page.raw.evaluate(
    ([testid, which]) =>
      [
        ...document.querySelectorAll(
          `[data-testid="${testid}"] .ts-chart__crosshair-label--${which}.ts-chart__crosshair-label-text`,
        ),
      ].map((el) => el.textContent ?? ''),
    [id, axis] as const,
  )

layout('owner review 2 rerun: chart hover chips and focus ring', () => {
  test('charts stacked on one x draw the x chip once, and no chip covers a tick label', async () => {
    const page = await open()
    let drawn = 0
    for (const share of SHARES) {
      await hoverAt(page, 'or-stack', share)
      const xChips = await chipsOf(page, 'or-stack', 'x')
      expect(
        xChips.length,
        `x chips at ${share.toFixed(2)}: ${xChips.join(' | ')}`,
      ).toBeLessThanOrEqual(1)
      drawn += xChips.length
      expect(await chipFindingsNow(page.raw), `at ${share.toFixed(2)}`).toEqual([])
    }
    expect(drawn, 'the labelled panel draws the x chip').toBeGreaterThan(0)
  })

  test('a day of zeros reads 0 under the keyboard, never the height its tick is drawn at', async () => {
    const page = await open()
    const svg = page.raw.locator('[data-testid="or-zero"] svg.ts-chart')
    await svg.scrollIntoViewIfNeeded()
    await svg.focus()
    const seen: string[] = []
    for (let step = 0; step < DAYS_IN_ZERO; step++) {
      await page.raw.keyboard.press('ArrowRight')
      await frame(page)
      seen.push(...(await chipsOf(page, 'or-zero', 'y')))
    }
    expect(
      seen.filter((text) => !/^\d+$/.test(text)),
      `y chips: ${seen.join(' ')}`,
    ).toEqual([])
    expect(seen).toContain('0')
  })

  test('the y title starts clear of the keyboard focus ring', async () => {
    const page = await open()
    const svg = page.raw.locator('[data-testid="or-title"] svg.ts-chart')
    await svg.scrollIntoViewIfNeeded()
    await svg.focus()
    await page.raw.keyboard.press('ArrowRight')
    await frame(page)
    const read = await page.raw.evaluate(() => {
      const chart = document.querySelector('[data-testid="or-title"] svg.ts-chart')!
      const title = [...chart.querySelectorAll('g.ts-chart__axes text')].find(
        (el) => el.textContent === 'Rain chance, %',
      )!
      const ring = getComputedStyle(chart)
      return {
        ringWidth: ring.outlineStyle === 'none' ? 0 : Number.parseFloat(ring.outlineWidth),
        ringOffset: Number.parseFloat(ring.outlineOffset),
        gap: title.getBoundingClientRect().left - chart.getBoundingClientRect().left,
      }
    })
    expect(read.ringWidth, 'the chart shows its ring').toBeGreaterThan(0)
    // The ring is inset: it fills the chart's outermost `ringWidth` px from `-ringOffset` in; the title starts past it.
    expect(read.gap).toBeGreaterThanOrEqual(read.ringWidth - read.ringOffset)
  })
})
