/**
 * The router scaffold `init --profile app` writes (`agent/templates/{main,__root,_app,nav,
 * _app-pending,_app-error,_app-missing}.tpl`): each seed goes to its destination once, when nothing
 * is there, and is the consumer's from then on (`sync` never reads them). A create-vite `main.tsx`
 * is the one existing file replaced; any other existing entry is left and the template's lines are
 * printed. A Start app, a code-routed app and `basalt.shell: false` get none.
 */
import { resolve } from 'node:path'

import { readBasaltConfig, resolveAppDir } from '../index'
import {
  CODE_ROUTED_NOTE,
  ROUTER_SEED_TEMPLATES,
  routerSeedDest,
  routerSeedSkip,
  SHELL_LESS_NOTE,
  START_PROVIDER_HINT,
} from '../router-wiring'
import type { RouterSeedSkip } from '../router-wiring'
import { readIfExists, tokenize } from '../source-text'
import type { Ctx } from './steps'
import { appName, say, writeText } from './steps'

/** What create-vite's `src/main.tsx` is: renders `App`, mounts no router. */
export function isStockViteMain(text: string): boolean {
  const { code } = tokenize(text)
  return (
    /\bimport\s+App\s+from\s*['"]\.\/App(?:\.[jt]sx?)?['"]/.test(code) &&
    /<App\s*\/>/.test(code) &&
    !/Router/.test(code)
  )
}

const SKIP_NOTES: Record<NonNullable<RouterSeedSkip>, string> = {
  start: `TanStack Start app — no router seeds written; ${START_PROVIDER_HINT}.`,
  'code-routed': CODE_ROUTED_NOTE,
  'shell-less': SHELL_LESS_NOTE,
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

  const skip =
    routerSeedSkip(ctx.root, app.rel) ??
    (readBasaltConfig(app.dir).shell === false ? 'shell-less' : null)
  ctx.routerPlugin = skip === null || skip === 'shell-less'
  if (skip !== null) return say(`skipped the router seeds: ${SKIP_NOTES[skip]}`)

  const name = appName(ctx.root).replace(/[\\']/g, '\\$&')
  for (const [seed, tpl] of Object.entries(ROUTER_SEED_TEMPLATES)) {
    const dest = routerSeedDest(app.rel, seed as keyof typeof ROUTER_SEED_TEMPLATES)
    const template = readIfExists(resolve(ctx.pkgRoot, 'agent/templates', tpl))
    if (template === null) {
      ctx.problems.push(`${ctx.pkgRoot} ships no ${tpl}`)
      continue
    }
    const text = template.replaceAll('{{APP_NAME}}', () => name)
    const existing = readIfExists(resolve(ctx.root, dest))
    if (existing === null) {
      writeText(ctx.root, dest, text)
      say(`wrote ${dest}`)
    } else if (seed === 'main' && isStockViteMain(existing)) {
      writeText(ctx.root, dest, text)
      say(`${dest}: replaced create-vite's entry with the router entry`)
    } else if (existing === text) {
      say(`kept ${dest}: already the seed`)
    } else if (seed === 'main') {
      say(`kept ${dest}: it exists and is not create-vite's entry`)
      ctx.todo.push(`make ${dest} mount the router; the seed is:\n${text}`)
    } else {
      say(`kept ${dest}: it exists`)
    }
  }
}
