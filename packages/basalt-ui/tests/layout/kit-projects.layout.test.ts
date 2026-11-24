/**
 * The reading look of a monitoring table in real Chrome (docs/v3/issues/bench/bench-table-reading.json):
 * the playground's `/kit/projects` route, the factory console's Projects table rebuilt from shipped
 * kinds. At 1800 all ten columns draw with no `custom` column, grouped and flat, compact and
 * comfortable, light and dark; every toned mark carries its meaning in text; axe finds nothing serious;
 * at 390 the same rows read as cards with the same facts.
 *
 * Self-contained like `overview`: `kit-projects.css` is compiled with the Tailwind CLI into a temp
 * directory, the tier sheet `src/table/table.css` is inlined beside it, and the route bundles in memory.
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
  expectNoHorizontalOverflow,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const DESKTOP: Viewport = { name: 'shot 1800', width: 1800, height: 1200 }
const TABLE = '[data-shot="projects"] [data-slot="table-root"]'
const HEADERS = [
  'Project',
  'Now',
  'Shipped 7 d',
  'Last ship',
  'Cycle',
  'Queue wait',
  'Production',
  'Hygiene',
  'Plan',
  'Leads',
]

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'kit-projects-'))
  const cssOut = join(scratch, 'kit-projects.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(import.meta.dirname, 'kit-projects.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`kit-projects: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(import.meta.dirname, 'kit-projects-fixture.jsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`kit-projects: the fixture did not build:\n${build.logs.join('\n')}`)
  const client = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>kit-projects</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(client)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(
  viewport: Viewport,
  query = '',
  scheme: 'light' | 'dark' = 'light',
): Promise<LayoutPage> {
  const page = await openFixture(
    EMPTY_SPEC,
    viewport,
    `${documentPath}${query}`,
    'reduce',
    viewport.width <= 390 ? 'coarse' : 'fine',
  )
  await page.raw.waitForSelector(`${TABLE} tbody tr`)
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await page.raw.waitForTimeout(300)
  }
  await page.settle()
  return page
}

type Drawn = {
  headers: string[]
  custom: number
  groups: number
  rows: number
  rowHeight: number
}

/** What the table draws: the headers on screen, any custom cell, the group rows and a row's height. */
const drawn = (page: LayoutPage): Promise<Drawn> =>
  page.raw.evaluate((root) => {
    const table = document.querySelector(root)!
    const shown = (el: Element): boolean => {
      const box = el.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    const headers = [...table.querySelectorAll('[role="columnheader"]')]
      .filter(shown)
      .map((th) => th.getAttribute('aria-label') ?? th.textContent?.trim() ?? '')
    const row = table.querySelector<HTMLElement>('tbody tr:not([data-group])')
    return {
      headers,
      custom: table.querySelectorAll('[data-kind="custom"]').length,
      groups: table.querySelectorAll('tbody tr[data-group]').length,
      rows: table.querySelectorAll('tbody tr:not([data-group])').length,
      rowHeight: row?.getBoundingClientRect().height ?? 0,
    }
  }, TABLE)

const STATES = [
  { name: 'grouped, compact', query: '', groups: 6 },
  { name: 'grouped, comfortable', query: '?height=comfortable', groups: 6 },
  { name: 'flat, compact', query: '?rows=flat', groups: 0 },
  { name: 'flat, comfortable', query: '?rows=flat&height=comfortable', groups: 0 },
] as const

layout('the projects table at 1800', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const state of STATES) {
      test(`${state.name}, ${scheme}: all ten columns, no custom column`, async () => {
        const page = await open(DESKTOP, state.query, scheme)
        const d = await drawn(page)
        for (const header of HEADERS) expect(d.headers, header).toContain(header)
        expect(d.headers, 'the space folds into the group rows').not.toContain('Space')
        expect(d.custom).toBe(0)
        expect(d.groups).toBe(state.groups)
        expect(d.rows).toBe(31)
        expectNoHorizontalOverflow(await page.horizontalOverflow(), 'kit-projects', DESKTOP)
      })
    }
  }

  test('comfortable rows are taller than compact ones', async () => {
    const compact = await drawn(await open(DESKTOP, '?rows=flat'))
    const comfortable = await drawn(await open(DESKTOP, '?rows=flat&height=comfortable'))
    expect(comfortable.rowHeight).toBeGreaterThan(compact.rowHeight)
  })

  test('a group row is quiet: no tint, its label and count', async () => {
    const page = await open(DESKTOP)
    const group = await page.raw.evaluate((root) => {
      const row = document.querySelector<HTMLElement>(`${root} tbody tr[data-group]`)!
      return {
        ground: getComputedStyle(row).backgroundColor,
        text: row.textContent ?? '',
      }
    }, TABLE)
    expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(group.ground)
    expect(group.text).toContain('Infra')
    expect(group.text).toContain('3 rows')
  })

  test('every toned mark carries its meaning in text', async () => {
    const page = await open(DESKTOP)
    const silent = await page.raw.evaluate((root) => {
      const table = document.querySelector(root)!
      const out: string[] = []
      for (const lamp of table.querySelectorAll('[data-slot="table-lamp"]')) {
        if ((lamp.querySelector('[data-slot="table-lamp-word"]')?.textContent ?? '') === '')
          out.push('lamp')
      }
      for (const arrow of table.querySelectorAll('[data-slot="table-trend"]')) {
        const figure = arrow.closest('[data-slot="table-figure"]')
        if (!/(up|down|unchanged) from/.test(figure?.textContent ?? '')) out.push('trend')
      }
      for (const track of table.querySelectorAll('[data-slot="table-meter-stack"] [role="img"]')) {
        if ((track.getAttribute('aria-label') ?? '') === '') out.push('meter')
      }
      for (const figure of table.querySelectorAll('[data-slot="table-figure"][data-tone]')) {
        if (!/ of /.test(figure.textContent ?? '')) out.push('fraction')
      }
      return { out, lamps: table.querySelectorAll('[data-slot="table-lamp"]').length }
    }, TABLE)
    expect(silent.lamps).toBe(31)
    expect(silent.out).toEqual([])
  })

  test('a help mark opens its hint', async () => {
    const page = await open(DESKTOP)
    await page.raw.click('[role="columnheader"][aria-label="Cycle"] [data-slot="info-hint"]')
    await page.raw.waitForSelector('[role="dialog"]')
    const text = await page.raw.evaluate(
      () => document.querySelector('[role="dialog"]')?.textContent ?? '',
    )
    expect(text).toContain('Median time from filed to closed')
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`axe finds nothing serious or critical, ${scheme}`, async () => {
      const page = await open(DESKTOP, '', scheme)
      await page.raw.evaluate(axeSource)
      const violations = await page.raw.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: { run: () => Promise<{ violations: { id: string; impact: string }[] }> }
          }
        ).axe
        const result = await axe.run()
        return result.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => v.id)
      })
      expect(violations).toEqual([])
    })
  }
})

