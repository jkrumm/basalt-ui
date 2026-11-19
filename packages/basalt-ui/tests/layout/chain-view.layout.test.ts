/**
 * ChainView and nested rows in real Chrome at 1800 and 390, over one dataset with a shared focus:
 * at 1800 the chain draws a fan-out, a fan-in and a blocked node with every edge ending on its
 * node's left side and no two nodes overlapping, pointing at a node marks its table row, and the
 * nested table indents three levels by its own lead. At 390 the chain is the nested list, the
 * table is cards that step in by level, and nothing scrolls sideways. Axe clean at both.
 *
 * Self-contained like `table-group`: the fixture CSS is compiled with the Tailwind CLI into a temp
 * directory, the tier sheet `src/table/table.css` is inlined beside it, and the fixture bundles in
 * memory.
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

const FIXTURE_DIR = import.meta.dirname
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide', width: 1800, height: 1000 }
const CHAIN = '[data-testid="cv-chain"]'
const TABLE = '[data-testid="cv-table"] [data-slot="table-root"]'

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'chain-view-'))
  const cssOut = join(scratch, 'chain-view.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'chain-view.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`chain-view: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'chain-view-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`chain-view: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>chain-view</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector(`${TABLE} tbody tr[aria-level]`)
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

async function expectAxeClean(page: LayoutPage): Promise<void> {
  await page.raw.addScriptTag({ content: axeSource })
  const violations = await page.raw.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: () => Promise<{
            violations: { id: string; impact: string; nodes: { html: string }[] }[]
          }>
        }
      }
    ).axe
    const result = await axe.run()
    return result.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html.slice(0, 120)).join(' | ')}`)
  })
  expect(violations).toEqual([])
}

layout('ChainView and nested rows', () => {
  test('1800: a fan-out, a fan-in and a blocked node, edges ending on their nodes, no overlap', async () => {
    const page = await open(WIDE)
    const m = await page.raw.evaluate((sel) => {
      const root = document.querySelector(sel)!
      const graph = root.querySelector<HTMLElement>('[data-slot="chain-graph"]')!
      const list = root.querySelector<HTMLElement>('[data-slot="chain-list"]')!
      const nodes = [...graph.querySelectorAll<HTMLElement>('[data-slot="chain-node"]')].map(
        (li) => {
          const r = li.getBoundingClientRect()
          return {
            id: li.dataset['id']!,
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
            blocked: li.querySelector('[data-blocked]') !== null,
          }
        },
      )
      const svg = graph.querySelector('svg')!.getBoundingClientRect()
      const edges = [...graph.querySelectorAll<SVGGElement>('[data-slot="chain-edge"]')].map(
        (g) => {
          const arrow = g.querySelectorAll('path')[1]!.getBoundingClientRect()
          return { state: g.dataset['state']!, tipX: arrow.right, tipY: arrow.y + arrow.height / 2 }
        },
      )
      return {
        graphShown: graph.getBoundingClientRect().height > 0,
        listShown: list.getBoundingClientRect().height > 0,
        svgX: svg.x,
        nodes,
        edges,
      }
    }, CHAIN)
    expect(m.graphShown).toBe(true)
    expect(m.listShown).toBe(false)
    expect(m.nodes).toHaveLength(8)
    expect(m.edges).toHaveLength(11)
    // Every edge's arrow tip touches the left side of exactly one node, inside its height.
    const targets = m.edges.map((e) =>
      m.nodes
        .filter((n) => Math.abs(n.x - e.tipX) <= 1.5 && e.tipY > n.y && e.tipY < n.y + n.h)
        .map((n) => n.id),
    )
    for (const t of targets) expect(t).toHaveLength(1)
    const into = (id: string) => targets.filter((t) => t[0] === id).length
    expect(into('f')).toBe(3) // fan-in
    expect(into('h')).toBe(2)
    // The fan-out: four edges leave a, all done because a is done.
    expect(m.edges.filter((e) => e.state === 'done').length).toBe(5)
    expect(m.nodes.find((n) => n.id === 'f')!.blocked).toBe(true)
    expect(m.nodes.find((n) => n.id === 'b')!.blocked).toBe(false)
    for (const a of m.nodes) {
      for (const b of m.nodes) {
        if (a.id >= b.id) continue
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlap).toBe(false)
      }
    }
  })

  test('1800: pointing at a node marks its row in the nested table', async () => {
    const page = await open(WIDE)
    await page.raw.hover(`${CHAIN} [data-slot="chain-graph"] [data-slot="chain-node"][data-id="g"]`)
    await page.settle()
    const marked = await page.raw.evaluate(
      (sel) =>
        [...document.querySelectorAll(`${sel} tbody tr[data-focused]`)].map(
          (tr) => tr.querySelector('[data-kind="entity"]')?.textContent ?? '',
        ),
      TABLE,
    )
    expect(marked).toEqual(['Backfill events'])
  })

  test('1800: the nested table indents three levels by its own lead', async () => {
    const page = await open(WIDE)
    const lead = await page.raw.evaluate((sel) => {
      const out: Record<string, number> = {}
      for (const tr of document.querySelectorAll<HTMLElement>(`${sel} tbody tr[aria-level]`)) {
        const level = tr.getAttribute('aria-level')!
        const pad = tr.querySelector<HTMLElement>('[data-slot="table-tree-lead"]')!
        out[level] = Number.parseFloat(getComputedStyle(pad).paddingInlineStart)
      }
      return out
    }, TABLE)
    expect(Object.keys(lead).toSorted()).toEqual(['1', '2', '3', '4'])
    expect(lead['1']).toBe(0)
    expect(lead['2']!).toBeGreaterThan(lead['1']!)
    expect(lead['3']!).toBeGreaterThan(lead['2']!)
  })

  test('390: the chain is the nested list, the table is cards that step in, nothing scrolls sideways', async () => {
    const page = await open(PHONE)
    const m = await page.raw.evaluate(
      ({ chain, table }) => {
        const root = document.querySelector(chain)!
        const graph = root.querySelector<HTMLElement>('[data-slot="chain-graph"]')!
        const items = [...root.querySelectorAll<HTMLElement>('[data-slot="chain-list-node"]')]
        const cards = [...document.querySelectorAll<HTMLElement>(`${table} tbody tr[aria-level]`)]
        const head = document.querySelector(`${table} thead`)!
        return {
          graphShown: graph.getBoundingClientRect().height > 0,
          levels: items.map((li) => li.dataset['level']),
          starts: items.map(
            (li) =>
              li.getBoundingClientRect().x +
              Number.parseFloat(getComputedStyle(li).paddingInlineStart),
          ),
          cardTier: head.getBoundingClientRect().height <= 1,
          cardPad: cards.map(
            (tr) =>
              [
                tr.getAttribute('aria-level'),
                Number.parseFloat(getComputedStyle(tr).paddingInlineStart),
              ] as const,
          ),
        }
      },
      { chain: CHAIN, table: TABLE },
    )
    expect(m.graphShown).toBe(false)
    expect(m.levels.length).toBe(8)
    expect(m.levels).toContain('3')
    const startOf = (level: string) => m.starts[m.levels.indexOf(level)]!
    expect(startOf('2')).toBeGreaterThan(startOf('1'))
    expect(startOf('3')).toBeGreaterThan(startOf('2'))
    expect(m.cardTier).toBe(true)
    const padOf = (level: string) => m.cardPad.find(([l]) => l === level)![1]
    expect(padOf('2')).toBeGreaterThan(padOf('1'))
    expect(padOf('3')).toBeGreaterThan(padOf('2'))
    expectNoHorizontalOverflow(
      await page.horizontalOverflow(),
      'the chain and the nested table',
      PHONE,
    )
  })

  for (const viewport of [WIDE, PHONE]) {
    test(`${viewport.width}: axe clean`, async () => {
      const page = await open(viewport)
      await expectAxeClean(page)
    })
  }
})
