/**
 * Chart focus, mouse and keyboard, in real Chrome at 1440: a click on each chart kind paints no focus
 * outline (the `:focus:not(:focus-visible)` reset in `chart-box.module.css`), and a Tab onto each kind
 * paints the kit ring, a solid outline of at least 2 px (`:where([tabindex]):focus-visible` in
 * `typography.css`). Asserted here because happy-dom has no paint and no focus-visible.
 *
 * The page is self-contained: `fixture/charts-click-focus.css` is compiled with the Tailwind CLI into a
 * temp directory and `fixture/charts-click-focus-fixture.tsx` is bundled in memory (its CSS modules
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

/**
 * Each kind's probe. `target` is what a pointer click aims at, `click` is the element that then takes
 * focus, and `tab` is the element a Tab from the probe's `cf-before-<kind>` button lands on. An engine
 * host's Tab stop is its wrapper (`data-chart-focus`); a click on its plot focuses the plot's own svg.
 */
const KINDS = [
  {
    id: 'lines',
    target: 'svg.ts-chart',
    click: 'svg.ts-chart',
    tab: '[data-chart-focus][tabindex="0"]',
  },
  {
    id: 'bars',
    target: 'svg.ts-chart',
    click: 'svg.ts-chart',
    tab: '[data-chart-focus][tabindex="0"]',
  },
  {
    id: 'cartesian',
    target: 'svg.ts-chart',
    click: 'svg.ts-chart',
    tab: '[data-chart-focus][tabindex="0"]',
  },
  {
    id: 'heatmap',
    target: 'svg.ts-chart',
    click: 'svg.ts-chart',
    tab: '[data-chart-focus][tabindex="0"]',
  },
  {
    id: 'band-strip',
    target: 'svg.ts-chart',
    click: 'svg.ts-chart[tabindex="0"]',
    tab: 'svg.ts-chart[tabindex="0"]',
  },
  {
    id: 'interval-track',
    target: 'svg.ts-chart',
    click: 'svg.ts-chart',
    tab: '[data-chart-focus][tabindex="0"]',
  },
  {
    id: 'sparkline',
    target: '[data-slot="sparkline"]',
    click: '[data-slot="sparkline"][tabindex="0"]',
    tab: '[data-slot="sparkline"][tabindex="0"]',
  },
  {
    id: 'seam',
    target: '[role="group"][aria-roledescription="chart"]',
    click: '[role="group"][aria-roledescription="chart"]',
    tab: '[role="group"][aria-roledescription="chart"]',
  },
] as const

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-click-focus-'))
  const cssOut = join(scratch, 'charts-click-focus.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-click-focus.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-click-focus: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-click-focus-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-click-focus: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  // The chart CSS modules come out as sibling artifacts: inline them beside the Tailwind sheet.
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-click-focus</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, DESKTOP_1440, documentPath, 'reduce')
  await page.raw.waitForSelector('[data-testid="cf-lines"] svg.ts-chart')
  await page.raw.waitForSelector('[data-testid="cf-seam"] [role="group"]')
  await page.settle()
  return page
}

type Focused = {
  inside: boolean
  matches: boolean
  label: string
  outlineStyle: string
  outlineWidth: number
}

/** The document's focused element: whether it sits in the probe and matches `focus`, and its painted outline. */
const focused = (page: LayoutPage, testId: string, focus: string): Promise<Focused> =>
  page.raw.evaluate(
    ({ testId, focus }) => {
      const probe = document.querySelector(`[data-testid="${testId}"]`)
      const el = document.activeElement
      if (el === null || el === document.body) {
        return { inside: false, matches: false, label: 'body', outlineStyle: '', outlineWidth: 0 }
      }
      const style = getComputedStyle(el)
      const cls = (el.getAttribute('class') ?? '').split(' ')[0]
      const role = el.getAttribute('role')
      return {
        inside: probe !== null && probe.contains(el),
        matches: el.matches(focus),
        label: `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${role ? ` role=${role}` : ''}`,
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      }
    },
    { testId, focus },
  )

layout('chart focus paint, click and Tab', () => {
  for (const { id, target, click, tab } of KINDS) {
    const testId = `cf-${id}`

    test(`a click on ${id} paints no outline`, async () => {
      const page = await open()
      await page.raw.evaluate(
        ({ testId, target }) => {
          document.querySelector(`[data-testid="${testId}"] ${target}`)!.scrollIntoView({
            block: 'center',
            behavior: 'instant',
          })
        },
        { testId, target },
      )
      // Engine charts measure as they come into view, which moves what sits below them: measure once quiet.
      await page.quiesce()
      const at = await page.raw.evaluate(
        ({ testId, target }) => {
          const r = document
            .querySelector(`[data-testid="${testId}"] ${target}`)!
            .getBoundingClientRect()
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        },
        { testId, target },
      )
      await page.raw.mouse.click(at.x, at.y)
      await page.settle()
      const active = await focused(page, testId, click)
      expect(active.inside, `focus after click: ${active.label}`).toBe(true)
      expect(active.matches, `focus after click: ${active.label}, expected ${click}`).toBe(true)
      expect(
        active.outlineStyle === 'none' || active.outlineWidth === 0,
        `${active.label}: outline ${active.outlineStyle} ${active.outlineWidth}px`,
      ).toBe(true)
    })

    test(`Tab on ${id} paints the ring`, async () => {
      const page = await open()
      await page.raw.focus(`[data-testid="cf-before-${id}"]`)
      await page.raw.keyboard.press('Tab')
      await page.settle()
      const active = await focused(page, testId, tab)
      expect(active.inside, `focus after Tab: ${active.label}`).toBe(true)
      expect(active.matches, `focus after Tab: ${active.label}, expected ${tab}`).toBe(true)
      expect(active.outlineStyle, active.label).toBe('solid')
      expect(active.outlineWidth, active.label).toBeGreaterThanOrEqual(2)
    })
  }
})
