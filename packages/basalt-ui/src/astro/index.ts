/**
 * `basalt-ui/astro`: the Astro integration of the site profile. One line of `astro.config`
 * (`integrations: [react(), basaltAstro()]`) wires Tailwind 4 (`@tailwindcss/vite`), the
 * `basalt-ui/static.css` sheet on every page, the three basalt faces through the Astro Fonts API and
 * the two inline head scripts: the scheme first, then the static parts' listeners. The faces still
 * need `<BasaltFonts />` from `basalt-ui/astro/BasaltFonts.astro` in the layout's head: Astro emits a
 * face only where its font component renders. The parts themselves are `basalt-ui/static`.
 *
 * It also writes `.basalt/sources.css` (the sheet with the `@source` lines of the closure the site's
 * basalt imports reach, as the Vite plugin computes it) and, when the build is done, fails it on a part that needs JavaScript rendered
 * outside an island (`ASTRO_PARTS`, `interaction: 'required'`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { themeScript } from '../css/theme-script'
import type { ThemeScriptOptions } from '../css/theme-script'
import { siteScript } from '../static/site-script'
import { installedPackage } from '../vite/graph'
import { SOURCES_PATH } from '../vite/sources'
import { deadIslandMessage, deadIslands } from './islands'
import { renderSiteSources, siteImports } from './sources'

export { ASTRO_PARTS } from './parts'
export type { AstroPart } from './parts'
export type { IslandMessages } from './mdx/messages'

/** The slice of Astro's `astro:config:setup` hook this integration calls; typed here so basalt needs no `astro` dependency. */
export type AstroSetupHook = (options: {
  config: { root: URL }
  updateConfig: (config: Record<string, unknown>) => unknown
  injectScript: (stage: 'head-inline' | 'page-ssr', content: string) => void
}) => void | Promise<void>

/** The slice of Astro's `astro:build:done` hook this integration reads: the output directory. */
export type AstroBuildDoneHook = (options: { dir: URL }) => void | Promise<void>

/** The integration object Astro reads from `integrations`. */
export type BasaltAstroIntegration = {
  name: 'basalt-ui'
  hooks: { 'astro:config:setup': AstroSetupHook; 'astro:build:done': AstroBuildDoneHook }
}

/** The Fontsource subsets the faces load: `latin` and `latin-ext` unless the site names its own. */
export type BasaltFontsOptions = {
  /** Fontsource subset names, such as `['latin', 'cyrillic', 'greek']`. */
  subsets: readonly string[]
}

export type BasaltAstroOptions = {
  /** Scheme options (`basalt-ui/theme-script`): the boot script reads and the theme switch writes the same key, attribute and cookie. */
  scheme?: ThemeScriptOptions
  /**
   * Register basalt's faces with the Astro Fonts API (Fontsource provider). Default `true`; `false`
   * leaves fonts to the site, which then sets `--basalt-font-sans`, `--basalt-font-head` and
   * `--basalt-font-mono` itself. `{ subsets }` loads the faces for the scripts the site writes in.
   */
  fonts?: boolean | BasaltFontsOptions
  /**
   * Write `.basalt/sources.css` and inject it on every page in place of `basalt-ui/static.css`.
   * Default `true`; `false` for a site that imports `basalt-ui/static.css` and lists its sources itself.
   */
  sources?: boolean
}

/** The css token sheets the nearest `.basalt/manifest.json` at or above `root` records, absolute. */
function tokenSheets(root: string): string[] {
  for (let dir = root; ; dir = dirname(dir)) {
    const path = join(dir, '.basalt/manifest.json')
    if (existsSync(path)) {
      const manifest = JSON.parse(readFileSync(path, 'utf8')) as {
        tokens?: { out?: unknown; format?: unknown }[]
      }
      return (manifest.tokens ?? []).flatMap((row) =>
        typeof row.out === 'string' && row.format === 'css' ? [join(dir, row.out)] : [],
      )
    }
    if (existsSync(join(dir, '.git')) || dirname(dir) === dir) return []
  }
}

