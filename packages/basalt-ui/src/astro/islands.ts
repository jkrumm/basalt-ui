/**
 * The island check `basaltAstro()` runs at `astro:build:done`: a part whose `interaction` is
 * `required` (`ASTRO_PARTS`) renders dead without JavaScript, so its markup outside an
 * `<astro-island>` fails the build. A part is found by its `data-slot`: the part id or a slot that
 * starts with it (`dialog-trigger` is the dialog).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { ASTRO_PARTS } from './parts'
import type { AstroPart } from './parts'

/** The build checks the integration runs; a rule bullet names one as `[build:<id>]`. */
export const ASTRO_BUILD_CHECKS = ['island-directive'] as const

export type DeadIsland = { page: string; part: AstroPart; slot: string }

const REQUIRED = ASTRO_PARTS.filter((p) => p.interaction === 'required')

/** The required part a `data-slot` belongs to, or undefined. The longest id wins (`alert-dialog` over `dialog`). */
export function requiredPartOf(slot: string): AstroPart | undefined {
  return REQUIRED.filter((p) => slot === p.id || slot.startsWith(`${p.id}-`)).toSorted(
    (a, b) => b.id.length - a.id.length,
  )[0]
}

const TAG = /<(\/?)([a-zA-Z][\w:-]*)([^>]*)>/g
const SLOT = /\sdata-slot=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/

/** Every required part in `html` that sits outside an `<astro-island>`, once per part. */
export function deadSlots(html: string): { part: AstroPart; slot: string }[] {
  const found = new Map<string, { part: AstroPart; slot: string }>()
  let depth = 0
  for (const [, close, name = '', attrs = ''] of html.matchAll(TAG)) {
    if (name === 'astro-island') {
      if (close === '/') depth = Math.max(0, depth - 1)
      else if (!attrs.trimEnd().endsWith('/')) depth++
      continue
    }
    if (close === '/' || depth > 0) continue
    const match = SLOT.exec(attrs)
    const slot = match?.[1] ?? match?.[2] ?? match?.[3]
    const part = slot === undefined ? undefined : requiredPartOf(slot)
    if (part !== undefined && slot !== undefined && !found.has(part.id))
      found.set(part.id, { part, slot })
  }
  return [...found.values()]
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir)
    .toSorted()
    .flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return htmlFiles(path)
      return name.endsWith('.html') ? [path] : []
    })
}

/** Every dead island in the built site under `outDir`, by page. */
export function deadIslands(outDir: string): DeadIsland[] {
  return htmlFiles(outDir).flatMap((file) => {
    const page = `/${relative(outDir, file).split(sep).join('/')}`
    return deadSlots(readFileSync(file, 'utf8')).map((hit) => ({ page, ...hit }))
  })
}

/** The build error: each part, its page, and the fix. */
export function deadIslandMessage(dead: readonly DeadIsland[]): string {
  const lines = dead.map(
    ({ page, part, slot }) => `  ${part.covers[0] ?? part.id} (data-slot="${slot}") on ${page}`,
  )
  return [
    `basalt-ui: ${dead.length} part(s) that need JavaScript render outside an island, so they would ship dead:`,
    ...lines,
    'Fix: render the part inside a React component of your own (src/islands/<Name>.tsx) and place that',
    'with a client directive, <Name client:visible /> (client:idle above the fold, client:load for a first tap).',
    'Which parts need one: ASTRO_PARTS from basalt-ui/astro, interaction "required".',
  ].join('\n')
}
