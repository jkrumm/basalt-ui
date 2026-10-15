/**
 * vite-boot.ts — the anti-FOUC boot subsystem of `basaltAppPlugin`: the unlayered `<style>` that
 * paints the page before any stylesheet lands, and the tiny inline script that makes that paint
 * follow the scheme the user last stored.
 *
 * Internal to the `./vite` subpath only — deliberately NOT re-exported from `vite.ts`.
 */
import type { HtmlTagDescriptor } from 'vite'

/**
 * The selector every anti-FOUC declaration is scoped to.
 *
 * The rule paints the page before any stylesheet lands, so it is UNLAYERED by construction — and an
 * unlayered declaration outranks every layered one regardless of specificity. Through 1.20.0 that
 * meant a flat `html{color-scheme:dark}` permanently beat Mantine's own
 * `@layer mantine{:root{color-scheme:var(--mantine-color-scheme)}}`: a light-scheme consumer got
 * dark scrollbars, dark `<select>` popups and dark date pickers forever, with no opt-out (found
 * independently by two consumers).
 *
 * `MantineProvider` writes `data-mantine-color-scheme` onto `<html>` as soon as it mounts, so
 * scoping the boot rule to its ABSENCE makes it expire exactly when the real theme exists — which
 * is the anti-FOUC contract stated honestly. A cascade layer would also work in principle and is
 * deliberately NOT used: a layer's position is fixed by where its name is first encountered, and in
 * dev Mantine's CSS is injected by JS after this `<style>` is already in the document, so the layer
 * order would depend on bundler mode. Selector scoping depends on nothing.
 */
const BOOT_SCOPE = 'html:not([data-mantine-color-scheme])'

/** Boot-only attribute `BOOT_SCRIPT` sets; never `data-mantine-color-scheme`, which would expire the rule. */
const BOOT_ATTRIBUTE = 'data-basalt-boot'

/** Mantine's default `localStorageColorSchemeManager` key — BasaltProvider installs no manager of its own. */
const BOOT_STORAGE_KEY = 'mantine-color-scheme-value'

/**
 * Stored value is Mantine's raw `light` | `dark` | `auto` string; `auto` resolves through
 * `prefers-color-scheme`. A throwing or empty store, or a missing `matchMedia`, leaves the
 * attribute off. IIFE + `let`: a classic inline script shares the page's global scope.
 */
const BOOT_SCRIPT =
  '(function(){try{' +
  `let v=localStorage.getItem('${BOOT_STORAGE_KEY}');` +
  "if(v==='auto')v=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';" +
  `if(v==='light'||v==='dark')document.documentElement.setAttribute('${BOOT_ATTRIBUTE}',v)` +
  '}catch(e){}})()'

/** The `color-scheme` value each boot mode declares. `false` declares none. */
const BOOT_COLOR_SCHEME = { dark: 'dark', light: 'light', auto: 'light dark' } as const

/** The `colorScheme` option: which scheme the boot paint assumes; `false` declares no `color-scheme`. */
export type BootColorScheme = 'dark' | 'light' | 'auto' | false

type BootInput = {
  colorScheme: BootColorScheme
  themeColor: { light: string; dark: string }
  backgroundColor: string
  explicitBackground: boolean
  /** Inject the stored-scheme script and the variant rules it drives. */
  bootScript: boolean
}

/**
 * The base rule: paint the surface (and, unless opted out, tell the UA which native-control palette
 * to use) for the frames between first paint and Mantine's stylesheet.
 *
 * `'auto'` with no explicit `backgroundColor` emits a `prefers-color-scheme` pair so the pre-boot
 * paint follows the OS the same way `color-scheme: light dark` does; an explicit `backgroundColor`
 * is used verbatim for both, since the consumer has named one color on purpose.
 */
function buildBaseBootStyle(input: BootInput): string {
  const { colorScheme, themeColor, backgroundColor, explicitBackground } = input

  if (colorScheme === false) return `${BOOT_SCOPE}{background-color:${backgroundColor}}`

  const scheme = BOOT_COLOR_SCHEME[colorScheme]
  if (colorScheme !== 'auto' || explicitBackground) {
    return `${BOOT_SCOPE}{background-color:${backgroundColor};color-scheme:${scheme}}`
  }
  return (
    `${BOOT_SCOPE}{background-color:${themeColor.light};color-scheme:${scheme}}` +
    `@media(prefers-color-scheme:dark){${BOOT_SCOPE}{background-color:${themeColor.dark}}}`
  )
}

function buildBootStyle(input: BootInput): string {
  const { colorScheme, themeColor, explicitBackground, bootScript } = input
  const base = buildBaseBootStyle(input)
  if (!bootScript) return base

  // Stored-scheme variants: keyed off the attribute BOOT_SCRIPT sets, still inside BOOT_SCOPE so
  // they expire with the rest. The extra attribute outranks the base rule and its `auto` media pair.
  // An explicit backgroundColor is the consumer's one chosen color — only `color-scheme` follows.
  const variants = (['light', 'dark'] as const).map((scheme) => {
    const declarations = [
      ...(explicitBackground ? [] : [`background-color:${themeColor[scheme]}`]),
      ...(colorScheme === false ? [] : [`color-scheme:${scheme}`]),
    ]
    if (declarations.length === 0) return ''
    return `${BOOT_SCOPE}[${BOOT_ATTRIBUTE}=${scheme}]{${declarations.join(';')}}`
  })
  return base + variants.join('')
}

/** The boot `<style>`, then (unless `bootScript: false`) the script — adjacent, head-prepend. */
export function buildBootTags(input: BootInput): HtmlTagDescriptor[] {
  const tags: HtmlTagDescriptor[] = [{ tag: 'style', children: buildBootStyle(input) }]
  if (input.bootScript) tags.push({ tag: 'script', children: BOOT_SCRIPT })
  return tags
}
