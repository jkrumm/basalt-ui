/**
 * The toast viewport (docs/v3/concepts/state-persistence-forms.md section 9) at 1800x1200 and
 * 390x844: the real `ToastHost` and `notify` in Chrome. Asserted here because happy-dom has no
 * geometry or print media: the viewport is a named polite region inside the viewport on both
 * sizes, a notification sent before the host mounted shows (S5), an error mirrors into
 * `role=alert`, the viewport is `print:hidden` under print media, axe finds nothing serious, and a
 * toast never takes focus.
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
const DESKTOP: Viewport = { name: 'desktop 1800', width: 1800, height: 1200 }
const VIEWPORTS: Viewport[] = [DESKTOP, PHONE]
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const VIEWPORT = '[data-slot="toast-viewport"]'

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'toast-viewport-'))
  const cssOut = join(scratch, 'toast-viewport.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'toast-viewport.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`toast-viewport: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'toast-viewport-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`toast-viewport: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>toast-viewport</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="tv-error"]')
  await page.raw.waitForSelector('[data-slot="toast"]')
  await page.settle()
  return page
}

const press = async (page: LayoutPage, id: string): Promise<void> => {
  await page.raw.evaluate((testid) => {
    document.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.click()
  }, id)
  await page.settle()
}

layout('toast viewport', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('a notification sent before the host mounted is shown (S5)', async () => {
        const page = await open(viewport)
        const text = await page.raw.evaluate(
          (sel) => document.querySelector(sel)?.textContent ?? '',
          VIEWPORT,
        )
        expect(text).toContain('Sent before the host mounted.')
      })

      test('the viewport is a named polite region inside the viewport, no sideways scroll', async () => {
        const page = await open(viewport)
        await press(page, 'tv-error')
        const info = await page.raw.evaluate((sel) => {
          const el = document.querySelector(sel)!
          const r = el.getBoundingClientRect()
          return {
            role: el.getAttribute('role'),
            live: el.getAttribute('aria-live'),
            label: el.getAttribute('aria-label'),
            left: r.left,
            right: r.right,
            bottom: r.bottom,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
          }
        }, VIEWPORT)
        expect(info.role).toBe('region')
        expect(info.live).toBe('polite')
        expect(info.label).toBe('Notifications')
        expect(info.left).toBeGreaterThanOrEqual(-0.5)
        expect(info.right).toBeLessThanOrEqual(info.innerWidth + 0.5)
        expect(info.bottom).toBeLessThanOrEqual(info.innerHeight + 0.5)
        expect(info.scrollWidth).toBeLessThanOrEqual(info.innerWidth)
      })

      test('an error mirrors into role=alert and no toast takes focus', async () => {
        const page = await open(viewport)
        await press(page, 'tv-error')
        const state = await page.raw.evaluate(() => ({
          alert: document.querySelector('[role="alert"]')?.textContent ?? '',
          focus: document.activeElement?.closest('[data-slot^="toast"]') !== null,
        }))
        expect(state.alert).toContain('Upload failed')
        expect(state.focus).toBe(false)
      })

      test('the viewport is hidden under print media', async () => {
        const page = await open(viewport)
        await press(page, 'tv-success')
        await page.raw.emulateMedia({ media: 'print' })
        const display = await page.raw.evaluate(
          (sel) => getComputedStyle(document.querySelector(sel)!).display,
          VIEWPORT,
        )
        expect(display).toBe('none')
      })

      test('axe finds nothing serious or critical with toasts showing', async () => {
        const page = await open(viewport)
        await press(page, 'tv-error')
        await press(page, 'tv-undo')
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
            .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html).join(' | ')}`)
        })
        expect(violations).toEqual([])
      })
    })
  }
})
