/**
 * The `init` step that registers the edit-time loop: the managed shim at `.basalt/hook.mjs` and the
 * three hook entries in `.claude/settings.json` (skills-agent-layer 4.2). Registered from
 * `init/steps.ts`. Both writes are idempotent; an unparseable `settings.json` is left alone and the
 * entries are printed for the owner to place.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { Ctx } from '../init/steps'
import { readIfExists } from '../source-text'
import { hooksObject, mergeSettings, SETTINGS_PATH, SHIM } from './settings'

function writeIfChanged(root: string, rel: string, text: string): boolean {
  const abs = resolve(root, rel)
  if (readIfExists(abs) === text) return false
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text)
  return true
}

/** A `tokens` install runs no lint, so it registers no hook. */
export function installHook(ctx: Ctx): void {
  if (ctx.args.profile === 'tokens') return
  const shim = readIfExists(resolve(ctx.pkgRoot, 'agent/templates/hook.mjs.tpl'))
  if (shim === null)
    return void ctx.problems.push(`${ctx.pkgRoot} ships no agent/templates/hook.mjs.tpl`)
  if (writeIfChanged(ctx.root, SHIM, shim)) console.log(`wrote ${SHIM}`)

  const merged = mergeSettings(readIfExists(resolve(ctx.root, SETTINGS_PATH)))
  if ('error' in merged) {
    const entries = JSON.stringify({ hooks: hooksObject() }, null, 2)
    return void ctx.todo.push(
      `${merged.error}; merge these hook entries into it by hand:\n${entries}`,
    )
  }
  if (writeIfChanged(ctx.root, SETTINGS_PATH, merged.text)) {
    console.log(`${SETTINGS_PATH}: registered the basalt hook entries`)
  }
}
