/* oxlint-disable no-console -- CLI entry point: progress and failures go to the terminal */
/**
 * `make compare` — side-by-side design-parity board. Builds (or takes) a playground dist, serves it,
 * crops each mapped pattern per scheme × viewport, measures its structure, and writes
 * `board.html` + `board-<viewport>.png` + `compare.json` next to the crops.
 *
 *   bun scripts/evidence/compare.ts --label <label> [--out <dir>] [--dist <dir>] [--patterns a,b]
 *
 * Keel is read only through the committed `docs/waves/design-parity/keel/` crops and
 * `inventory.json`; this script never fetches it. Structural metrics only — no pixel diff.
 */
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'
import {
  PAIR_KEYS,
  SCHEMES,
  VIEWPORTS,
  buildBoardHtml,
  isInside,
  pairKey,
  parseInventory,
  patternIds,
} from './compare-board'
import type {
  BasaltResult,
  BoardEntry,
  InventoryPattern,
  PairKey,
  Scheme,
  Viewport,
} from './compare-board'
import { isMissing, mappingFor } from './compare-patterns'
import type { FoundMapping, Metrics } from './compare-patterns'
import { stableStringify } from './index'
import { withTimeout } from './perf-util'
import { serveDist } from './serve'

const ROOT = resolve(import.meta.dirname, '../..')
const KEEL_DIR = join(ROOT, 'docs/waves/design-parity/keel')
const PARITY_DIR = join(ROOT, 'docs/waves/design-parity')
const BUILD_TIMEOUT_MS = 300_000
const RUN_TIMEOUT_MS = 10 * 60_000
const BOARD_TIMEOUT_MS = 2 * 60_000
const NAV_TIMEOUT_MS = 30_000
const FIND_TIMEOUT_MS = 10_000

const VIEWPORT_SPECS: Record<Viewport, { width: number; height: number; mobile: boolean }> = {
  desktop: { width: 1440, height: 900, mobile: false },
  mobile: { width: 390, height: 844, mobile: true },
}

// ── Build (the same two steps as `index.ts`, whose helper is not exported) ───────────────────

async function sh(cmd: string[], cwd: string, env: Record<string, string> = {}): Promise<void> {
  const proc = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, ...env },
    stdout: 'inherit',
    stderr: 'inherit',
    timeout: BUILD_TIMEOUT_MS,
  })
  if ((await proc.exited) !== 0) throw new Error(`${cmd.join(' ')} failed in ${cwd}`)
}

async function buildPlayground(): Promise<string> {
  await sh(['bun', 'run', 'build'], join(ROOT, 'packages/basalt-ui'))
  await sh(['bunx', 'vite', 'build', '--manifest'], join(ROOT, 'apps/playground'))
  return join(ROOT, 'apps/playground/dist')
}

// ── In-page code (serialised by Playwright: no closures, no imports) ─────────────────────────

type ResolveArgs = { css: string; select: string | null }

/** The measured element: the tagged/selected root, then `select` resolved inside it (`:scope` = the root). */
function resolveAnchor({ css, select }: ResolveArgs): Element | null {
  const root = document.querySelector(css)
  return root && select ? root.querySelector(select) : root
}