/** Writes the site's sources sheet when its bytes change; returns its absolute path. */
function writeSiteSources(root: string): string {
  const outFile = join(root, SOURCES_PATH)
  const css = renderSiteSources({
    outFile,
    pkgRoot: installedPackage(root),
    ...siteImports(join(root, 'src')),
    tokenSheets: tokenSheets(root),
  })
  if (!existsSync(outFile) || readFileSync(outFile, 'utf8') !== css) {
    mkdirSync(dirname(outFile), { recursive: true })
    writeFileSync(outFile, css)
  }
  return outFile
}

/** The Fontsource families behind the three font tokens. Variable faces: one weight axis each. */
const BASALT_FONTS = [
  {
    name: 'Nunito Sans',
    cssVariable: '--basalt-font-sans',
    weights: ['200 1000'],
    fallbacks: ['sans-serif'],
  },
  {
    name: 'Hubot Sans',
    cssVariable: '--basalt-font-head',
    weights: ['200 900'],
    fallbacks: ['sans-serif'],
  },
  {
    name: 'JetBrains Mono',
    cssVariable: '--basalt-font-mono',
    weights: ['100 800'],
    fallbacks: ['monospace'],
  },
] as const

type FontProviders = { fontsource: () => unknown }

/**
 * Imports a module as the site resolves it, from the project root: the site's own Astro and its
 * Tailwind plugin, never a copy next to basalt (an isolated install links neither for basalt).
 */
async function fromSite<T>(root: URL, specifier: string): Promise<T> {
  const require = createRequire(new URL('package.json', root))
  return (await import(pathToFileURL(require.resolve(specifier)).href)) as T
}

/**
 * The head scripts, in order: the scheme first (before paint), then the parts' listeners. A content
 * site stamps the scheme only: it has no appearance setter, so the appearance statement would be bytes
 * on every page for nothing.
 */
function headScript(options: BasaltAstroOptions = {}): string {
  return `${themeScript({ ...options.scheme, appearance: false })};${siteScript(options.scheme)}`
}

/**
 * The Astro integration of the `site` profile. Put it after `react()`; do not also add
 * `@tailwindcss/vite` by hand.
 *
 * @useWhen an Astro site renders `basalt-ui/static` parts and wants basalt's CSS, fonts and head scripts
 * @neverWhen the site is a Vite or TanStack Start app (use `basalt()` from `basalt-ui/vite`)
 *
 * @example
 * import react from '@astrojs/react'
 * import { defineConfig } from 'astro/config'
 * import { basaltAstro } from 'basalt-ui/astro'
 *
 * export default defineConfig({ integrations: [react(), basaltAstro()] })
 */
export function basaltAstro(options: BasaltAstroOptions = {}): BasaltAstroIntegration {
  return {
    name: 'basalt-ui',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, injectScript }) => {
        const tailwind = await fromSite<{ default: () => unknown }>(
          config.root,
          '@tailwindcss/vite',
        )
        const plugins = [tailwind.default()]
        if (options.fonts === false) {
          updateConfig({ vite: { plugins } })
        } else {
          const astro = await fromSite<{ fontProviders: FontProviders }>(
            config.root,
            'astro/config',
          )
          const provider = astro.fontProviders.fontsource()
          const fonts = BASALT_FONTS.map((f) => ({
            ...f,
            weights: [...f.weights],
            fallbacks: [...f.fallbacks],
            provider,
            styles: ['normal'],
            subsets:
              typeof options.fonts === 'object'
                ? [...options.fonts.subsets]
                : ['latin', 'latin-ext'],
          }))
          updateConfig({ vite: { plugins }, fonts })
        }
        const sheet =
          options.sources === false
            ? 'basalt-ui/static.css'
            : writeSiteSources(fileURLToPath(config.root)).split('\\').join('/')
        injectScript('page-ssr', `import ${JSON.stringify(sheet)};`)
        injectScript('head-inline', headScript(options))
      },
      'astro:build:done': ({ dir }) => {
        const dead = deadIslands(fileURLToPath(dir))
        if (dead.length > 0) throw new Error(deadIslandMessage(dead))
      },
    },
  }
}