layout('the projects table at 390', () => {
  test('reads as a list row: the name, two values and the answer, the rest behind the tap', async () => {
    const page = await open(PHONE)
    const card = await page.raw.evaluate((root) => {
      const row = document.querySelector<HTMLElement>(`${root} tbody tr:not([data-group])`)!
      return {
        display: getComputedStyle(row).display,
        // every column the card draws: a cell on screen, by its column id
        shown: [...row.querySelectorAll<HTMLElement>('td[data-col]')]
          .filter((td) => td.getBoundingClientRect().width > 0)
          .map((td) => td.getAttribute('data-col')),
      }
    }, TABLE)
    expect(card.display).toBe('grid')
    expect(card.shown.toSorted()).toEqual(['name', 'open', 'shipped', 'lastShipAt'].toSorted())
    expectNoHorizontalOverflow(await page.horizontalOverflow(), 'kit-projects', PHONE)
  })

  test('axe finds nothing serious or critical on the cards', async () => {
    const page = await open(PHONE)
    await page.raw.evaluate(axeSource)
    const violations = await page.raw.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: { run: () => Promise<{ violations: { id: string; impact: string }[] }> }
        }
      ).axe
      const result = await axe.run()
      return result.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => v.id)
    })
    expect(violations).toEqual([])
  })
})
