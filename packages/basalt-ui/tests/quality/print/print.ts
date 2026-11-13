/**
 * The print cell (quality-contract section 4, row `print`): one route in the print medium. Chromium
 * only (`page.pdf`). A cell fails when
 *
 *  - the PDF has no page, or runs away (`MAX_PAGES`);
 *  - a scrollport (an element that clips its overflow) is shorter than its content: the
 *    "24 of 80 rows print" bug, where the screen frame clips what the printer should get;
 *  - text ink is under 4.5:1 on white paper (the dark scheme printing as light grey);
 *  - a card-like block that fits on one page does not forbid a break inside it (`break-inside`).
 *
 * The screen state the user prints from is reproduced: the dark scheme is set first and
 * `beforeprint` is dispatched, because `emulateMedia` and `page.pdf` fire no print events and the
 * shell swaps the scheme in that handler.
 */
import type { Page } from 'playwright-core'
import { quality } from '../../../src/testing/quality'
import type { PageLike } from '../../../src/testing/quality'
import { pdfPageCount } from './pdf'

/** A4 with a 10 mm margin, in CSS px (96 dpi): the box the print layout flows into. */
export const A4_CONTENT = { width: 718, height: 1047 } as const
export const MAX_PAGES = 60
export const MIN_INK_CONTRAST = 4.5

/** Blocks a page break must not cut: cards, stat cells, chart frames, table rows. */
export const UNSPLITTABLE =
  '[data-slot="card"], [data-slot="stat-card"], [data-slot="chart-card"], tr'

export type PrintReport = { pages: number; failures: string[] }

type Probe = { scrollports: string[]; ink: string[]; splits: string[] }

/** Runs in the page. Self-contained: it is serialised, so it closes over nothing. */
function probe(args: { selector: string; pageHeight: number; minInk: number }): Probe {
  const path = (el: Element): string => {
    const slot = el.getAttribute('data-slot')
    return `${el.tagName.toLowerCase()}${slot ? `[data-slot=${slot}]` : ''}${el.id ? `#${el.id}` : ''}`
  }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const rgba = (css: string): [number, number, number, number] => {
    if (!ctx) return [0, 0, 0, 1]
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 255) / 255]
  }
  const lum = (r: number, g: number, b: number): number => {
    const f = (v: number): number => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }

  // sr-only: a 1px box or a zero clip. Not content, so neither clipped nor inked.
  const hidden = (el: Element): boolean => {
    for (let up: Element | null = el; up && up !== document.body; up = up.parentElement) {
      const s = getComputedStyle(up)
      const box = up.getBoundingClientRect()
      if (s.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\(50%\)/.test(s.clipPath)) return true
      if (s.position === 'absolute' && (box.width <= 1 || box.height <= 1)) return true
    }
    return false
  }

  const scrollports: string[] = []
  for (const el of document.querySelectorAll<HTMLElement>('body *, body')) {
    const s = getComputedStyle(el)
    if (s.display === 'none' || hidden(el)) continue
    const clips = (v: string): boolean =>
      v === 'hidden' || v === 'auto' || v === 'scroll' || v === 'clip'
    if (!clips(s.overflowY)) continue
    // Form controls scroll their own value; a clamp or ellipsis is a deliberate cut.
    if (/^(?:input|textarea|select)$/i.test(el.tagName)) continue
    if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') continue
    if (el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0) {
      scrollports.push(
        `${path(el)} scrollHeight ${el.scrollHeight} > clientHeight ${el.clientHeight}`,
      )
    }
  }

  const ink: string[] = []
  const seen = new Set<Element>()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement
    if (!el || seen.has(el) || !node.textContent?.trim()) continue
    seen.add(el)
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden' || hidden(el)) continue
    const box = el.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) continue
    // Ink over white paper: alpha composites on white, opacity of the chain multiplies in.
    let opacity = 1
    for (let up: Element | null = el; up; up = up.parentElement)
      opacity *= Number(getComputedStyle(up).opacity)
    const [r, g, b, a] = rgba(el instanceof SVGElement ? s.fill : s.color)
    const alpha = a * opacity
    // Paper is white unless an ancestor's fill is forced onto it (\`print-color-adjust: exact\`).
    let paper: [number, number, number] = [255, 255, 255]
    for (
      let up: Element | null = el;
      up && up !== document.documentElement;
      up = up.parentElement
    ) {
      const us = getComputedStyle(up)
      const [pr, pg, pb, pa] = rgba(us.backgroundColor)
      if (pa > 0.5 && us.printColorAdjust === 'exact') {
        paper = [pr, pg, pb]
        break
      }
    }
    const mix = (v: number, base: number): number => v * alpha + base * (1 - alpha)
    const lt = lum(mix(r, paper[0]), mix(g, paper[1]), mix(b, paper[2]))
    const lp = lum(...paper)
    const ratio = (Math.max(lt, lp) + 0.05) / (Math.min(lt, lp) + 0.05)
    if (ratio < args.minInk) ink.push(`${path(el)} ${ratio.toFixed(2)}:1 (${s.color})`)
  }

  const splits: string[] = []
  const avoids = (el: Element): boolean => {
    for (let up: Element | null = el; up && up !== document.body; up = up.parentElement) {
      const v = getComputedStyle(up).breakInside
      if (v === 'avoid' || v === 'avoid-page') return true
    }
    return false
  }
  const top = window.scrollY
  for (const el of document.querySelectorAll<HTMLElement>(args.selector)) {
    const box = el.getBoundingClientRect()
    if (box.height === 0 || box.height > args.pageHeight) continue
    if (avoids(el)) continue
    const first = Math.floor((box.top + top) / args.pageHeight)
    const last = Math.floor((box.bottom + top - 0.5) / args.pageHeight)
    splits.push(
      `${path(el)} may split across pages${last > first ? ` (it straddles the page ${first + 1}/${last + 1} edge)` : ''}: break-inside is not avoid`,
    )
  }
  return { scrollports, ink, splits }
}

