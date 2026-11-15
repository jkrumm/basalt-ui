/**
 * The table tiers reach an app that imports `basalt-ui/table` and nothing else (wiring cycle 2,
 * `docs/v3/issues/cycles/v3-wiring-2-table-css.json`). The fixture is a four-column client table;
 * Vite builds it for real, once with `basalt()` and once without, and neither build is given
 * `basalt-ui/table.css`. At 390x844 the first is cards whose money value keeps its currency; the
 * second is the cycle-1 failure the plugin removes, a phone table that is still a table.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import type { Plugin } from 'vite'
import { basalt } from '../../src/vite/index'
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

const FIXTURE_DIR = import.meta.dirname
const PACKAGE_ROOT = join(FIXTURE_DIR, '..', '..')
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const ROOT = '[data-testid="orders"]'

const documents: Record<'with' | 'without', string> = { with: '', without: '' }
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

/** The app's imports of `basalt-ui/table`, resolved to this checkout's source like a workspace app. */
const workspaceAlias: Plugin = {
  name: 'table-sheet-alias',
  enforce: 'pre',
  config: () => ({
    resolve: {
      alias: [
        {
          find: /^basalt-ui\/table\.css$/,
          replacement: join(PACKAGE_ROOT, 'src', 'table', 'table.css'),
        },
        { find: /^basalt-ui\/table$/, replacement: join(PACKAGE_ROOT, 'src', 'table', 'index.ts') },
      ],
    },
  }),
}

async function bundle(withPlugin: boolean): Promise<{ js: string; css: string }> {
  const out = (await build({
    root: FIXTURE_DIR,
    configFile: false,
    logLevel: 'silent',
    plugins: [workspaceAlias, ...(withPlugin ? [basalt({ sources: false })] : [])],
    mode: 'production',
    oxc: { jsx: { runtime: 'automatic', development: false } },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      lib: { entry: join(FIXTURE_DIR, 'table-sheet-fixture.tsx'), formats: ['es'] },
    },
  })) as unknown as { output: { fileName: string; code?: string; source?: string | Uint8Array }[] }
  const files = Array.isArray(out) ? out.flatMap((o) => (o as typeof out).output) : out.output
  const js = files.find((f) => f.fileName.endsWith('.js'))?.code ?? ''
  const css = files
    .filter((f) => f.fileName.endsWith('.css'))
    .map((f) => String(f.source))
    .join('\n')
  return { js, css }
}

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-sheet-'))
  const cssOut = join(scratch, 'table-sheet.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const tailwind = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-sheet.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (tailwind.exitCode !== 0)
    throw new Error(`table-sheet: tailwind failed:\n${tailwind.stderr.toString()}`)
  const base = readFileSync(cssOut, 'utf8')

  for (const key of ['with', 'without'] as const) {
    const { js, css } = await bundle(key === 'with')
    documents[key] = serveDocument(
      `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
        `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
        `<title>table-sheet ${key}</title><style>${base}</style><style>${css}</style></head>` +
        `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
    )
  }
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(key: 'with' | 'without'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, PHONE, documents[key], 'reduce', 'fine')
  await page.raw.waitForSelector(`${ROOT} tbody tr`)
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

type Probe = { display: string; customerWidth: number; moneyUnit: string; moneyText: string }

const probe = (page: LayoutPage): Promise<Probe> =>
  page.raw.evaluate((root) => {
    const row = document.querySelector(`${root} tbody tr`)!
    const customer = row.querySelector<HTMLElement>('td[data-kind="entity"]')!
    const money = row.querySelector<HTMLElement>('td[data-kind="money"]')!
    return {
      display: getComputedStyle(customer).display,
      customerWidth: customer.getBoundingClientRect().width,
      moneyUnit: getComputedStyle(money, '::after').content,
      moneyText: money.textContent ?? '',
    }
  }, ROOT)

layout('Table tiers without a second import, 390x844', () => {
  test('with basalt(), the phone table is cards and the customer cell has room', async () => {
    const page = await open('with')
    const seen = await probe(page)
    expect(seen.display).toBe('block')
    expect(seen.customerWidth).toBeGreaterThan(150)
  })

  test('with basalt(), the card keeps the currency its column header carried', async () => {
    const page = await open('with')
    const seen = await probe(page)
    expect(seen.moneyText).toContain('1,200.00')
    expect(seen.moneyUnit).toContain('EUR')
  })

  test('without basalt() and without the sheet, the phone table stays a table', async () => {
    const page = await open('without')
    const seen = await probe(page)
    expect(seen.display).toBe('table-cell')
  })
})
