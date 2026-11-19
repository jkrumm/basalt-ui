/**
 * Loading frames (expression cycle 11, `v3-expr-11-kit-fixes` 8): a loading `DataPanel` and `BarList` hold the
 * height their ready frame has, and a `PageSummary` skeleton is at least as tall as its loaded headline can
 * be at 390 (states.md: "the loaded summary is at most as tall as its skeleton at 390").
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
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'loading-frames-'))
  const cssOut = join(scratch, 'loading-frames.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'loading-frames.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`loading-frames: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'loading-frames-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`loading-frames: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>loading-frames</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style><style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="ready-panel"] tbody tr')
  await page.settle()
  return page
}

type Heights = Record<string, number>

/** The height of each frame's root, keyed by `<frame>-<phase>`. */
const heights = (page: LayoutPage): Promise<Heights> =>
  page.raw.evaluate(() => {
    const roots: Record<string, string> = {
      panel: '[data-slot="data-panel"]',
      list: '[data-slot="bar-list"]',
      summary: '[data-slot="page-summary"]',
    }
    const out: Record<string, number> = {}
    for (const [name, selector] of Object.entries(roots)) {
      for (const phase of ['loading', 'ready']) {
        const frame = document.querySelector(`[data-testid="${phase}-${name}"] ${selector}`)
        out[`${name}-${phase}`] = frame ? frame.getBoundingClientRect().height : -1
      }
    }
    return out
  })

const FRAMES = ['panel', 'list', 'summary'] as const

layout('loading frames hold the height of their ready frame', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`loading and ready heights match at ${viewport.width}px`, async () => {
      const h = await heights(await open(viewport))
      const off = FRAMES.filter((name) => {
        const diff = h[`${name}-loading`]! - h[`${name}-ready`]!
        // states.md: at 390 a loaded summary may be shorter than its skeleton, never taller.
        if (name === 'summary' && viewport === PHONE) return diff < -0.5
        return Math.abs(diff) >= 0.5
      })
      expect(
        off.map((name) => `${name} loading ${h[`${name}-loading`]} ready ${h[`${name}-ready`]}`),
      ).toEqual([])
    })
  }
})
