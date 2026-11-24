/**
 * The site header's menus in real Chrome: a panel opens under its item on click, hover and focus,
 * closes on Escape and when the pointer leaves, the arrow keys walk the items, and below the `wide`
 * size the same data is one full-height sheet of sections. With no script (JavaScript off) click and
 * Enter still open a panel. A jsdom run cannot see this: it needs the compiled sheet and the popover top layer.
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
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openDocument,
} from './harness'
import type { LayoutPage } from './harness'
import { Parts } from './fixture/static-site-header-parts'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const axeSource = await Bun.file(
  new URL('../../../../node_modules/axe-core/axe.min.js', import.meta.url).pathname,
).text()

let scratch = ''
let withScript = ''
let withoutScript = ''

beforeAll(() => {
  if (!ready) return
  scratch = mkdtempSync(join(tmpdir(), 'static-site-header-'))
  const cssOut = join(scratch, 'static-site-header.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'static-site-header.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) {
    throw new Error(`static-site-header: tailwind failed:\n${css.stderr.toString()}`)
  }
  const html = renderToString(createElement(Parts, {}))
  const head = (script: string): string =>
    '<!doctype html><html lang="en"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" /><title>static-site-header</title>' +
    `<style>${readFileSync(cssOut, 'utf8')}</style>${script}</head>`
  withScript = `${head(`<script>${siteScript()}</script>`)}<body>${html}</body></html>`
  withoutScript = `${head('')}<body>${html}</body></html>`
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

const DESKTOP = { pointer: 'fine' } as const
const MOTION = { pointer: 'fine', reducedMotion: 'no-preference' } as const

const trigger = (name: string): string => `button[data-basalt-top]:has-text("${name}")`

/** The ids of the panels that are open, by their index in the bar. */
const open = (page: LayoutPage): Promise<string[]> =>
  page.raw.evaluate(() =>
    [...document.querySelectorAll('[data-slot="site-menu-panel"]')]
      .filter((p) => p.matches(':popover-open'))
      .map((p) => p.id),
  )

/** Waits out the intent delay and the enter transition. */
const waitOpen = async (page: LayoutPage, id: string): Promise<void> => {
  await page.raw.waitForFunction(
    (target) => document.getElementById(target)?.matches(':popover-open') === true,
    id,
  )
}

type AxeViolation = { id: string; impact: string; nodes: { target: string[] }[] }

async function axeSerious(page: LayoutPage): Promise<string[]> {
  await page.raw.addScriptTag({ content: axeSource })
  const violations = await page.raw.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run: (c: Document, o: object) => Promise<{ violations: unknown[] }> }
      }
    ).axe
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    })
    return result.violations
  })
  return (violations as AxeViolation[])
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}

