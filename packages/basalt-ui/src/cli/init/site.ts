/**
 * `init --profile site`: the Astro wiring of a stock project. `basaltAstro()` goes after `react()` in
 * `astro.config.*`, so the integration owns Tailwind, the sheet with the site's `@source` lines
 * (`.basalt/sources.css`) and the head scripts; the layout template gives the pages the faces.
 */

/** The config files Astro reads, in its own order. */
export const ASTRO_CONFIGS = [
  'astro.config.mjs',
  'astro.config.ts',
  'astro.config.mts',
  'astro.config.js',
  'astro.config.cjs',
] as const

export const SITE_LAYOUT_TEMPLATE = 'agent/templates/site-layout.astro.tpl'
export const SITE_LAYOUT = 'src/layouts/Layout.astro'

const BASALT_ASTRO_IMPORT = "import { basaltAstro } from 'basalt-ui/astro'"
const REACT_IMPORT = "import react from '@astrojs/react'"
/** A whole import statement, one line or wrapped: through its `from '…'` (or bare specifier) and `;`. */
const IMPORT_STATEMENT = /^import\b(?:[^'"]*?\bfrom\s*)?['"][^'"\n]+['"];?[ \t]*\n/gm

function withImport(text: string, line: string): string {
  const last = [...text.matchAll(IMPORT_STATEMENT)].at(-1)
  if (last === undefined) return `${line}\n${text}`
  const at = (last.index ?? 0) + last[0].length
  return `${text.slice(0, at)}${line}\n${text.slice(at)}`
}

/**
 * The config with `basaltAstro()` right after `react()`, or null when the shape is not stock: a
 * config that already has it comes back as it is; one with `integrations` but no `react()`, or no
 * `defineConfig({`, is left to a printed to-do.
 */
export function patchAstroConfig(text: string): string | null {
  if (/\bbasaltAstro\s*\(/.test(text)) return text
  const react = /\breact\(\s*(?:\{[^()]*\})?\s*\)/.exec(text)
  if (react !== null) {
    const at = react.index + react[0].length
    return withImport(`${text.slice(0, at)}, basaltAstro()${text.slice(at)}`, BASALT_ASTRO_IMPORT)
  }
  if (/\bintegrations\s*:/.test(text)) return null
  const config = /defineConfig\(\s*\{/.exec(text)
  if (config === null) return null
  const at = config.index + config[0].length
  const entry = '\n  integrations: [react(), basaltAstro()],'
  const rest = text.slice(at)
  const empty = /^\s*\}/.exec(rest)
  const patched =
    empty === null
      ? `${text.slice(0, at)}${entry}${rest}`
      : `${text.slice(0, at)}${entry}\n}${rest.slice(empty[0].length)}`
  const imported = text.includes("from '@astrojs/react'") || text.includes('from "@astrojs/react"')
  return withImport(imported ? patched : withImport(patched, REACT_IMPORT), BASALT_ASTRO_IMPORT)
}