/** Prepares `page` (loaded) as the user's print would see it and measures it. */
export async function measurePrint(page: Page): Promise<PrintReport> {
  await page.setViewportSize({ ...A4_CONTENT })
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'))
    return new Promise<void>((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => done())),
    )
  })
  const found = await page.evaluate(probe, {
    selector: UNSPLITTABLE,
    pageHeight: A4_CONTENT.height,
    minInk: MIN_INK_CONTRAST,
  })
  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    printBackground: false,
  })
  const pages = pdfPageCount(pdf)

  const failures: string[] = []
  if (pages === 0) failures.push('the PDF has no page')
  if (pages > MAX_PAGES) failures.push(`the PDF runs to ${pages} pages (limit ${MAX_PAGES})`)
  for (const line of found.scrollports) failures.push(`scrollport clips its content: ${line}`)
  for (const line of found.ink) failures.push(`ink under ${MIN_INK_CONTRAST}:1: ${line}`)
  for (const line of found.splits) failures.push(`card split: ${line}`)
  return { pages, failures }
}

/** The playground route in the user's state: dark scheme, loaded, then printed. */
export async function printRoute(page: Page, origin: string, route: string): Promise<PrintReport> {
  const like: PageLike = page
  await quality.setScheme(like, 'dark')
  await page.goto(origin + route, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-slot], main', { timeout: 15_000 })
  return measurePrint(page)
}

/** Seeded offenders: each must fail its own assertion, and `clean` must pass every one. */
export const OFFENDERS = [
  { name: 'split-card', fails: /card split: .*straddles/ },
  { name: 'clipped-scrollport', fails: /scrollport clips its content/ },
  { name: 'dark-ink', fails: /ink under 4\.5:1/ },
  { name: 'runaway', fails: /the PDF runs to \d+ pages/ },
] as const

export type OffenderOutcome = { offender: string; ok: boolean; detail: string }

/** Runs every offender fixture (HTML text by name) and the clean page; the outcome says whether each did its job. */
export async function runControls(
  page: Page,
  html: (name: string) => Promise<string>,
): Promise<OffenderOutcome[]> {
  const outcomes: OffenderOutcome[] = []
  const load = async (name: string): Promise<PrintReport> => {
    await page.emulateMedia({ media: 'screen' })
    await page.setContent(await html(name))
    return measurePrint(page)
  }
  const clean = await load('clean')
  outcomes.push({
    offender: 'clean',
    ok: clean.failures.length === 0,
    detail: clean.failures.join('; ') || `${clean.pages} page(s)`,
  })
  for (const o of OFFENDERS) {
    const report = await load(o.name)
    const hit = report.failures.some((line) => o.fails.test(line))
    outcomes.push({
      offender: o.name,
      ok: hit,
      detail: hit
        ? 'failed as seeded'
        : `did not fail ${String(o.fails)}: ${report.failures.join('; ') || 'passed'}`,
    })
  }
  return outcomes
}
