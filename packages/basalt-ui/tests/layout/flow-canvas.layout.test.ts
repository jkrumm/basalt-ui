/**
 * FlowCanvas in real Chrome at 1800 and 390. At 1800: every edge starts on its source's right side
 * and ends on its target's left side (a same-column target: its right side) at the anchor's middle,
 * and keeps doing so through a fold (a row anchor moves onto its header), a zoom and a resize (the
 * docked panel goes, the frame widens and refits); the issue's edge takes the warn tone; the pointer
 * tool pans by a drag on empty ground, the hand tool by a drag on a group; the wheel pans and Ctrl
 * with the wheel zooms; the zoom menu sets 125 per cent and fits; a checklist item focuses its row.
 * At 390 the groups stack in source order, no edge and no tool shows, and nothing scrolls sideways.
 * Axe clean at both.
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
const CANVAS = '[data-slot="flow-canvas"]'
const FRAME = `${CANVAS} [data-slot="scroll-area"]`

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'flow-canvas-'))
  const cssOut = join(scratch, 'flow-canvas.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'flow-canvas.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`flow-canvas: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'flow-canvas-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`flow-canvas: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>flow-canvas</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-slot="flow-row"]')
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

async function frames(page: LayoutPage, n = 2): Promise<void> {
  for (let i = 0; i < n; i++) {
    await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  }
  await page.settle()
}

type EdgeFit = { edge: string; tone: string | null; start: number; end: number }

/** How far (px, on screen) each edge's ends sit from where its anchors say they should. */
async function edgeFit(page: LayoutPage): Promise<EdgeFit[]> {
  return page.raw.evaluate((canvas) => {
    const root = document.querySelector(canvas)!
    const anchorBox = (id: string) => {
      let el = root.querySelector<HTMLElement>(`[data-flow-anchor="${id}"]`)!
      const group = el.closest<HTMLElement>('[data-slot="flow-group"]')!
      if (group.dataset['folded'] !== undefined) {
        el = group.querySelector<HTMLElement>(':scope > [data-flow-anchor]')!
      }
      const side = group.getBoundingClientRect()
      const mid = el.getBoundingClientRect()
      return { left: side.left, right: side.right, y: mid.top + mid.height / 2 }
    }
    return [...root.querySelectorAll<SVGPathElement>('[data-slot="flow-edge"]')].map((path) => {
      const [from, to] = path.dataset['edge']!.split('>') as [string, string]
      const screen = (at: number) => path.getPointAtLength(at).matrixTransform(path.getScreenCTM()!)
      const tail = screen(0)
      const tip = screen(path.getTotalLength())
      const a = anchorBox(from)
      const b = anchorBox(to)
      const ahead = b.left > a.right
      const startOff = Math.hypot(tail.x - a.right, tail.y - a.y)
      const endOff = Math.hypot(tip.x - (ahead ? b.left : b.right), tip.y - b.y)
      return {
        edge: path.dataset['edge']!,
        tone: path.dataset['tone'] ?? null,
        start: Math.round(startOff * 10) / 10,
        end: Math.round(endOff * 10) / 10,
      }
    })
  }, CANVAS)
}

function expectOnAnchors(fit: EdgeFit[], what: string): void {
  expect(fit.map((f) => f.edge).toSorted()).toEqual([
    'approval>order',
    'conditions>approval',
    'schedule>conditions',
    'trigger>conditions',
    'under-limit>erp',
  ])
  for (const f of fit) {
    if (f.start > 1.5 || f.end > 1.5) throw new Error(`${what}: ${JSON.stringify(f)}`)
  }
}

const zoomOf = async (page: LayoutPage): Promise<number> =>
  Number(await page.raw.locator(CANVAS).getAttribute('data-zoom'))

const scrollOf = (page: LayoutPage) =>
  page.raw.locator(FRAME).evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }))

