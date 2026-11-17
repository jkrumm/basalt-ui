/**
 * The mono slots of expression cycle 6 (`v3-expr-6-contract` (b)) in real Chrome at 1800 and 390: a
 * figure `period`, a `StatCell` and `StatCard` `sub` and an entity column's secondary text set with
 * their mono flag draw in the mono face with tabular numerals, the same slot without it stays in the
 * sans face, and the flag moves no card or row: each mono card is as tall as its sans twin and its
 * text stays inside the card.
 *
 * The page is self-contained like `charts-expr4.layout.test.ts`.
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
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const VIEWPORTS: Viewport[] = [WIDE, PHONE]
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WHEN = '2026-11-16 03:12 UTC'
const SLOTS = ['figure', 'cell', 'card', 'table'] as const

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-expr6-contract-'))
  const cssOut = join(scratch, 'charts-expr6-contract.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-expr6-contract.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-expr6-contract: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-expr6-contract-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-expr6-contract: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-expr6-contract</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="table-sans"] [data-slot="table-entity-sub"]')
  await page.settle()
  return page
}

type Face = {
  family: string
  numeric: string
  /** How far the text's box reaches past its card's right edge (px, <= 0 inside). */
  overhang: number
}

/**
 * The face of every rendered, visible element of a test id that holds one time or id: the leaf
 * whose own text is the timestamp, or an entity's secondary text.
 */
const facesOf = (page: LayoutPage, id: string): Promise<Face[]> =>
  page.raw.evaluate(
    ({ id, when }) => {
      const root = document.querySelector(`[data-testid="${id}"]`)!
      const edge = root.getBoundingClientRect().right
      const leaves = [...root.querySelectorAll<HTMLElement>('*')].filter(
        (el) =>
          el.dataset.slot === 'table-entity-sub' ||
          (el.children.length === 0 && el.textContent === when),
      )
      return leaves
        .filter((el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0)
        .map((el) => {
          const style = getComputedStyle(el)
          return {
            family: style.fontFamily,
            numeric: style.fontVariantNumeric,
            overhang: el.getBoundingClientRect().right - edge,
          }
        })
    },
    { id, when: WHEN },
  )

const heightOf = (page: LayoutPage, id: string): Promise<number> =>
  page.raw.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect()
    return r.height
  }, `[data-testid="${id}"]`)

layout('mono slots for times and ids, expression cycle 6', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name}`, () => {
      test('a flagged slot draws in the mono face with tabular numerals, inside its card', async () => {
        const page = await open(viewport)
        for (const slot of SLOTS) {
          const faces = await facesOf(page, `${slot}-mono`)
          // The StatCard sub line hides below `narrow`; every other slot shows at both widths.
          if (slot !== 'card') expect(faces.length, slot).toBeGreaterThan(0)
          for (const face of faces) {
            expect(face.family, slot).toContain('JetBrains Mono')
            expect(face.numeric, slot).toContain('tabular-nums')
            expect(face.overhang, slot).toBeLessThanOrEqual(0.5)
          }
        }
      })

      test('the same slot without the flag stays in the sans face', async () => {
        const page = await open(viewport)
        for (const slot of SLOTS) {
          const faces = await facesOf(page, `${slot}-sans`)
          if (slot !== 'card') expect(faces.length, slot).toBeGreaterThan(0)
          for (const face of faces) expect(face.family, slot).not.toContain('JetBrains Mono')
        }
      })

      test('the flag moves no card or row: each mono card is as tall as its sans twin', async () => {
        const page = await open(viewport)
        for (const slot of SLOTS) {
          const mono = await heightOf(page, `${slot}-mono`)
          const sans = await heightOf(page, `${slot}-sans`)
          expect(mono, slot).toBeCloseTo(sans, 0)
        }
        const overflow = await page.raw.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow).toBeLessThanOrEqual(0)
      })
    })
  }
})
