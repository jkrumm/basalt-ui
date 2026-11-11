/**
 * The markdown region in real Chrome at 1800x1200 and 390x844, light and dark (docs/v3/concepts/
 * ai-mdx.md section 7, P8 and P9; Issue v3-ai-i2): no sideways scroll at 390, code scrolls in its
 * own box instead of widening the page, the table of contents is a rail from 1200 and a trigger
 * below it, headings carry anchors, the diagram renders, and axe finds nothing serious or
 * critical. Asserted here because happy-dom has no geometry and no colour computation.
 *
 * The page is self-contained: `fixture/content.css` is compiled with the Tailwind CLI into a temp
 * directory and `fixture/content-fixture.tsx` is bundled in memory, both inlined into a document
 * served beside the shared fixture, so no shared fixture file carries a line for this suite.
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

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const DESKTOP: Viewport = { name: 'desktop 1800', width: 1800, height: 1200 }
const VIEWPORTS: Viewport[] = [DESKTOP, PHONE]
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'content-'))
  const cssOut = join(scratch, 'content.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'content.css'), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0) throw new Error(`content: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'content-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`content: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>content</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(
    EMPTY_SPEC,
    viewport,
    documentPath,
    'reduce',
    viewport === PHONE ? 'coarse' : 'fine',
  )
  await page.raw.waitForSelector('[data-slot="article-layout"]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  // the diagram and the highlighted fences load on first use
  await page.raw.waitForSelector('[data-slot="mermaid"] svg', { timeout: 20_000 })
  await page.raw.waitForSelector('.shiki', { timeout: 20_000 })
  await page.settle()
  return page
}

layout('Markdown region', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('no horizontal overflow of the document', async () => {
        const page = await open(viewport)
        const overflow = await page.horizontalOverflow()
        expectNoHorizontalOverflow(overflow, 'the markdown region', viewport)
      })

      test('a long code line scrolls inside its own box', async () => {
        const page = await open(viewport)
        const box = await page.raw.evaluate(() => {
          const pre = document.querySelector<HTMLElement>('[data-testid="content-long-code"] pre')!
          const root = document.querySelector<HTMLElement>(
            '[data-testid="content-long-code"] [data-slot="code-block"]',
          )!
          return {
            scrollWidth: pre.scrollWidth,
            clientWidth: pre.clientWidth,
            overflowX: getComputedStyle(pre).overflowX,
            rootRight: root.getBoundingClientRect().right,
            innerWidth: window.innerWidth,
          }
        })
        expect(box.scrollWidth).toBeGreaterThan(box.clientWidth)
        expect(box.overflowX).toBe('auto')
        expect(box.rootRight).toBeLessThanOrEqual(box.innerWidth + 0.5)
      })

      test('the table of contents is a rail from 1200 and a trigger below', async () => {
        const page = await open(viewport)
        const toc = await page.raw.evaluate(() => ({
          nav: document.querySelectorAll('nav[aria-label="On this page"]').length,
          trigger: [...document.querySelectorAll('button')].some(
            (b) => b.textContent === 'On this page',
          ),
        }))
        if (viewport.width >= 1200) expect(toc).toEqual({ nav: 1, trigger: false })
        else expect(toc).toEqual({ nav: 0, trigger: true })
      })

      test('headings carry an anchor and the diagram renders', async () => {
        const page = await open(viewport)
        const found = await page.raw.evaluate(() => ({
          anchors: document.querySelectorAll('h2 a[href^="#"], h3 a[href^="#"]').length,
          diagram: document.querySelector('[data-slot="mermaid"] svg') !== null,
        }))
        expect(found.anchors).toBeGreaterThanOrEqual(3)
        expect(found.diagram).toBe(true)
      })

      for (const scheme of [undefined, 'dark'] as const) {
        test(`axe finds nothing serious or critical${scheme ? ` in ${scheme}` : ''}`, async () => {
          const page = await open(viewport, scheme)
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
                (v) =>
                  `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html.slice(0, 160)).join(' | ')}`,
              )
          })
          expect(violations).toEqual([])
        })
      }
    })
  }
})
