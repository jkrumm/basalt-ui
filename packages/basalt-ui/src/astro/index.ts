/**
 * `basalt-ui/astro`: the Astro integration of the site profile. One line of `astro.config`
 * (`integrations: [react(), basaltAstro()]`) wires Tailwind 4 (`@tailwindcss/vite`), the
 * `basalt-ui/static.css` sheet on every page, the three basalt faces through the Astro Fonts API and
 * the two inline head scripts: the scheme first, then the static parts' listeners. The faces still
 * need `<BasaltFonts />` from `basalt-ui/astro/BasaltFonts.astro` in the layout's head: Astro emits a
 * face only where its font component renders. The parts themselves are `basalt-ui/static`.
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { themeScript } from '../css/theme-script'
import type { ThemeScriptOptions } from '../css/theme-script'
import { siteScript } from '../static/site-script'

/** The slice of Astro's `astro:config:setup` hook this integration calls; typed here so basalt needs no `astro` dependency. */
export type AstroSetupHook = (options: {
  config: { root: URL }
  updateConfig: (config: Record<string, unknown>) => unknown
  injectScript: (stage: 'head-inline' | 'page-ssr', content: string) => void
}) => void | Promise<void>

/** The integration object Astro reads from `integrations`. */
export type BasaltAstroIntegration = {
  name: 'basalt-ui'
  hooks: { 'astro:config:setup': AstroSetupHook }
}

export type BasaltAstroOptions = {
  /** Scheme options (`basalt-ui/theme-script`): the boot script reads and the theme switch writes the same key, attribute and cookie. */
  scheme?: ThemeScriptOptions
  /**
   * Register basalt's faces with the Astro Fonts API (Fontsource provider). Default `true`; `false`
   * leaves fonts to the site, which then sets `--basalt-font-sans`, `--basalt-font-head` and
   * `--basalt-font-mono` itself.
   */
  fonts?: boolean
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
            subsets: ['latin', 'latin-ext'],
          }))
          updateConfig({ vite: { plugins }, fonts })
        }
        injectScript('page-ssr', 'import "basalt-ui/static.css";')
        injectScript('head-inline', headScript(options))
      },
    },
  }
}
