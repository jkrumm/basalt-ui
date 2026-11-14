/**
 * S10 (docs/v3/concepts/charts-cards-kanban.md section 9): the two-pane recipe in real Chrome. Criterion
 * 1: both panes' plot x ranges are equal within 1 px at 1440. The verdict is recorded in
 * `docs/v3/spikes/two-pane.md`; on FAIL this asserts the named limit instead.
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
  scratch = mkdtempSync(join(tmpdir(), 'two-pane-'))
  const cssOut = join(scratch, 'two-pane.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'two-pane.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`two-pane: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'two-pane-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
    // The public `./charts` export still carries the 2.x chart: point the recipe's import at the v3 parts.
    plugins: [
      {
        name: 'v3-charts',
        setup(b) {
          b.onResolve({ filter: /^basalt-ui\/charts$/ }, () => ({
            path: join(FIXTURE_DIR, 'two-pane-charts.ts'),
          }))
        },
      },
    ],
  })
  if (!build.success)
    throw new Error(`two-pane: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>two-pane</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

const SPIKE = readFileSync(join(REPO_ROOT, 'docs', 'v3', 'spikes', 'two-pane.md'), 'utf8')
const VERDICT = /^Verdict: (PASS|FAIL)$/.exec(SPIKE.split('\n')[0] ?? '')?.[1]

layout('two-pane recipe', () => {
  test('1440: the plot x ranges of both panes (S10 criterion 1)', async () => {
    const page = await openFixture(EMPTY_SPEC, DESKTOP_1440, documentPath, 'reduce', 'fine')
    await page.raw.waitForSelector('[data-testid="two-pane"] svg')
    await page.settle()
    const panes = (await page.raw.evaluate(() =>
      [...document.querySelectorAll('[data-testid="two-pane"] svg')].map((svg) => {
        // The marks clip rect is the plot; both panes share one viewBox width, so svg units are px.
        const clip = svg.querySelector('clipPath rect')!
        const left = Number(clip.getAttribute('x')) + svg.getBoundingClientRect().left
        return { left, right: left + Number(clip.getAttribute('width')) }
      }),
    )) as { left: number; right: number }[]
    expect(panes).toHaveLength(2)
    const [a, b] = panes as [{ left: number; right: number }, { left: number; right: number }]
    const skew = Math.max(Math.abs(a.left - b.left), Math.abs(a.right - b.right))
    expect(VERDICT).toBeDefined()
    // PASS: one day sits on one pixel column. FAIL: the named limit holds (`compileCartesian` does
    // not read `yGutter`, so each pane's y labels still size its own margin); a fix turns this red.
    if (VERDICT === 'PASS') expect(skew).toBeLessThanOrEqual(1)
    else expect(skew).toBeGreaterThan(1)
  })
})