layout('site header menus', () => {
  test('a click opens the panel under its item, inside the screen, and Escape closes it', async () => {
    const page = await openDocument(withScript, DESKTOP_1440, DESKTOP)
    await page.settle()
    await page.raw.click(trigger('Product'))
    await waitOpen(page, 'basalt-site-menu-p1')
    expect(await open(page)).toEqual(['basalt-site-menu-p1'])
    const boxes = await page.raw.evaluate(() => {
      const t = document.querySelector('button[data-basalt-top]')?.getBoundingClientRect()
      const p = document.getElementById('basalt-site-menu-p1')?.getBoundingClientRect()
      return t && p
        ? { tl: t.left, tb: t.bottom, pl: p.left, pt: p.top, pr: p.right, vw: innerWidth }
        : null
    })
    expect(boxes).not.toBeNull()
    if (!boxes) return
    expect(Math.abs(boxes.pl - boxes.tl)).toBeLessThan(2)
    expect(boxes.pt).toBeGreaterThanOrEqual(boxes.tb)
    expect(boxes.pt - boxes.tb).toBeLessThan(16)
    expect(boxes.pr).toBeLessThanOrEqual(boxes.vw)
    const tiles = await page.raw.$$eval('#basalt-site-menu-p1 a', (a) =>
      a.map((el) => el.getBoundingClientRect().width),
    )
    expect(tiles).toHaveLength(3)
    await page.raw.keyboard.press('Escape')
    await page.raw.waitForFunction(
      () => !document.getElementById('basalt-site-menu-p1')?.matches(':popover-open'),
    )
    expect(await open(page)).toEqual([])
  })

  test('hovering an item opens its panel after a short delay; moving to the next swaps them; leaving closes', async () => {
    const page = await openDocument(withScript, DESKTOP_1440, MOTION)
    await page.settle()
    await page.raw.hover(trigger('Product'))
    await waitOpen(page, 'basalt-site-menu-p1')
    await page.raw.hover(trigger('Resources'))
    await waitOpen(page, 'basalt-site-menu-p2')
    expect(await open(page)).toEqual(['basalt-site-menu-p2'])
    await page.raw.mouse.move(1300, 600)
    await page.raw.waitForFunction(
      () => document.querySelectorAll('[data-slot="site-menu-panel"]:popover-open').length === 0,
    )
  })

  test('the pointer can travel from the item into its panel without closing it', async () => {
    const page = await openDocument(withScript, DESKTOP_1440, MOTION)
    await page.settle()
    await page.raw.hover(trigger('Product'))
    await waitOpen(page, 'basalt-site-menu-p1')
    await page.raw.hover('#basalt-site-menu-p1 a')
    await page.raw.waitForTimeout(500)
    expect(await open(page)).toEqual(['basalt-site-menu-p1'])
  })

  test('the arrow keys, Home and End walk the top items; Down enters the panel', async () => {
    const page = await openDocument(withScript, DESKTOP_1440, DESKTOP)
    await page.settle()
    const focused = (): Promise<string> =>
      page.raw.evaluate(() => document.activeElement?.textContent?.trim() ?? '')
    await page.raw.focus('a[data-basalt-top]')
    expect(await focused()).toBe('Docs')
    await page.raw.keyboard.press('ArrowRight')
    expect(await focused()).toBe('Product')
    await page.raw.keyboard.press('ArrowRight')
    expect(await focused()).toBe('Resources')
    await page.raw.keyboard.press('End')
    expect(await focused()).toBe('About')
    await page.raw.keyboard.press('ArrowRight')
    expect(await focused()).toBe('Docs')
    await page.raw.keyboard.press('ArrowLeft')
    expect(await focused()).toBe('About')
    await page.raw.keyboard.press('Home')
    await page.raw.keyboard.press('ArrowRight')
    await page.raw.keyboard.press('ArrowDown')
    await waitOpen(page, 'basalt-site-menu-p1')
    expect(await focused()).toContain('Charts')
  })

  test("with a panel open the arrow key opens the next item's panel", async () => {
    const page = await openDocument(withScript, DESKTOP_1440, DESKTOP)
    await page.settle()
    await page.raw.click(trigger('Product'))
    await waitOpen(page, 'basalt-site-menu-p1')
    await page.raw.focus(trigger('Product'))
    await page.raw.keyboard.press('ArrowRight')
    await waitOpen(page, 'basalt-site-menu-p2')
    expect(await open(page)).toEqual(['basalt-site-menu-p2'])
  })

  test('where the browser has no interest invokers the head script supplies hover', async () => {
    const html = withScript
      .replace(/ interestfor="[^"]*"/g, '')
      .replace('<script>', '<script>delete HTMLButtonElement.prototype.interestForElement;')
    const page = await openDocument(html, DESKTOP_1440, MOTION)
    await page.settle()
    expect(await page.raw.evaluate(() => 'interestForElement' in HTMLButtonElement.prototype)).toBe(
      false,
    )
    await page.raw.hover(trigger('Product'))
    await waitOpen(page, 'basalt-site-menu-p1')
    await page.raw.hover('#basalt-site-menu-p1 a')
    await page.raw.waitForTimeout(400)
    expect(await open(page)).toEqual(['basalt-site-menu-p1'])
    await page.raw.hover(trigger('Resources'))
    await waitOpen(page, 'basalt-site-menu-p2')
    expect(await open(page)).toEqual(['basalt-site-menu-p2'])
    await page.raw.mouse.move(1300, 600)
    await page.raw.waitForFunction(
      () => document.querySelectorAll('[data-slot="site-menu-panel"]:popover-open').length === 0,
    )
  })

  test('a panel that closes as another opens leaves toward it', async () => {
    const page = await openDocument(withScript, DESKTOP_1440, MOTION)
    await page.settle()
    const leaving = (id: string): Promise<string> =>
      page.raw.evaluate(
        (target) => getComputedStyle(document.getElementById(target)!).translate,
        id,
      )
    await page.raw.click(trigger('Product'))
    await waitOpen(page, 'basalt-site-menu-p1')
    await page.raw.click(trigger('Resources'))
    await waitOpen(page, 'basalt-site-menu-p2')
    await page.raw.waitForTimeout(400)
    expect(parseFloat(await leaving('basalt-site-menu-p1'))).toBeLessThan(0)
    await page.raw.click(trigger('Product'))
    await waitOpen(page, 'basalt-site-menu-p1')
    await page.raw.waitForTimeout(400)
    expect(parseFloat(await leaving('basalt-site-menu-p2'))).toBeGreaterThan(0)
  })

  test('in a right-to-left page the panel opens under its item and stays on screen', async () => {
    const html = withScript.replace('<html lang="en">', '<html lang="ar" dir="rtl">')
    const page = await openDocument(html, DESKTOP_1440, DESKTOP)
    await page.settle()
    await page.raw.click(trigger('Product'))
    await waitOpen(page, 'basalt-site-menu-p1')
    const box = await page.raw.evaluate(() => {
      const t = document.querySelector('button[data-basalt-top]')?.getBoundingClientRect()
      const p = document.getElementById('basalt-site-menu-p1')?.getBoundingClientRect()
      return t && p
        ? { tr: t.right, tb: t.bottom, pr: p.right, pl: p.left, pt: p.top, vw: innerWidth }
        : null
    })
    expect(box).not.toBeNull()
    if (!box) return
    expect(Math.abs(box.pr - box.tr)).toBeLessThan(2)
    expect(box.pl).toBeGreaterThanOrEqual(0)
    expect(box.pt - box.tb).toBeLessThan(16)
  })

  test('with no script a click and Enter open a panel and Escape closes it', async () => {
    const page = await openDocument(withoutScript, DESKTOP_1440, DESKTOP)
    await page.settle()
    await page.raw.click(trigger('Product'))
    await waitOpen(page, 'basalt-site-menu-p1')
    await page.raw.keyboard.press('Escape')
    await page.raw.focus(trigger('Resources'))
    await page.raw.keyboard.press('Enter')
    await waitOpen(page, 'basalt-site-menu-p2')
    expect(await open(page)).toEqual(['basalt-site-menu-p2'])
  })

  test('the header with a panel open has no serious axe violation', async () => {
    const page = await openDocument(withScript, DESKTOP_1440, DESKTOP)
    await page.settle()
    await page.raw.click(trigger('Product'))
    await waitOpen(page, 'basalt-site-menu-p1')
    expect(await axeSerious(page)).toEqual([])
  })

  test('below the wide size one button opens a full-height sheet with a section per menu', async () => {
    const page = await openDocument(withoutScript, PHONE, { pointer: 'coarse' })
    await page.settle()
    expect(
      await page.raw.isVisible(
        '[data-slot="site-header"] nav[aria-label="Main"] button[data-basalt-top]',
      ),
    ).toBe(false)
    await page.raw.click('button[aria-label="Menu"]')
    await page.raw.waitForFunction(
      () => document.getElementById('basalt-site-menu')?.matches(':popover-open') === true,
    )
    const sheet = await page.raw.evaluate(() => {
      const s = document.getElementById('basalt-site-menu')?.getBoundingClientRect()
      const groups = [...document.querySelectorAll('#basalt-site-menu ul[aria-labelledby]')].map(
        (g) => g.getAttribute('aria-labelledby'),
      )
      const names = [...document.querySelectorAll('#basalt-site-menu [id]')].map((e) =>
        e.textContent?.trim(),
      )
      return s
        ? { top: s.top, height: s.height, vh: innerHeight, groups: groups.length, names }
        : null
    })
    expect(sheet).not.toBeNull()
    if (!sheet) return
    expect(sheet.top).toBe(56)
    expect(Math.abs(sheet.top + sheet.height - sheet.vh)).toBeLessThan(1)
    expect(sheet.groups).toBe(3)
    expect(sheet.names).toEqual(
      expect.arrayContaining(['Product', 'Resources', 'Learn', 'Project']),
    )
    expect(await axeSerious(page)).toEqual([])
  })

  test('a header with only links keeps its short sheet', async () => {
    const html = withScript.replace(
      /<body>[\s\S]*<\/body>/,
      () => `<body>${renderToString(createElement(Parts, { menus: false }))}</body>`,
    )
    const page = await openDocument(html, PHONE, { pointer: 'coarse' })
    await page.settle()
    await page.raw.click('button[aria-label="Menu"]')
    await page.raw.waitForFunction(
      () => document.getElementById('basalt-site-menu')?.matches(':popover-open') === true,
    )
    const height = await page.raw.evaluate(
      () => document.getElementById('basalt-site-menu')?.getBoundingClientRect().height ?? 0,
    )
    expect(height).toBeLessThan(400)
  })
})
