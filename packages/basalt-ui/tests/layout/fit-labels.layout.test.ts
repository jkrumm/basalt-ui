/**
 * Labels fit their box (docs/v3/issues/cycles/v3-dogfood-4-visual.json, dogfood-4.2 and 4.4): in a
 * card header a four-option segmented group with a two-word option draws every label on one line,
 * no two options touching, on a track that differs from the card, at 1800 and 390 px; a `status`
 * column whose widest label is `Closed recently` shows it whole at 1800 px.
 *
 * Self-contained like `table-short-text`: the fixture CSS is compiled with the Tailwind CLI into a
 * temp directory, the table tier sheet is inlined beside it, and the fixture bundles in memory.
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
const WIDE_1800: Viewport = { name: 'wide', width: 1800, height: 1200 }

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'fit-labels-'))
  const cssOut = join(scratch, 'fit-labels.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'fit-labels.css'), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0) throw new Error(`fit-labels: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'fit-labels-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`fit-labels: the fixture did not build:\n${build.logs.join('\n')}`)
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
      `<title>fit-labels</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style><style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="fl-table"] tbody tr')
  await page.settle()
  return page
}

layout('a card-header segmented group', () => {
  for (const viewport of [WIDE_1800, PHONE]) {
    test(`draws each label on one line, apart, on a track at ${viewport.width}`, async () => {
      const page = await open(viewport)
      const probe = await page.raw.evaluate(() => {
        const card = document.querySelector<HTMLElement>(
          '[data-testid="fl-card"] [data-slot="card"]',
        )
        const groups = [
          ...document.querySelectorAll<HTMLElement>(
            '[data-testid="fl-card"] [data-slot="segmented"]',
          ),
        ]
        return {
          cardBg: card === null ? '' : getComputedStyle(card).backgroundColor,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          groups: groups.map((group) => {
            const items = [...group.querySelectorAll<HTMLElement>('[data-slot="segmented-item"]')]
            const lineHeight = Number.parseFloat(getComputedStyle(items[0]!).lineHeight)
            return {
              trackBg: getComputedStyle(group).backgroundColor,
              scrolls: group.scrollWidth > group.clientWidth + 1,
              groupBox: group.getBoundingClientRect().toJSON() as { left: number; right: number },
              items: items.map((el) => {
                const r = el.getBoundingClientRect()
                const range = document.createRange()
                range.selectNodeContents(el)
                return {
                  text: el.textContent ?? '',
                  left: r.left,
                  right: r.right,
                  lines: Math.round(range.getBoundingClientRect().height / lineHeight),
                  fits: el.scrollWidth <= el.clientWidth + 1,
                }
              }),
            }
          }),
        }
      })
      expect(probe.groups.length).toBe(2)
      expect(probe.overflowX).toBeLessThanOrEqual(0)
      for (const group of probe.groups) {
        expect(group.trackBg).not.toBe(probe.cardBg)
        for (const item of group.items) {
          expect(item.lines, item.text).toBe(1)
          expect(item.fits, item.text).toBe(true)
        }
        for (let i = 1; i < group.items.length; i += 1)
          expect(group.items[i]!.left).toBeGreaterThanOrEqual(group.items[i - 1]!.right - 0.5)
        // A track wider than its box scrolls sideways; one that fits holds every option inside it.
        if (!group.scrolls) {
          expect(group.items[0]!.left).toBeGreaterThanOrEqual(group.groupBox.left)
          expect(group.items.at(-1)!.right).toBeLessThanOrEqual(group.groupBox.right + 0.5)
        }
      }
      // At 1800 px nothing scrolls: the whole group is drawn.
      if (viewport.width === WIDE_1800.width)
        for (const group of probe.groups) expect(group.scrolls).toBe(false)
      expect(probe.groups[0]!.items.map((item) => item.text)).toContain('Not started')
    })
  }
})

layout('a status column', () => {
  test('shows its widest label whole at 1800', async () => {
    const page = await open(WIDE_1800)
    const probe = await page.raw.evaluate(() => {
      const labels = [
        ...document.querySelectorAll<HTMLElement>('[data-testid="fl-table"] [data-slot="status"]'),
      ]
      return labels.map((status) => {
        const word = status.lastElementChild as HTMLElement
        return { text: word.textContent ?? '', cut: word.scrollWidth > word.clientWidth + 1 }
      })
    })
    expect(probe.map((p) => p.text)).toContain('Closed recently')
    for (const p of probe) expect(p.cut, p.text).toBe(false)
  })
})