/** Structural metrics of one element. Roles are `--vx-*` names when a token's colour matches exactly. */
function measure(node: Node, rowLike: boolean): Metrics {
  const out: Metrics = {}
  if (!(node instanceof Element)) return out
  const el = node
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- serialised into the page: no outer scope
  const px = (v: string | number): number => Math.round(parseFloat(String(v)) * 100) / 100
  const roles = new Map<string, string>()
  // The probe sits under a sentinel-coloured parent: a token that is not a colour makes `color: var()`
  // invalid at computed-value time, which inherits the parent — so the sentinel marks "not a colour".
  const holder = document.createElement('div')
  const probe = document.createElement('i')
  const SENTINEL = 'rgba(1, 2, 3, 0.123)'
  holder.style.color = SENTINEL
  holder.append(probe)
  document.body.append(holder)
  const names = new Set<string>()
  const collect = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        for (const name of Array.from(rule.style)) if (name.startsWith('--vx-')) names.add(name)
      } else if (rule instanceof CSSGroupingRule) collect(rule.cssRules)
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      collect(sheet.cssRules)
    } catch {
      // cross-origin sheet: no tokens to read from it
    }
  }
  for (const name of names) {
    probe.style.color = `var(${name})`
    const c = getComputedStyle(probe).color
    if (c !== SENTINEL && !roles.has(c)) roles.set(c, name)
  }
  holder.remove()
  const role = (color: string): string => {
    if (color === 'rgba(0, 0, 0, 0)' || color === 'transparent') return 'transparent'
    return roles.get(color) ?? 'unknown'
  }

  const cs = getComputedStyle(el)
  const rect = el.getBoundingClientRect()
  out.width = px(rect.width)
  out.height = px(rect.height)
  out.paddingTop = px(cs.paddingTop)
  out.paddingRight = px(cs.paddingRight)
  out.paddingBottom = px(cs.paddingBottom)
  out.paddingLeft = px(cs.paddingLeft)
  out.radius = px(cs.borderTopLeftRadius)
  const sides = [
    [cs.borderTopWidth, cs.borderTopColor],
    [cs.borderRightWidth, cs.borderRightColor],
    [cs.borderBottomWidth, cs.borderBottomColor],
    [cs.borderLeftWidth, cs.borderLeftColor],
  ] as const
  const widest = sides.reduce((a, b) => (parseFloat(b[0]) > parseFloat(a[0]) ? b : a))
  out.borderWidth = px(widest[0])
  if (parseFloat(widest[0]) > 0) out.borderRole = role(widest[1])
  out.backgroundRole = role(cs.backgroundColor)
  out.shadow = cs.boxShadow === 'none' ? 'none' : 'shadow'
  if (rowLike) out.rowHeight = px(rect.height)

  // gap: the first flex/grid box (root first, breadth-first) that actually spaces its children.
  const queue: Element[] = [el]
  for (let i = 0; i < queue.length && i < 60; i++) {
    const item = queue[i]
    if (!item) break
    const s = getComputedStyle(item)
    if ((s.display.includes('flex') || s.display.includes('grid')) && parseFloat(s.rowGap) > 0) {
      out.gap = px(s.rowGap)
      break
    }
    queue.push(...Array.from(item.children))
  }

  // dividerRole: the first descendant that draws a separator (an hr, or a border on its top/bottom edge).
  for (const d of Array.from(el.querySelectorAll('*')).slice(0, 200)) {
    const s = getComputedStyle(d)
    if (d.tagName === 'HR' || d.getAttribute('role') === 'separator') {
      out.dividerRole = role(s.borderTopWidth !== '0px' ? s.borderTopColor : s.backgroundColor)
      break
    }
    const edge = parseFloat(s.borderBottomWidth) > 0 ? s.borderBottomColor : s.borderTopColor
    if (parseFloat(s.borderBottomWidth) > 0 || parseFloat(s.borderTopWidth) > 0) {
      const found = role(edge)
      if (found === 'transparent') continue
      out.dividerRole = found
      break
    }
  }

  // Typography of the visible text nodes: largest size = value, smallest = label, most common = body.
  type Run = { size: number; weight: number; line: number; color: string; count: number }
  const runs = new Map<number, Run>()
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement
    if (!parent || !n.textContent?.trim()) continue
    const s = getComputedStyle(parent)
    if (s.visibility === 'hidden' || s.display === 'none') continue
    const size = parseFloat(s.fontSize)
    const line = s.lineHeight === 'normal' ? px(size * 1.2) : parseFloat(s.lineHeight)
    const prev = runs.get(size)
    if (prev) prev.count++
    else
      runs.set(size, { size, weight: parseInt(s.fontWeight, 10), line, color: s.color, count: 1 })
  }
  const sorted = [...runs.values()].toSorted((a, b) => a.size - b.size)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first && last) {
    out.labelSize = first.size
    out.labelWeight = first.weight
    out.labelLineHeight = first.line
    out.labelRole = role(first.color)
    out.valueSize = last.size
    out.valueWeight = last.weight
    out.valueLineHeight = last.line
    out.valueRole = role(last.color)
    const body = sorted.reduce((a, b) => (b.count >= a.count ? b : a))
    out.bodySize = body.size
    out.bodyWeight = body.weight
    out.bodyLineHeight = body.line
  }

  for (const svg of Array.from(el.querySelectorAll('svg'))) {
    const r = svg.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.height >= 24 && r.width >= 40) {
      if (out.chartHeight === undefined) out.chartHeight = px(r.height)
    } else if (out.iconSize === undefined) out.iconSize = px(r.width)
  }
  return out
}

// ── Browser run ──────────────────────────────────────────────────────────────────────────────

/**
 * One Chrome for `fn`, killed afterwards even when `fn` times out. `launchServer` + `connect` +
 * `kill()` — a graceful `close()` hangs on this host (see index.ts).
 */
async function withChrome<T>(
  fn: (browser: Browser) => Promise<T>,
  timeoutMs: number,
  what: string,
): Promise<T> {
  const chrome = await chromium.launchServer({
    channel: 'chrome',
    chromiumSandbox: !process.env['CI'],
  })
  try {
    const browser = await chromium.connect(chrome.wsEndpoint())
    return await withTimeout(fn(browser), timeoutMs, what)
  } finally {
    await chrome.kill().catch(() => undefined)
  }
}

