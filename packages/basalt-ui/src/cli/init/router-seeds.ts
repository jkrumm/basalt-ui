/**
 * The router scaffold `init --profile app` writes (`agent/templates/{main,__root,_app,nav,
 * _app-index,_app-pending,_app-error,_app-missing}.tpl`): each seed goes to its destination once, when nothing
 * is there, and is the consumer's from then on (`sync` never reads them). A create-vite `main.tsx`
 * is the one existing file replaced; any other existing entry is left and the template's lines are
 * printed. A Start app (without `--start`), a code-routed app and `basalt.shell: false` get none;
 * with `--start` the app gets the Start host seeds (`__root.start.tpl`, `router.start.tpl`) and no `main.tsx`.
 */
import { readdirSync, rmSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { readBasaltConfig, resolveAppDir } from '../index'
import {
  CODE_ROUTED_NOTE,
  ROUTER_SEED_TEMPLATES,
  routerSeedDest,
  routerSeedSkip,
  SHELL_LESS_NOTE,
  START_PROVIDER_HINT,
  START_ROUTER_DEST,
  START_SEED_TEMPLATES,
} from '../router-wiring'
import type { RouterSeedSkip } from '../router-wiring'
import { routePatterns } from '../route-tree'
import { hasDependency, readIfExists, tokenize } from '../source-text'
import type { Ctx } from './steps'
import { appName, CSS_ENTRIES, say, writeText } from './steps'

/** What create-vite's `src/main.tsx` is: renders `App`, mounts no router. */
export function isStockViteMain(text: string): boolean {
  const { code } = tokenize(text)
  return (
    /\bimport\s+App\s+from\s*['"]\.\/App(?:\.[jt]sx?)?['"]/.test(code) &&
    /<App\s*\/>/.test(code) &&
    !/Router/.test(code)
  )
}

/** What create-vite's `src/App.tsx` is: the Vite + React demo page (every template version names one of these). */
export function isStockViteApp(text: string): boolean {
  return (
    /from\s*['"]\.\/assets\/react\.svg['"]/.test(text) ||
    /Vite\s*\+\s*React/.test(text) ||
    /test\s+HMR/i.test(text)
  )
}

/** What create-vite's `src/App.css` is: the demo page's logo spin, or the newer hero and counter. */
export function isStockViteAppCss(text: string): boolean {
  return /logo-spin/.test(text) || (/\.counter\b/.test(text) && /\.hero\b|#center\b/.test(text))
}

/**
 * After the stock entry is replaced, `App.tsx` and `App.css` are imported by nothing. Each one that
 * is provably create-vite's is deleted; one that is not is named as dead, never touched.
 */
function dropStockApp(ctx: Ctx, mainDest: string): void {
  const dir = dirname(mainDest)
  const tsx = join(dir, 'App.tsx')
  const css = join(dir, 'App.css')
  const app = readIfExists(resolve(ctx.root, tsx))
  const style = readIfExists(resolve(ctx.root, css))
  const dead: string[] = []
  const remove = (rel: string): void => {
    rmSync(resolve(ctx.root, rel))
    say(`removed ${rel}: create-vite's demo page, nothing imports it now`)
  }
  let appGone = app === null
  if (app !== null && isStockViteApp(app)) {
    remove(tsx)
    appGone = true
  } else if (app !== null) dead.push(tsx)
  if (style !== null && appGone && isStockViteAppCss(style)) remove(css)
  else if (style !== null) dead.push(css)
  if (dead.length > 0)
    say(
      `${dead.join(' and ')} ${dead.length > 1 ? 'are' : 'is'} no longer imported by the entry: delete it or import it`,
    )
}

const SKIP_NOTES: Record<NonNullable<RouterSeedSkip>, string> = {
  start: `TanStack Start app — no router seeds written; ${START_PROVIDER_HINT}.`,
  'code-routed': CODE_ROUTED_NOTE,
  'shell-less': SHELL_LESS_NOTE,
}

/** The seeds to write: [id, dest, template]. A Start host swaps the root route and adds `router.tsx`; it has no `main`. */
export function seedPlan(appRel: string, start: boolean): [string, string, string][] {
  const seeds = Object.entries(ROUTER_SEED_TEMPLATES).flatMap(
    ([seed, tpl]): [string, string, string][] => {
      const id = seed as keyof typeof ROUTER_SEED_TEMPLATES
      if (start && id === 'main') return []
      const template = start && id === 'root' ? START_SEED_TEMPLATES.root : tpl
      return [[seed, routerSeedDest(appRel, id), template]]
    },
  )
  if (!start) return seeds
  const router = appRel === '' ? START_ROUTER_DEST : `${appRel}/${START_ROUTER_DEST}`
  return [...seeds, ['router', router, START_SEED_TEMPLATES.router]]
}

/** True when a page file under the app's `routes/` already serves `/`: a second one would be a duplicate route. */
function routeServesRoot(ctx: Ctx, appRel: string): boolean {
  const routes = dirname(routerSeedDest(appRel, 'root'))
  const files = (() => {
    try {
      return readdirSync(resolve(ctx.root, routes), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => join(relative(resolve(ctx.root, routes), entry.parentPath), entry.name))
    } catch {
      return []
    }
  })()
  return routePatterns(files.map((f) => `${routes}/${f}`)).some((p) => p.length === 0)
}

/** The `_app` layout, its parts and the nav it imports: none is seeded beside a kept root route or a route that already serves `/`. */
const LAYOUT_SEEDS: ReadonlySet<string> = new Set(['nav', 'app', 'appIndex'])

/** Why the `_app` layout family is not seeded, or null: the app keeps its own root route, or a route already serves `/`. */
function layoutSkip(ctx: Ctx, appRel: string, keptRoot: boolean): string | null {
  if (keptRoot) return 'the app keeps its own root route'
  return routeServesRoot(ctx, appRel) ? 'a route file already serves /' : null
}
/** The stylesheet the Start root route links, as an import path from `src/routes`: the app's entry in `src` or at its root, else `src/index.css` (`wireApp` writes it). */
function cssEntry(ctx: Ctx, appRel: string): string {
  const inSrc = CSS_ENTRIES.find((f) => readIfExists(resolve(ctx.root, appRel, 'src', f)) !== null)
  if (inSrc !== undefined) return `../${inSrc}`
  const atRoot = CSS_ENTRIES.find((f) => readIfExists(resolve(ctx.root, appRel, f)) !== null)
  return atRoot === undefined ? '../index.css' : `../../${atRoot}`
}

/** A Start host: the files create-vite or a Start starter leaves that nothing mounts, and the dependency the app owns. */
function startTodos(ctx: Ctx, app: { dir: string; rel: string }): void {
  if (!hasDependency(app.dir, '@tanstack/react-start')) {
    ctx.todo.push('add @tanstack/react-start (the app owns it; it needs vite >= 8)')
  }
  const left = ['index.html', 'src/main.tsx']
    .map((f) => (app.rel === '' ? f : `${app.rel}/${f}`))
    .filter((f) => readIfExists(resolve(ctx.root, f)) !== null)
  if (left.length > 0) {
    ctx.todo.push(`delete ${left.join(' and ')}: Start owns the document and the entry`)
  }
  ctx.todo.push('run `vite build` once to write src/routeTree.gen.ts, the first route tree')
}

/**
 * Writes the router seeds of an `app` install and records on `ctx.routerPlugin` whether the app is
 * file-routed (the Vite plugin step reads it). Runs before the Vite patch: that patch registers
 * the router plugin, which would turn a code-routed app into a file-routed one.
 */
export function placeRouterSeeds(ctx: Ctx): void {
  if (ctx.args.profile !== 'app') return
  const app = resolveAppDir(ctx.root)
  if ('error' in app) return void ctx.problems.push(app.error)

  const start = ctx.args.start
  const shellLess = readBasaltConfig(app.dir).shell === false
  const skip = start
    ? shellLess
      ? 'shell-less'
      : null
    : (routerSeedSkip(ctx.root, app.rel) ?? (shellLess ? 'shell-less' : null))
  // A Start host registers `tanstackStart()`, which owns the route tree: never `tanstackRouter()`.
  ctx.routerPlugin = !start && (skip === null || skip === 'shell-less')
  if (start) startTodos(ctx, app)
  if (skip !== null) return say(`skipped the router seeds: ${SKIP_NOTES[skip]}`)

  const name = appName(ctx.root).replace(/[\\']/g, '\\$&')
  const seeds = seedPlan(app.rel, start).flatMap(([seed, dest, tpl]) => {
    const template = readIfExists(resolve(ctx.pkgRoot, 'agent/templates', tpl))
    if (template === null) {
      ctx.problems.push(`${ctx.pkgRoot} ships no ${tpl}`)
      return []
    }
    const text = template
      .replaceAll('{{APP_NAME}}', () => name)
      .replaceAll('{{CSS_ENTRY}}', () => cssEntry(ctx, app.rel))
    return [{ seed, dest, text }]
  })
  const rootText = seeds.find((s) => s.seed === 'root')?.text
  const ownRoot = readIfExists(resolve(ctx.root, routerSeedDest(app.rel, 'root')))
  const layout = layoutSkip(ctx, app.rel, ownRoot !== null && ownRoot !== rootText)
  let skipped: string | null = null
  for (const { seed, dest, text } of seeds) {
    const existing = readIfExists(resolve(ctx.root, dest))
    if (layout !== null && LAYOUT_SEEDS.has(seed) && existing === null) {
      say(`skipped ${dest}: ${layout}`)
      skipped = layout
    } else if (existing === null) {
      writeText(ctx.root, dest, text)
      say(`wrote ${dest}`)
    } else if (seed === 'main' && isStockViteMain(existing)) {
      writeText(ctx.root, dest, text)
      say(`${dest}: replaced create-vite's entry with the router entry`)
      dropStockApp(ctx, dest)
    } else if (existing === text) {
      say(`kept ${dest}: already the seed`)
    } else if (seed === 'main') {
      say(`kept ${dest}: it exists and is not create-vite's entry`)
      ctx.todo.push(`make ${dest} mount the router; the seed is:\n${text}`)
    } else {
      say(`kept ${dest}: it exists`)
    }
  }
  if (skipped !== null) {
    ctx.todo.push(
      `no _app layout or nav was seeded (${skipped}): add them by hand if the app wants the basalt shell`,
    )
  }
}
