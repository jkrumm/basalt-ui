/**
 * The tabs of `basalt-ui/static` in real Chrome: what the CSS shows before and after the head script.
 * With the script only the first panel shows and a click or an arrow key moves it; with no script
 * (what a page ships when JavaScript is off) every panel shows under its name and the tab row is gone.
 * A jsdom run cannot see this: it needs the cascade of the compiled sheet.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { siteScript } from '../../src/static/site-script'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openDocument,
} from './harness'
import { Parts } from './fixture/static-tabs-parts'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')

let scratch = ''
let withScript = ''
let withoutScript = ''

beforeAll(() => {
  if (!ready) return
  scratch = mkdtempSync(join(tmpdir(), 'static-tabs-'))
  const cssOut = join(scratch, 'static-tabs.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'static-tabs.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`static-tabs: tailwind failed:\n${css.stderr.toString()}`)
  const html = renderToString(createElement(Parts))
  const head = (script: string): string =>
    '<!doctype html><html lang="en"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" /><title>static-tabs</title>' +
    `<style>${readFileSync(cssOut, 'utf8')}</style>${script}</head>`
  withScript = `${head(`<script>${siteScript()}</script>`)}<body>${html}</body></html>`
  withoutScript = `${head('')}<body>${html}</body></html>`
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

layout('static tabs', () => {
  const shown = (page: Awaited<ReturnType<typeof openDocument>>): Promise<boolean[]> =>
    page.raw.$$eval('[role=tabpanel]', (panels) =>
      panels.map((panel) => getComputedStyle(panel).display !== 'none'),
    )

  test('with the script the first panel shows and a click moves it', async () => {
    const page = await openDocument(withScript, DESKTOP_1440)
    await page.settle()
    expect(await shown(page)).toEqual([true, false, false])
    await page.raw.click('[role=tab][data-tab="npm"]')
    expect(await shown(page)).toEqual([false, true, false])
  })

  test('the arrow keys, Home and End move the shown panel and the focus', async () => {
    const page = await openDocument(withScript, DESKTOP_1440)
    await page.settle()
    await page.raw.focus('[role=tab][data-tab="bun"]')
    await page.raw.keyboard.press('ArrowRight')
    expect(await shown(page)).toEqual([false, true, false])
    await page.raw.keyboard.press('End')
    expect(await shown(page)).toEqual([false, false, true])
    expect(await page.raw.evaluate(() => document.activeElement?.getAttribute('data-tab'))).toBe(
      'pnpm',
    )
    await page.raw.keyboard.press('Home')
    expect(await shown(page)).toEqual([true, false, false])
  })

  test('without the script every panel shows under its name and the tab row is hidden', async () => {
    const page = await openDocument(withoutScript, DESKTOP_1440)
    await page.settle()
    expect(await shown(page)).toEqual([true, true, true])
    const row = await page.raw.$eval('[role=tablist]', (el) => getComputedStyle(el).display)
    expect(row).toBe('none')
    const name = await page.raw.$eval(
      '[role=tabpanel]',
      (el) => getComputedStyle(el, '::before').content,
    )
    expect(name).toBe('"bun"')
  })
})