type Measured = { id: string; scheme: Scheme; viewport: Viewport; metrics: Metrics }

async function captureOne(
  page: Page,
  baseUrl: string,
  id: string,
  m: FoundMapping,
  viewport: Viewport,
  file: string,
): Promise<Metrics> {
  await page.goto(baseUrl + m.route, { waitUntil: 'networkidle' })
  if (m.storage) {
    await page.evaluate((entries) => {
      for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v)
    }, m.storage)
    await page.reload({ waitUntil: 'networkidle' })
  }
  try {
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    if (m.before) await page.click(m.before.click, { timeout: FIND_TIMEOUT_MS })
    const raw = viewport === 'mobile' ? (m.mobileSelector ?? m.selector) : m.selector
    const args: ResolveArgs = {
      css: raw ?? `[data-compare="${m.anchor ?? id}"]`,
      select: m.select ?? null,
    }
    const handle = await page.waitForFunction(resolveAnchor, args, { timeout: FIND_TIMEOUT_MS })
    const el = handle.asElement()
    if (!el) throw new Error('anchor did not resolve to an element')
    await el.scrollIntoViewIfNeeded()
    if (!(await el.isVisible())) throw new Error('anchor is not visible at this viewport')
    const onScreen = await el.evaluate((node) => {
      if (!(node instanceof Element)) return false
      const r = node.getBoundingClientRect()
      return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight
    })
    if (!onScreen) throw new Error('anchor is off-screen at this viewport')
    await el.screenshot({ path: file, animations: 'disabled', caret: 'hide' })
    return await el.evaluate(measure, m.rowLike === true)
  } finally {
    if (m.storage) {
      await page.evaluate(
        (keys) => keys.forEach((k) => localStorage.removeItem(k)),
        Object.keys(m.storage),
      )
    }
  }
}