layout('FlowCanvas', () => {
  test('1800: edges sit on their anchors, the issue edge is warn, and the canvas opens fitted', async () => {
    const page = await open(WIDE)
    const fit = await edgeFit(page)
    expectOnAnchors(fit, 'at rest')
    expect(fit.find((f) => f.edge === 'under-limit>erp')!.tone).toBe('warn')
    expect(fit.find((f) => f.edge === 'approval>order')!.tone).toBe('warn')
    expect(fit.find((f) => f.edge === 'trigger>conditions')!.tone).toBeNull()
    const m = await page.raw.evaluate((canvas) => {
      const root = document.querySelector<HTMLElement>(canvas)!
      const frame = root.querySelector<HTMLElement>('[data-slot="scroll-area"]')!
      const stage = root.querySelector<HTMLElement>('[data-slot="flow-stage"]')!
      const tools = root.querySelector<HTMLElement>('[data-slot="flow-tools"]')!
      const f = frame.getBoundingClientRect()
      const t = tools.getBoundingClientRect()
      return {
        fitted: root.dataset['fitted'] !== undefined,
        zoom: Number(root.dataset['zoom']),
        frameW: frame.clientWidth,
        stageW: stage.offsetWidth,
        toolsBottom: f.bottom - t.bottom,
        toolsCentre: Math.abs(t.left + t.width / 2 - (f.left + f.width / 2)),
      }
    }, CANVAS)
    expect(m.fitted).toBe(true)
    expect(m.zoom).toBeCloseTo(Math.max(0.5, Math.min(1, m.frameW / m.stageW)), 2)
    expect(m.zoom).toBeLessThan(1)
    expect(m.toolsBottom).toBeCloseTo(20, 0)
    expect(m.toolsCentre).toBeLessThanOrEqual(1)
  })

  test('1800: edges follow their anchors through a fold, a zoom and a resize', async () => {
    const page = await open(WIDE)
    // Fold: the row anchor 'erp' moves onto the 'Then' header.
    const then = page.raw.getByRole('button', { name: /^Then/ })
    await then.click()
    await frames(page, 3)
    expect(await then.getAttribute('aria-expanded')).toBe('false')
    expectOnAnchors(await edgeFit(page), 'folded')
    await then.click()
    await frames(page, 3)
    expectOnAnchors(await edgeFit(page), 'unfolded')
    // Zoom.
    await page.raw.locator('[data-slot="flow-group-header"]').first().focus()
    await page.raw.keyboard.press('+')
    await frames(page)
    expect(await page.raw.locator(CANVAS).getAttribute('data-fitted')).toBeNull()
    expectOnAnchors(await edgeFit(page), 'zoomed')
    await page.raw.keyboard.press('0')
    await frames(page)
    // Resize: the docked panel goes, the frame widens and the fit follows it.
    const before = await zoomOf(page)
    await page.raw.getByTestId('fc-toggle').click()
    await frames(page, 3)
    expect(await zoomOf(page)).toBeGreaterThan(before)
    expectOnAnchors(await edgeFit(page), 'undocked')
    await page.raw.setViewportSize({ width: 1300, height: 1000 })
    await frames(page, 3)
    expectOnAnchors(await edgeFit(page), 'narrower window')
  })

  test('1800: the pointer tool pans from empty ground, the hand tool from a group', async () => {
    const page = await open(WIDE)
    await page.raw.locator('[data-slot="flow-group-header"]').first().focus()
    await page.raw.keyboard.press('+')
    await page.raw.keyboard.press('+')
    await frames(page)
    const frame = page.raw.locator(FRAME)
    expect(await frame.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
    const box = (await frame.boundingBox())!
    // Empty ground: under the stage's bottom padding, left of the tools.
    const empty = await frame.evaluate((el) => {
      const r = el.getBoundingClientRect()
      for (let y = r.bottom - 30; y > r.top; y -= 6) {
        for (let x = r.left + 10; x < r.left + 200; x += 6) {
          const hit = document.elementFromPoint(x, y)
          if (hit?.closest('[data-slot="flow-group"], [data-slot="flow-tools"]') === null)
            return { x, y }
        }
      }
      return null
    })
    expect(empty).not.toBeNull()
    await page.raw.mouse.move(empty!.x, empty!.y)
    const start = await scrollOf(page)
    await page.raw.mouse.down()
    await page.raw.mouse.move(empty!.x - 150, empty!.y, { steps: 5 })
    await page.raw.mouse.up()
    expect((await scrollOf(page)).left - start.left).toBeCloseTo(150, -1)
    // A drag that starts on a group does not pan with the pointer tool …
    const row = page.raw.locator('[data-flow-anchor="draft-po"]')
    const at = (await row.boundingBox())!
    const fromRow = async () => {
      const s = await scrollOf(page)
      await page.raw.mouse.move(at.x + at.width / 2, at.y + at.height / 2)
      await page.raw.mouse.down()
      await page.raw.mouse.move(at.x + at.width / 2 - 120, at.y + at.height / 2, { steps: 5 })
      await page.raw.mouse.up()
      return (await scrollOf(page)).left - s.left
    }
    await frame.evaluate((el) => el.scrollTo(el.scrollWidth, 0))
    expect(Math.abs(await fromRow())).toBeLessThan(2)
    // … and does with the hand tool, set by H.
    await page.raw.locator('[data-slot="flow-group-header"]').first().focus()
    await page.raw.keyboard.press('h')
    expect(await page.raw.getByRole('button', { name: 'Hand' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    await frame.evaluate((el) => el.scrollTo(0, 0))
    const moved = await fromRow()
    expect(moved).toBeGreaterThan(100)
    expect(box.width).toBeGreaterThan(0)
    await page.raw.keyboard.press('v')
    expect(
      await page.raw.getByRole('button', { name: 'Pointer' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  test('1800: the wheel pans, Ctrl or Cmd with the wheel zooms, the menu sets 125 and fits', async () => {
    const page = await open(WIDE)
    const fitted = await zoomOf(page)
    const frame = page.raw.locator(FRAME)
    const box = (await frame.boundingBox())!
    await page.raw.mouse.move(box.x + box.width / 2, box.y + 100)
    await page.raw.keyboard.down('Control')
    await page.raw.mouse.wheel(0, -100)
    await page.raw.keyboard.up('Control')
    await frames(page)
    expect(await zoomOf(page)).toBeGreaterThan(fitted)
    await page.raw.keyboard.down('Meta')
    await page.raw.mouse.wheel(0, 100)
    await page.raw.keyboard.up('Meta')
    await frames(page)
    expect(await zoomOf(page)).toBeCloseTo(fitted, 1)
    // The menu: 125 %, then a plain wheel pans the larger drawing, then fit.
    await page.raw.locator('[data-slot="flow-zoom"]').click()
    await page.raw.locator('[data-preset="1.25"]').click()
    await frames(page)
    expect(await zoomOf(page)).toBeCloseTo(1.25, 2)
    expect(await page.raw.locator('[data-slot="flow-zoom"]').textContent()).toBe('125%')
    const before = await scrollOf(page)
    await page.raw.mouse.move(box.x + box.width / 2, box.y + 100)
    await page.raw.mouse.wheel(120, 80)
    await frames(page)
    const after = await scrollOf(page)
    expect(after.left + after.top).toBeGreaterThan(before.left + before.top)
    expect(await zoomOf(page)).toBeCloseTo(1.25, 2)
    await page.raw.locator('[data-slot="flow-zoom"]').click()
    await page.raw.getByRole('button', { name: /^Zoom to fit/ }).click()
    await frames(page)
    expect(await zoomOf(page)).toBeCloseTo(fitted, 2)
    expect(await page.raw.locator(CANVAS).getAttribute('data-fitted')).toBe('')
  })

  test('1800: the issue marks its header and row, and its checklist item focuses the row', async () => {
    const page = await open(WIDE)
    expect(
      await page.raw.locator('[data-flow-group="order"] [data-flow-issues]').textContent(),
    ).toBe('1 issue')
    expect(await page.raw.locator('[data-flow-anchor="erp"]').getAttribute('data-issue')).toBe(
      'warn',
    )
    await page.raw.getByRole('button', { name: /^Then/ }).click()
    await frames(page, 3)
    await page.raw.locator('[data-slot="flow-checklist-item"]').click()
    await frames(page, 3)
    expect(
      await page.raw.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.getAttribute('data-flow-anchor'),
      ),
    ).toBe('erp')
    expect(
      await page.raw.getByRole('button', { name: /^Then/ }).getAttribute('aria-expanded'),
    ).toBe('true')
    // The focused row is inside the frame.
    const inside = await page.raw.evaluate((frame) => {
      const f = document.querySelector(frame)!.getBoundingClientRect()
      const r = document.activeElement!.getBoundingClientRect()
      return (
        r.top >= f.top - 1 &&
        r.bottom <= f.bottom + 1 &&
        r.left >= f.left - 1 &&
        r.right <= f.right + 1
      )
    }, FRAME)
    expect(inside).toBe(true)
  })

  test('390: groups stack in source order with no edges and no tools; nothing scrolls sideways', async () => {
    const page = await open(PHONE)
    await page.raw.getByTestId('fc-toggle').click()
    await frames(page, 3)
    const m = await page.raw.evaluate((canvas) => {
      const root = document.querySelector<HTMLElement>(canvas)!
      const groups = [...root.querySelectorAll<HTMLElement>('[data-slot="flow-group"]')].map(
        (g) => {
          const r = g.getBoundingClientRect()
          return { id: g.dataset['flowGroup']!, x: r.x, y: r.y, w: r.width }
        },
      )
      const shown = (sel: string) => {
        const el = root.querySelector<Element>(sel)
        return el !== null && el.getBoundingClientRect().height > 0
      }
      return {
        groups,
        edges: shown('[data-slot="flow-edges"]'),
        tools: shown('[data-slot="flow-tools"]'),
        zoom: Number(root.dataset['zoom']),
        frameW: root.querySelector<HTMLElement>('[data-slot="scroll-area"]')!.clientWidth,
      }
    }, CANVAS)
    expect(m.groups.map((g) => g.id)).toEqual([
      'trigger',
      'schedule',
      'conditions',
      'approval',
      'order',
      'runs',
    ])
    for (let i = 1; i < m.groups.length; i++) {
      expect(m.groups[i]!.y).toBeGreaterThan(m.groups[i - 1]!.y)
      expect(Math.abs(m.groups[i]!.x - m.groups[0]!.x)).toBeLessThan(1)
    }
    expect(m.groups[0]!.w).toBeGreaterThan(m.frameW - 40)
    expect(m.edges).toBe(false)
    expect(m.tools).toBe(false)
    expect(m.zoom).toBe(1)
    expectNoHorizontalOverflow(await page.horizontalOverflow(), 'the stacked flow', PHONE)
  })

  for (const viewport of [WIDE, PHONE]) {
    test(`${viewport.width}: axe clean`, async () => {
      const page = await open(viewport)
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
          .map(
            (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html.slice(0, 120)).join(' | ')}`,
          )
      })
      expect(violations).toEqual([])
    })
  }
})
