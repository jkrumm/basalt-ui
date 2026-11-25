/**
 * The Shiki setup a plain Astro site (no Starlight) needs for code that follows the scheme. Astro writes
 * each token with both themes' colors as custom properties (`--shiki-light`, `--shiki-dark`) and no color
 * of its own; `basalt-ui/prose.css` picks one by the scheme attribute and the system scheme.
 */

/** The shape of Astro's `markdown.shikiConfig` this export fills. */
export type BasaltShikiConfig = {
  themes: { light: string; dark: string }
  defaultColor: false
  wrap: boolean
}

/**
 * Astro's `markdown.shikiConfig` for basalt: a light and a dark theme, both written as custom
 * properties, so the page's scheme decides which one a block shows with no script and no repaint.
 *
 * @useWhen an Astro site highlights fenced code with Astro's own Shiki and renders it in basalt's prose
 * @neverWhen the site is Starlight, whose expressive-code highlights the code (see `themeCssSelector` in docs/astro.md)
 *
 * @example
 * import { basaltShiki } from 'basalt-ui/astro'
 * export default defineConfig({ markdown: { shikiConfig: basaltShiki } })
 */
export const basaltShiki: BasaltShikiConfig = {
  themes: { light: 'github-light-high-contrast', dark: 'github-dark' },
  defaultColor: false,
  wrap: false,
}
