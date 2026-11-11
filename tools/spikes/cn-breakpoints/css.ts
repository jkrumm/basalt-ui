/**
 * Tailwind 4.3.5 against the v3 entry (packages/basalt-ui/src/css/tailwind.css), and the Chrome probes.
 *
 * Two independent routes to "what CSS does this class emit":
 *   - `isolated`: the `tailwindcss` compile API, one class at a time (the ground truth);
 *   - `cliBuild`: the real `@tailwindcss/cli` over a file listing every class at once (what a
 *     `no-unknown-classes` matcher would read as "the emitted CSS").
 * Chrome (playwright-core, `channel: 'chrome'`, the layout harness pattern) reads computed styles.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { compile } from 'tailwindcss'
import { chromium } from 'playwright-core'

const ROOT = import.meta.dir
export const BUILD = resolve(ROOT, '.build')
const CSS_SRC = resolve(ROOT, '../../../packages/basalt-ui/src/css')
const require = createRequire(import.meta.url)

/** `tailwind.css` of the package, minus the font import (no font file is needed for any probe). */
function v3Entry(): string {
  return readFileSync(resolve(CSS_SRC, 'tailwind.css'), 'utf8').replace(
    /^@import '\.\/fonts\.css';\n/m,
    '',
  )
}

/** The v3 sheet written next to `tokens.css` so `@import './tokens.css'` resolves. */
export function writeV3Sheet(dir: string): string {
  mkdirSync(dir, { recursive: true })
  copyFileSync(resolve(CSS_SRC, 'tokens.css'), resolve(dir, 'tokens.css'))
  const path = resolve(dir, 'tailwind.css')
  writeFileSync(path, v3Entry())
  return path
}

async function loadStylesheet(
  id: string,
  base: string,
): Promise<{ path: string; base: string; content: string }> {
  const path =
    id === 'tailwindcss'
      ? require.resolve('tailwindcss/index.css')
      : id.startsWith('tailwindcss/')
        ? require.resolve(id)
        : resolve(base, id)
  return { path, base: dirname(path), content: readFileSync(path, 'utf8') }
}

const cssUnescape = (s: string): string =>
  s
    .replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_m, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/\\(.)/g, '$1')

/** Class names that appear in a selector of `css`. */
export function emittedClasses(css: string): Set<string> {
  const out = new Set<string>()
  for (const m of css.matchAll(/\.((?:\\[0-9a-fA-F]{1,6} ?|\\.|[A-Za-z0-9_\- -￿])+)/g)) {
    out.add(cssUnescape(m[1] as string))
  }
  return out
}

export type Compiler = { build: (classes: string[]) => string }

export async function makeCompiler(entry: 'v3' | 'default'): Promise<Compiler> {
  const dir = resolve(BUILD, 'compile')
  const css = entry === 'v3' ? (writeV3Sheet(dir), v3Entry()) : "@import 'tailwindcss';"
  const compiler = await compile(css, { base: dir, loadStylesheet, onDependency: () => {} })
  return { build: (classes) => compiler.build(classes) }
}

/** Ground truth: a class is live iff compiling it alone emits a rule for it. */
export async function isolated(
  entry: 'v3' | 'default',
  classes: string[],
): Promise<Map<string, boolean>> {
  const compiler = await makeCompiler(entry)
  const res = new Map<string, boolean>()
  for (const c of classes) res.set(c, emittedClasses(compiler.build([c])).has(c))
  return res
}

/** The real CLI over one file listing every class: the "emitted CSS" a matcher would read. */
export function cliBuild(entry: 'v3' | 'default', classes: string[], name: string): string {
  const dir = resolve(BUILD, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const head = entry === 'v3' ? `@import './tailwind.css';` : `@import 'tailwindcss';`
  if (entry === 'v3') writeV3Sheet(dir)
  writeFileSync(resolve(dir, 'in.css'), `${head}\n@source './cands.html';\n`)
  writeFileSync(resolve(dir, 'cands.html'), classes.map((c) => `<i class="${c}"></i>`).join('\n'))
  const r = spawnSync(
    resolve(ROOT, 'node_modules/.bin/tailwindcss'),
    ['-i', resolve(dir, 'in.css'), '-o', resolve(dir, 'out.css')],
    { cwd: dir, encoding: 'utf8' },
  )
  if (r.status !== 0) throw new Error(`tailwind cli failed: ${r.stderr}`)
  return readFileSync(resolve(dir, 'out.css'), 'utf8')
}

// ---------------------------------------------------------------------------------------------
// Chrome

export async function withChrome<T>(
  fn: (open: (html: string, width: number) => Promise<Page>) => Promise<T>,
): Promise<T> {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    return await fn(async (html, width) => {
      const ctx = await browser.newContext({ viewport: { width, height: 800 } })
      const page = await ctx.newPage()
      await page.setContent(html)
      return page
    })
  } finally {
    await browser.close()
  }
}
type Page = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>>

/** F6 emit case: the computed `display` of a div for both class orders of a pair, v3 sheet. */
export async function emitCase(pair: [string, string]): Promise<{
  displayByOrder: Record<string, string>
  cssOrder: string[]
}> {
  const [a, b] = pair
  const orders = [`${a} ${b}`, `${b} ${a}`]
  const css = cliBuild('v3', pair, `emit-case-${a}-${b}`)
  const html = `<style>${css}</style>${orders.map((o, i) => `<div id="o${i}" class="${o}">x</div>`).join('')}`
  const displayByOrder: Record<string, string> = {}
  await withChrome(async (open) => {
    const page = await open(html, 1200)
    for (const [i, o] of orders.entries()) {
      displayByOrder[o] = await page.evaluate(
        (id) => getComputedStyle(document.getElementById(id) as Element).display,
        `o${i}`,
      )
    }
  })
  const at = (c: string): number => css.indexOf(`.${c} {`)
  const cssOrder = [a, b].toSorted((a, b) => at(a) - at(b))
  return { displayByOrder, cssOrder }
}

/** Does the class change an element's computed style at a narrow or a wide viewport? */
export async function chromeEffects(css: string, classes: string[]): Promise<Map<string, boolean>> {
  const html = `<style>${css}</style><div id="base" style="width:300px">x</div>${classes
    .map(
      (c, i) =>
        `<div id="c${i}" class="${c.replaceAll('"', '&quot;')}" style="width:300px">x</div>`,
    )
    .join('')}`
  const out = new Map<string, boolean>(classes.map((c) => [c, false]))
  await withChrome(async (open) => {
    for (const width of [600, 1600]) {
      const page = await open(html, width)
      const changed = await page.evaluate((n) => {
        // index 0 is the bare element, 1..n the classed ones
        const dumps = Array.from({ length: n + 1 }, (_v, i) => {
          const cs = getComputedStyle(
            document.getElementById(i === 0 ? 'base' : `c${i - 1}`) as Element,
          )
          return Array.from(cs, (p) => `${p}:${cs.getPropertyValue(p)}`).join(';')
        })
        return dumps.slice(1).map((d) => d !== dumps[0])
      }, classes.length)
      for (const [i, c] of classes.entries()) if (changed[i]) out.set(c, true)
    }
  })
  return out
}
