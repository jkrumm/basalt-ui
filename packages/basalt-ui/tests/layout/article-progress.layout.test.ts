/**
 * The reading-progress bar in real Chrome: 0 at the top, 1 at the end, on the document and on a
 * shell-style scrollport, with and without a `target`. happy-dom has no scroll timelines, so the
 * fill's computed `transform` (the animation's resolved value) is the proof. Self-contained like
 * `content.layout.test.ts`; `fixture/content.css` supplies the Tailwind sheet.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const WINDOW: Viewport = { name: 'desktop', width: 1000, height: 700 }
// The fixture's column: a 300px spacer, a 2000px target, a 200px tail; the port is 600px tall.
const [SPACER, ARTICLE, TAIL, PORT] = [300, 2000, 200, 600]

let documentPath = ''
let scratch = ''

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
afterAll(() => scratch && rmSync(scratch, { recursive: true, force: true }))

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'article-progress-'))
  const cssOut = join(scratch, 'out.css')
  const css = Bun.spawnSync(
    [
      join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss'),
      '--input',
      join(FIXTURE_DIR, 'content.css'),
      '--output',
      cssOut,
    ],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`article-progress: tailwind failed:\n${css.stderr}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'article-progress-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`article-progress: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = (await build.outputs[0]!.text()).replaceAll('</script', '<\\/script')
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" /><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body style="margin:0"><div id="root"></div><script type="module">${js}</script></body></html>`,
  )
})

/** Scrolls to `top`, waits two frames, reads the fill's resolved scaleX. */
async function progressAt(page: LayoutPage, top: number): Promise<number> {
  return page.raw.evaluate(async (y) => {
    ;(document.getElementById('port') ?? document.documentElement).scrollTop = y
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const fill = document.querySelector<HTMLElement>('[aria-hidden="true"] > div')!
    return new DOMMatrix(getComputedStyle(fill).transform).a
  }, top)
}

async function expectTrack(mode: string, starts: number, ends: number) {
  const page = await openFixture(
    { sections: [] } as FixtureSpec,
    WINDOW,
    `${documentPath}#${mode}`,
    'reduce',
    'fine',
  )
  await page.settle()
  expect(await progressAt(page, 0)).toBeCloseTo(0, 2)
  expect(await progressAt(page, starts)).toBeCloseTo(0, 2)
  expect(await progressAt(page, (starts + ends) / 2)).toBeCloseTo(0.5, 2)
  expect(await progressAt(page, ends)).toBeCloseTo(1, 2)
}

const end = (view: number) => SPACER + ARTICLE + TAIL - view

layout('ArticleProgress — a scroll timeline in real geometry', () => {
  test('the document, no target', () => expectTrack('window', 0, end(WINDOW.height)))
  test('the document, a target', () =>
    expectTrack('window-target', SPACER, SPACER + ARTICLE - WINDOW.height))
  test('a shell-style scrollport, no target', () => expectTrack('port', 0, end(PORT)))
  test('a shell-style scrollport, a target', () =>
    expectTrack('port-target', SPACER, SPACER + ARTICLE - PORT))
})