async function captureAll(params: {
  baseUrl: string
  outDir: string
  ids: readonly string[]
}): Promise<{ results: Map<string, BasaltResult>; metrics: Measured[] }> {
  const { baseUrl, outDir, ids } = params
  await mkdir(join(outDir, 'basalt'), { recursive: true })
  const results = new Map<string, BasaltResult>(
    ids.map((id) => [id, { crops: {}, metrics: {}, errors: {} }]),
  )
  const metrics: Measured[] = []
  await withChrome(
    async (browser) => {
      for (const scheme of SCHEMES) {
        for (const viewport of VIEWPORTS) {
          const spec = VIEWPORT_SPECS[viewport]
          const context = await browser.newContext({
            viewport: { width: spec.width, height: spec.height },
            deviceScaleFactor: 1,
            isMobile: spec.mobile,
            hasTouch: spec.mobile,
            colorScheme: scheme,
            reducedMotion: 'reduce',
          })
          await context.addInitScript(
            (value) => localStorage.setItem('mantine-color-scheme-value', value),
            scheme,
          )
          const page = await context.newPage()
          page.setDefaultTimeout(NAV_TIMEOUT_MS)
          for (const id of ids) {
            const mapping = mappingFor(id)
            const result = results.get(id)
            if (isMissing(mapping) || !result) continue
            const key = pairKey(scheme, viewport)
            const name = `${id}--${scheme}--${viewport}.png`
            try {
              const measured = await captureOne(
                page,
                baseUrl,
                id,
                mapping,
                viewport,
                join(outDir, 'basalt', name),
              )
              result.crops[key] = `basalt/${name}`
              // The board's metrics table reads the dark scheme; compare.json keeps both.
              if (scheme === 'dark') result.metrics[viewport] = measured
              metrics.push({ id, scheme, viewport, metrics: measured })
              console.log(`[compare] ${id} ${key} ok`)
            } catch (error) {
              const msg =
                (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''
              result.errors[key] = msg
              console.error(`[compare] ${id} ${key} failed: ${msg}`)
            }
          }
          await context.close()
        }
      }
    },
    RUN_TIMEOUT_MS,
    'compare capture',
  )
  return { results, metrics }
}

async function shootBoards(outDir: string): Promise<void> {
  await withChrome(
    async (browser) => {
      for (const viewport of VIEWPORTS) {
        const spec = VIEWPORT_SPECS[viewport]
        const context = await browser.newContext({
          viewport: { width: spec.width, height: spec.height },
          deviceScaleFactor: 1,
          reducedMotion: 'reduce',
        })
        const page = await context.newPage()
        await page.goto(pathToFileURL(join(outDir, 'board.html')).href, { waitUntil: 'load' })
        await page.screenshot({ path: join(outDir, `board-${viewport}.png`), fullPage: true })
        await context.close()
      }
    },
    BOARD_TIMEOUT_MS,
    'board screenshots',
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────────────────────

async function readInventory(): Promise<string | null> {
  const file = join(KEEL_DIR, 'inventory.json')
  return existsSync(file) ? readFile(file, 'utf8') : null
}

/** Keel crops that exist on disk, as paths relative to `board.html` (copied into `<out>/keel/` when `out` is elsewhere). */
async function keelCropsFor(
  keel: InventoryPattern | undefined,
  outDir: string,
  inParity: boolean,
): Promise<Partial<Record<PairKey, string>>> {
  const crops: Partial<Record<PairKey, string>> = {}
  if (!keel) return crops
  for (const key of PAIR_KEYS) {
    const rel = keel.crops[key]
    if (!rel) continue
    const src = resolve(KEEL_DIR, rel)
    if (!isInside(KEEL_DIR, src) || !existsSync(src)) continue
    if (inParity) {
      crops[key] = relative(outDir, src).split('\\').join('/')
    } else {
      const dest = join(outDir, 'keel', rel)
      await mkdir(dirname(dest), { recursive: true })
      await copyFile(src, dest)
      crops[key] = `keel/${rel}`
    }
  }
  return crops
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      label: { type: 'string' },
      out: { type: 'string' },
      dist: { type: 'string' },
      patterns: { type: 'string' },
    },
  })
  const label = values.label
  if (!label || !/^[\w.-]+$/.test(label) || /^\.+$/.test(label)) {
    console.error(
      'usage: bun scripts/evidence/compare.ts --label <label> [--out <dir>] [--dist <dir>] [--patterns a,b]',
    )
    return 2
  }
  const outDir = values.out ? resolve(values.out) : join(ROOT, '.evidence/compare', label)
  const inParity = outDir === PARITY_DIR || isInside(PARITY_DIR, outDir)

  const inventory = parseInventory(await readInventory())
  const wanted = (values.patterns ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const all = patternIds(inventory)
  const unknown = wanted.filter((p) => !all.includes(p))
  if (unknown.length > 0) throw new Error(`unknown pattern(s): ${unknown.join(', ')}`)
  const ids = wanted.length > 0 ? all.filter((id) => wanted.includes(id)) : all

  const distDir = values.dist ? resolve(values.dist) : await buildPlayground()
  if (!existsSync(join(distDir, 'index.html'))) throw new Error(`no index.html in ${distDir}`)
  await mkdir(outDir, { recursive: true })

  const server = serveDist(distDir)
  let captured: Awaited<ReturnType<typeof captureAll>>
  try {
    captured = await captureAll({ baseUrl: server.origin, outDir, ids })
  } finally {
    server.stop()
  }
  const { results, metrics } = captured

  const entries: BoardEntry[] = []
  for (const id of ids) {
    const keel = inventory.patterns.find((p) => p.id === id)
    entries.push({
      id,
      mapping: mappingFor(id),
      keel,
      keelCrops: await keelCropsFor(keel, outDir, inParity),
      basalt: results.get(id) ?? { crops: {}, metrics: {}, errors: {} },
    })
  }
  await writeFile(join(outDir, 'board.html'), buildBoardHtml({ label, inventory, entries }))
  await writeFile(
    join(outDir, 'compare.json'),
    stableStringify({
      label,
      viewports: VIEWPORT_SPECS,
      mapping: Object.fromEntries(entries.map((e) => [e.id, e.mapping])),
      results: Object.fromEntries(
        entries.map((e) => [e.id, { errors: e.basalt.errors, crops: e.basalt.crops }]),
      ),
      metrics: metrics.toSorted((a, b) =>
        `${a.id}${a.scheme}${a.viewport}`.localeCompare(`${b.id}${b.scheme}${b.viewport}`),
      ),
    }),
  )
  await shootBoards(outDir)

  const found = entries.filter((e) => !isMissing(e.mapping))
  const failed = found.filter((e) => Object.keys(e.basalt.errors).length > 0)
  const ok = found.filter((e) => Object.keys(e.basalt.crops).length > 0)
  console.log(
    `[compare] patterns: ${found.length} mapped (${ok.length} captured, ${failed.length} with failures), ` +
      `${entries.length - found.length} missing; keel inventory ${inventory.patterns.length ? 'present' : 'absent'}`,
  )
  console.log(`[compare] wrote ${outDir}`)
  // A pattern absent at one viewport is a finding, not a broken run; nothing captured at all is.
  return ok.length === 0 && found.length > 0 ? 1 : 0
}

if (import.meta.main) process.exit(await main())
