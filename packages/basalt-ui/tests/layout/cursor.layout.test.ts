/**
 * The cursor law (`src/css/cursor.css`), in real Chrome with the real Tailwind output: what acts on a
 * click shows a pointer, a disabled control `not-allowed`, a draggable item a grab hand and a text
 * field its text cursor. Asserted here because happy-dom computes no cascade layers.
 *
 * Self-contained like `table-short-text`: the fixture CSS is compiled with the Tailwind CLI into a temp
 * directory, the tier sheet `src/table/table.css` is inlined beside it, and the fixture bundles in memory.
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

const FIXTURE_DIR = import.meta.dirname
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'cursor-'))
  const cssOut = join(scratch, 'cursor.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync([cli, '--input', join(FIXTURE_DIR, 'cursor.css'), '--output', cssOut], {
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (css.exitCode !== 0) throw new Error(`cursor: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'cursor-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`cursor: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(REPO_ROOT, 'packages', 'basalt-ui', 'src', 'table', 'table.css'),
    'utf8',
  )
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>cursor</title><style>${readFileSync(cssOut, 'utf8')}</style><style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, DESKTOP_1440, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="board"] [data-slot="board-item"][draggable="true"]')
  await page.raw.waitForSelector('[role="menuitem"]')
  await page.settle()
  return page
}

/** The computed cursor of the first element `selector` matches. */
const cursorOf = (page: LayoutPage, selector: string): Promise<string> =>
  page.raw.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)
    if (el === null) throw new Error(`no element for ${sel}`)
    return getComputedStyle(el).cursor
  }, selector)

layout('the cursor law', () => {
  const POINTER: [string, string][] = [
    ['an enabled button', '[data-testid="button"] button'],
    ['a menu item', '[role="menuitem"]'],
    ['a tab', '[data-testid="tabs"] [role="tab"]'],
    ['a select trigger', '[data-testid="select"] [data-slot="select-trigger"]'],
    ['a clickable table row', '[data-testid="table"] tbody tr[data-activatable]'],
    ['a clickable stat card', '[data-testid="stat"] [data-slot="stat-target"]'],
  ]
  for (const [name, selector] of POINTER)
    test(`${name} shows a pointer`, async () => {
      const page = await open()
      expect(await cursorOf(page, selector)).toBe('pointer')
    })

  test('a disabled button shows not-allowed', async () => {
    const page = await open()
    expect(await cursorOf(page, '[data-testid="button-disabled"] button')).toBe('not-allowed')
  })

  test('a draggable board item and a sortable handle show the grab hand', async () => {
    const page = await open()
    expect(await cursorOf(page, '[data-testid="board"] [data-slot="board-item"]')).toBe('grab')
    expect(await cursorOf(page, '[data-testid="sortable"] [data-sortable="handle"]')).toBe('grab')
  })

  test('a text input keeps the text cursor', async () => {
    const page = await open()
    expect(await cursorOf(page, '[data-testid="input"] input')).toBe('text')
  })
})
