/**
 * ChainView and nested rows in real Chrome at 1800 and 390, over one dataset with a shared focus:
 * at 1800 the chain draws a fan-out, a fan-in and a blocked node with every edge leaving its
 * blocker's right-middle port and ending on its node's left-middle port, no two nodes overlapping,
 * pointing at a node marks its table row, and the nested table indents three levels by its own
 * lead. A generated chain of 12 columns opens fitted to its frame's width at the half-size floor,
 * zooms by key and by Ctrl with the wheel around the pointer, pans by a drag on empty canvas, and
 * holds one node's trace in focus mode until Show all. At 390 the chain is the nested list, the
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
const LARGE = '[data-testid="cv-large"]'
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
      const screen = (path: SVGPathElement, at: number) => {
        const point = path.getPointAtLength(at).matrixTransform(path.getScreenCTM()!)
        return { x: point.x, y: point.y }
      }
      const edges = [...graph.querySelectorAll<SVGPathElement>('[data-slot="chain-edge"]')].map(
        (path) => {
          const tip = screen(path, path.getTotalLength())
          const tail = screen(path, 0)
          return {
            state: path.dataset['state']!,
            tipX: tip.x,
            tipY: tip.y,
            tailX: tail.x,
            tailY: tail.y,
            marker: path.getAttribute('marker-end') ?? '',
          }
        },
      )
      return {
        graphShown: graph.getBoundingClientRect().height > 0,
        listShown: list.getBoundingClientRect().height > 0,
        nodes,
        edges,
      }
    }, CHAIN)
    expect(m.graphShown).toBe(true)
    expect(m.listShown).toBe(false)
    expect(m.nodes).toHaveLength(8)
    expect(m.edges).toHaveLength(11)
    // Every edge ends on the left-middle port of exactly one node and starts on the right-middle
    // port of another, under an arrowhead marker.
    const middle = (n: { y: number; h: number }) => n.y + n.h / 2
    const targets = m.edges.map((e) =>
      m.nodes
        .filter((n) => Math.abs(n.x - e.tipX) <= 1.5 && Math.abs(middle(n) - e.tipY) <= 1.5)
        .map((n) => n.id),
    )
    for (const t of targets) expect(t).toHaveLength(1)
    for (const e of m.edges) {
      const sources = m.nodes.filter(
        (n) => Math.abs(n.x + n.w - e.tailX) <= 1.5 && Math.abs(middle(n) - e.tailY) <= 1.5,
      )
      expect(sources).toHaveLength(1)
      expect(e.marker).toMatch(/^url\(#.+-(blocks|done)\)$/)
    }
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

  test('1800: a chain wider than its frame opens fitted at the half-size floor, never past the visible height', async () => {
    const page = await open(WIDE)
    const m = await page.raw.evaluate((sel) => {
      const graph = document.querySelector<HTMLElement>(`${sel} [data-slot="chain-graph"]`)!
      const frame = graph.querySelector<HTMLElement>('[data-slot="scroll-area"]')!
      const list = graph.querySelector<HTMLElement>('ul')!
      return {
        zoom: Number(graph.dataset['zoom']),
        fitted: graph.dataset['fitted'] !== undefined,
        frameW: frame.clientWidth,
        frameH: frame.getBoundingClientRect().height,
        graphW: list.offsetWidth,
        canvasW: frame.querySelector<HTMLElement>('[data-slot="chain-canvas"]')!.offsetWidth,
        room: window.innerHeight,
      }
    }, LARGE)
    expect(m.fitted).toBe(true)
    expect(m.zoom).toBeCloseTo(Math.max(0.5, Math.min(1, m.frameW / m.graphW)), 2)
    expect(Math.abs(m.canvasW - m.graphW * m.zoom)).toBeLessThanOrEqual(2)
    expect(m.frameH).toBeLessThanOrEqual(m.room)
    // Above the floor the whole width is in view.
    if (m.zoom > 0.5) expect(m.canvasW).toBeLessThanOrEqual(m.frameW + 1)
  })

  test('1800: +, - and 0 zoom from the frame; Ctrl with the wheel zooms around the pointer', async () => {
    const page = await open(WIDE)
    const graph = page.raw.locator(`${LARGE} [data-slot="chain-graph"]`)
    const zoom = async () => Number(await graph.getAttribute('data-zoom'))
    const fitted = await zoom()
    await graph.locator('[data-slot="scroll-area"]').focus()
    await page.raw.keyboard.press('+')
    expect(await zoom()).toBeCloseTo(fitted * 1.25, 2)
    expect(await graph.getAttribute('data-fitted')).toBeNull()
    await page.raw.keyboard.press('-')
    await page.raw.keyboard.press('-')
    expect(await zoom()).toBeCloseTo(fitted / 1.25, 2)
    await page.raw.keyboard.press('0')
    expect(await zoom()).toBeCloseTo(fitted, 2)
    expect(await graph.getAttribute('data-fitted')).toBe('')
    // A plain wheel scrolls; Ctrl with the wheel zooms in and keeps the point under the pointer.
    const box = (await graph.locator('[data-slot="scroll-area"]').boundingBox())!
    await page.raw.mouse.move(box.x + box.width / 2, box.y + 100)
    await page.raw.mouse.wheel(0, 100)
    expect(await zoom()).toBeCloseTo(fitted, 2)
    await page.raw.keyboard.down('Control')
    await page.raw.mouse.wheel(0, -100)
    await page.raw.keyboard.up('Control')
    await page.settle()
    expect(await zoom()).toBeGreaterThan(fitted)
  })

  test('1800: a drag on empty canvas pans the frame', async () => {
    const page = await open(WIDE)
    const frame = page.raw.locator(`${LARGE} [data-slot="chain-graph"] [data-slot="scroll-area"]`)
    await frame.scrollIntoViewIfNeeded()
    // Zoomed in past the fit, the graph is wider than the frame.
    await frame.focus()
    for (let i = 0; i < 3; i++) await page.raw.keyboard.press('+')
    expect(await frame.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
    // A point of empty canvas: no node under it.
    const spot = await frame.evaluate((el) => {
      const box = el.getBoundingClientRect()
      const y = Math.max(box.top, 0) + 60
      for (let x = box.left + 10; x < box.right - 10; x += 4) {
        const slot = document
          .elementFromPoint(x, y)
          ?.closest('[data-slot]')
          ?.getAttribute('data-slot')
        if (slot === 'chain-canvas') return { x, y }
      }
      return null
    })
    expect(spot).not.toBeNull()
    const { x, y } = spot!
    const before = await frame.evaluate((el) => el.scrollLeft)
    await page.raw.mouse.move(x, y)
    await page.raw.mouse.down()
    await page.raw.mouse.move(x - 150, y - 20, { steps: 5 })
    await page.raw.mouse.up()
    const after = await frame.evaluate((el) => el.scrollLeft)
    expect(after - before).toBeCloseTo(150, -1)
    // Fit returns to the origin, and a second Fit on the fitted view still does.
    await frame.focus()
    await page.raw.keyboard.press('0')
    await frame.evaluate((el) => el.scrollTo(40, 0))
    await page.raw.keyboard.press('0')
    expect(await frame.evaluate((el) => el.scrollLeft)).toBe(0)
  })

  test('1800: pointing at a node lights its trace; Focus holds and zooms to it until Show all', async () => {
    const page = await open(WIDE)
    const root = page.raw.locator(LARGE)
    const graph = root.locator('[data-slot="chain-graph"]')
    const node = graph.locator('[data-slot="chain-node"][data-id="n5-4"]')
    await node.scrollIntoViewIfNeeded()
    await node.hover()
    const dimmed = () => graph.locator('[data-slot="chain-node"][data-dimmed]').count()
    const lit = 120 - (await dimmed())
    expect(lit).toBeGreaterThan(1)
    expect(lit).toBeLessThan(120)
    const focus = root.getByRole('button', { name: 'Focus on Task 6.5' })
    await focus.click()
    expect(await graph.getAttribute('data-held')).toBe('n5-4')
    expect(await dimmed()).toBe(120 - lit)
    expect(await graph.getAttribute('data-fitted')).toBeNull()
    await root.getByRole('button', { name: 'Show all' }).click()
    expect(await graph.getAttribute('data-held')).toBeNull()
    expect(await graph.getAttribute('data-fitted')).toBe('')
  })

  for (const viewport of [WIDE, PHONE]) {
    test(`${viewport.width}: axe clean`, async () => {
      const page = await open(viewport)
      await expectAxeClean(page)
    })
  }
})
