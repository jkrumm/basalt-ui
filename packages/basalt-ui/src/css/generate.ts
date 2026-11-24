/**
 * Renders the eight committed CSS entries (`tokens`, `typography`, `prose`, `fonts`, `tailwind`, `static`,
 * `starlight`, `archify`) from
 * the token table. Pure and deterministic: no clock, no environment. The provenance version is the
 * fixed contract major, so a release bump never dirties a committed file.
 *
 * `bun packages/basalt-ui/src/css/generate.ts` writes the files; `--check` exits 1 on drift.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { emitTokensCss, provenanceHeader } from '../tokens/emit'
import { bridgeEntries, resolveTokens } from '../tokens/table'
import { MOTION_ENTER_FROM } from '../tokens/motion'
import type { MotionPresetName } from '../tokens/motion'

export type CssFileName =
  | 'tokens.css'
  | 'typography.css'
  | 'prose.css'
  | 'fonts.css'
  | 'tailwind.css'
  | 'static.css'
  | 'starlight.css'
  | 'archify.css'

const CONTRACT_VERSION = '3.0.0'
const COMMAND = 'bun packages/basalt-ui/src/css/generate.ts'

const header = (): string => provenanceHeader(CONTRACT_VERSION, COMMAND)

const decl = (name: string, value: string): string => `  ${name}: ${value};\n`
const rule = (selector: string, body: string): string => `${selector} {\n${body}}\n`

// ── fonts.css, typography.css ───────────────────────────────────────────────────────────────────

const template = (name: 'fonts' | 'typography' | 'prose' | 'starlight'): string =>
  readFileSync(join(import.meta.dir, 'templates', `${name}.css`), 'utf8')

const fontsCss = (): string => header() + template('fonts')

/** The seven rungs' size and line height, straight from the table, then the static base. */
function typographyCss(): string {
  const vars = resolveTokens()
    .filter(({ def }) => def.family === 'type' && def.name.startsWith('text-'))
    .map(({ def, value }) => decl(`--basalt-${def.name}`, String(value)))
    .join('')
  const scale = `@layer basalt.type {\n${rule(':where(:root)', vars).replace(/^(?=.)/gm, '  ')}}\n`
  const motion = `@layer basalt.type {\n${indent(ENTER_KEYFRAMES)}}\n`
  return header() + scale + template('typography') + motion
}

// ── motion presets ──────────────────────────────────────────────────────────────────────────────

/**
 * The enter presets as CSS: each preset's keyframes start where `MOTION_ENTER_FROM` says and end on the
 * element's own style (`both` fill), and each animation reads the motion tokens. The keyframes exist only
 * under `prefers-reduced-motion: no-preference`: under reduce the name resolves to nothing, so no
 * animation is created at all (a 0 ms one with `both` fill would stay in `getAnimations()`) and the
 * element renders in its end state. A page without Tailwind writes the animation itself:
 * `animation: basalt-enter-item var(--basalt-dur-base) var(--basalt-ease-enter) both`.
 */
export const ENTER_ANIMATIONS: Readonly<Record<MotionPresetName, string>> = {
  overlay: 'basalt-enter-overlay var(--basalt-dur-fast) var(--basalt-ease-enter) both',
  item: 'basalt-enter-item var(--basalt-dur-base) var(--basalt-ease-enter) both',
  card: 'basalt-enter-card var(--basalt-spring) both',
}

function enterTransform(name: MotionPresetName): string {
  const { y, scale } = MOTION_ENTER_FROM[name]
  const parts = [y === 0 ? '' : `translateY(${y}px)`, scale === 1 ? '' : `scale(${scale})`]
  return parts.filter(Boolean).join(' ')
}

const indent = (css: string): string => css.replace(/^(?=.)/gm, '  ')

export const ENTER_KEYFRAMES =
  '@media (prefers-reduced-motion: no-preference) {\n' +
  indent(
    (Object.keys(MOTION_ENTER_FROM) as MotionPresetName[])
      .map(
        (name) =>
          `@keyframes basalt-enter-${name} {\n  from {\n    opacity: ${MOTION_ENTER_FROM[name].opacity};\n    transform: ${enterTransform(name)};\n  }\n}\n`,
      )
      .join(''),
  ) +
  '}\n'

/** A staggered item's delay: `--i` (its index) steps of `--basalt-stagger`, at most `--basalt-dur-slow`. */
const STAGGER_DELAY = 'min(calc(var(--i, 0) * var(--basalt-stagger)), var(--basalt-dur-slow))'

// ── prose.css ───────────────────────────────────────────────────────────────────────────────────

const proseCss = (): string => header() + template('prose')

// ── tailwind.css ────────────────────────────────────────────────────────────────────────────────

const block = (at: string, lines: readonly string[]): string =>
  `${at} {\n${lines.map((l) => `  ${l};\n`).join('')}}\n`

const RESETS = ['color', 'shadow', 'radius', 'text', 'breakpoint'] as const

const SURFACES = ['canvas', 'card', 'inset', 'raised'] as const

/**
 * A mark a page draws through `useChartFocus` (`focus.item(i)` sets `data-chart-mark`) dims as the
 * kit's own marks do: the number is `DIMMED` in `charts/core/theme.ts`, and a charts test holds the
 * two equal. A mark that is not drawn in an svg carries text (a linked row), and ink at half
 * strength reads 3.8:1 on the dark card: it dims to `DIMMED_TEXT` instead, which keeps the text at
 * the 4.5:1 the inks are gated at. The fade is skipped under reduced motion.
 */
const CHART_MARK_DIM = 0.5
const CHART_TEXT_MARK_DIM = 0.7
const chartMarkRules =
  '  /* A mark drawn through useChartFocus dims as the kit marks do (charts/core/theme DIMMED). */\n' +
  `  [data-chart-mark][data-dimmed] {\n    opacity: ${CHART_MARK_DIM};\n  }\n` +
  '  /* A marked row of text keeps its ink readable (charts/core/theme DIMMED_TEXT). */\n' +
  `  [data-chart-mark][data-dimmed]:not(:where(svg *)) {\n    opacity: ${CHART_TEXT_MARK_DIM};\n  }\n` +
  '  @media (prefers-reduced-motion: no-preference) {\n    [data-chart-mark] {\n      transition: opacity var(--basalt-dur-fast) var(--basalt-ease);\n    }\n  }\n'

/** The reading-progress bar's keyframes (`page/article-progress.tsx`): a scroll or view timeline plays them. */
const articleProgressRules =
  '  @keyframes basalt-article-progress {\n    to {\n      transform: scaleX(1);\n    }\n  }\n'

/**
 * Tailwind 4 draws a border with no color utility in currentColor, so a page's bare `border-b`,
 * `divide-y` or `border` painted full ink while every kit part (which names `border-border`) drew
 * the hairline. The default is the hairline token, in the `basalt` layer: after preflight, before
 * every utility, so a named color and a kit part still win. `outline` and `ring` stay currentColor
 * on purpose: they mark focus, where ink is the safe default (`focus-ring` names brand itself).
 */
const borderRules =
  '  /* A border with no color utility is the hairline, not ink (Tailwind 4 defaults to currentColor). */\n' +
  '  *,\n  ::after,\n  ::before,\n  ::backdrop,\n  ::file-selector-button {\n    border-color: var(--basalt-hairline);\n  }\n'

/**
 * The `@source` lines of `static.css`: the `basalt-ui/static` parts and the modules they take
 * classes from (the prose sheet's component, `Alert`, `Table`). Paths are relative to the sheet, so they resolve from `src/css` and from `dist/css`.
 */
const STATIC_SOURCES = [
  '../static',
  '../page/prose.{js,tsx}',
  '../ui/alert.{js,tsx}',
  '../ui/table.{js,tsx}',
] as const

/**
 * `tailwind.css` and `static.css` share every rule; they differ in their imports. `tailwind.css`
 * carries basalt's own `@font-face` faces; `static.css` leaves the faces to the host (the Astro
 * Fonts API through `basalt-ui/astro`), adds the prose sheet and the `@source` lines of the
 * static parts, so a site needs one import.
 */
function tailwindCss(variant: 'app' | 'static' = 'app'): string {
  const imports =
    variant === 'app'
      ? "@import './fonts.css';\n@import './touch.css' layer(basalt);\n"
      : "@import './prose.css';\n@import './touch.css' layer(basalt);\n" +
        STATIC_SOURCES.map((s) => `@source '${s}';\n`).join('')
  const entries = bridgeEntries()
  const colors = entries.filter((e) => e.tw.startsWith('--color-'))
  const others = entries.filter((e) => !e.tw.startsWith('--color-'))

  const utilities = [
    ['h-ctl', ['height: var(--basalt-ctl-h)']],
    ['size-ctl', ['width: var(--basalt-ctl-h)', 'height: var(--basalt-ctl-h)']],
    ['min-h-ctl', ['min-height: var(--basalt-ctl-h)']],
    ['min-h-row', ['min-height: var(--basalt-row-h)']],
    ['size-icon', ['width: var(--basalt-icon)', 'height: var(--basalt-icon)']],
    // Hubot Sans at 88% stretch draws a word space of ~0.15em; with tracking-tight a heading reads as one word.
    ['word-head', ['word-spacing: 0.12em']],
    // `animate-enter-item stagger` with `style={{ '--i': index }}`: the CSS twin of `staggerDelay(index)`.
    ['stagger', [`animation-delay: ${STAGGER_DELAY}`, `transition-delay: ${STAGGER_DELAY}`]],
  ] as const
  const utilityCss = utilities.map(([name, lines]) => block(`@utility ${name}`, lines)).join('')
  const focusRing =
    '@utility focus-ring {\n  /* Focus scrolls the element flush to its scrollport; the margin keeps the 2px ring + 2px offset in view. */\n  scroll-margin: 4px;\n  &:focus-visible {\n    outline: 2px solid var(--basalt-brand);\n    outline-offset: 2px;\n  }\n}\n'
  const link = '@utility link {\n  color: var(--basalt-brand);\n  text-underline-offset: 2px;\n}\n'

  const surfaceRules = SURFACES.map(
    (s) => `  [data-surface='${s}'] {\n    --basalt-surface: var(--basalt-${s});\n  }\n`,
  ).join('')

  const base =
    '@layer basalt {\n' +
    borderRules +
    surfaceRules +
    '  @media (forced-colors: active) {\n    [data-surface] {\n      border: 1px solid CanvasText;\n    }\n  }\n' +
    '  input:-webkit-autofill,\n  textarea:-webkit-autofill,\n  select:-webkit-autofill {\n' +
    '    -webkit-box-shadow: 0 0 0 100vh var(--basalt-surface) inset;\n' +
    '    -webkit-text-fill-color: var(--basalt-ink);\n' +
    '    caret-color: var(--basalt-ink);\n' +
    '  }\n' +
    chartMarkRules +
    articleProgressRules +
    indent(ENTER_KEYFRAMES) +
    '}\n'

  return (
    header() +
    '@layer theme, base, basalt, components, utilities;\n' +
    "@import 'tailwindcss';\n" +
    "@import './tokens.css' layer(theme);\n" +
    imports +
    '@custom-variant dark {\n' +
    "  &:where([data-theme='dark'], [data-theme='dark'] *) {\n    @slot;\n  }\n" +
    '  @media (prefers-color-scheme: dark) {\n' +
    '    &:where(:root:not([data-theme]), :root:not([data-theme]) *) {\n      @slot;\n    }\n  }\n' +
    '}\n' +
    block(
      '@theme',
      RESETS.map((r) => `--${r}-*: initial`),
    ) +
    block(
      '@theme inline',
      colors.map((e) => `${e.tw}: ${e.value}`),
    ) +
    block('@theme', [
      '--spacing: 0.25rem',
      '--breakpoint-md: 840px',
      '--breakpoint-xl: 1200px',
      '--container-narrow: 15rem',
      '--container-regular: 30rem',
      '--container-wide: 50rem',
    ]) +
    block(
      '@theme inline',
      others.map((e) => `${e.tw}: ${e.value}`),
    ) +
    block(
      '@theme inline',
      (Object.keys(ENTER_ANIMATIONS) as MotionPresetName[]).map(
        (name) => `--animate-enter-${name}: ${ENTER_ANIMATIONS[name]}`,
      ),
    ) +
    utilityCss +
    focusRing +
    link +
    base
  )
}

// ── archify.css ─────────────────────────────────────────────────────────────────────────────────

/**
 * The 32 variables archify's own `classic` theme block sets, each read from a token. A category's
 * stroke is its token and its fill is the same token at the kit's status tint (`--basalt-tint-pct`:
 * 12 % light, 16 % dark). No `[data-theme]` pair and no hex: the tokens already switch per scheme and
 * a `var()` resolves on the element, so the diagram follows the page. Unlayered on purpose: archify's
 * own theme blocks are unlayered and an unlayered rule out-ranks a layered one whatever the order.
 */
export const ARCHIFY_CATEGORIES = [
  ['frontend', 'chart-1'],
  ['backend', 'chart-3'],
  ['database', 'chart-4'],
  ['cloud', 'chart-2'],
  ['messagebus', 'chart-5'],
  ['security', 'bad'],
  ['external', 'line'],
] as const

export const ARCHIFY_VARS: Readonly<Record<string, string>> = {
  '--bg': 'var(--basalt-surface)',
  '--mask': 'var(--basalt-surface)',
  '--grid': 'var(--basalt-grid)',
  '--text': 'var(--basalt-ink)',
  '--text-muted': 'var(--basalt-ink-muted)',
  '--text-dim': 'var(--basalt-ink-faint)',
  '--text-faint': 'var(--basalt-ink-faint)',
  '--panel': 'var(--basalt-card)',
  '--panel-border': 'var(--basalt-hairline)',
  '--lane-fill': 'var(--basalt-hover)',
  '--lane-stroke': 'var(--basalt-dim-bar)',
  '--arrow': 'var(--basalt-line)',
  '--arrow-emphasis': 'var(--basalt-brand)',
  ...Object.fromEntries(
    ARCHIFY_CATEGORIES.flatMap(([name, token]) => [
      [
        `--${name}-fill`,
        `color-mix(in srgb, var(--basalt-${token}) var(--basalt-tint-pct), transparent)`,
      ],
      [`--${name}-stroke`, `var(--basalt-${token})`],
    ]),
  ),
  '--toolbar-bg': 'var(--basalt-raised)',
  '--toolbar-border': 'var(--basalt-hairline)',
  '--toolbar-text': 'var(--basalt-ink)',
  '--toolbar-hover': 'var(--basalt-hover)',
  '--toolbar-menu-bg': 'var(--basalt-raised)',
}

const archifyCss = (): string =>
  header() +
  '/* An archify diagram: put data-preset="basalt" on the svg or its wrapper, with tokens.css loaded. */\n' +
  rule(
    "[data-preset='basalt']",
    Object.entries(ARCHIFY_VARS)
      .map(([name, value]) => decl(name, value))
      .join(''),
  )

// ── entry ───────────────────────────────────────────────────────────────────────────────────────

const staticCss = (): string => tailwindCss('static')

const starlightCss = (): string => header() + template('starlight')

/** The eight CSS entries, byte for byte as committed. */
export function generateCss(): Record<CssFileName, string> {
  return {
    'archify.css': archifyCss(),
    'tokens.css': emitTokensCss({ version: CONTRACT_VERSION }),
    'typography.css': typographyCss(),
    'prose.css': proseCss(),
    'fonts.css': fontsCss(),
    'tailwind.css': tailwindCss(),
    'static.css': staticCss(),
    'starlight.css': starlightCss(),
  }
}

if (import.meta.main) {
  const check = process.argv.includes('--check')
  const dir = import.meta.dir
  let drifted = false
  for (const [name, css] of Object.entries(generateCss())) {
    const path = join(dir, name)
    if (!check) {
      writeFileSync(path, css)
      continue
    }
    if (readFileSync(path, 'utf8') === css) continue
    console.error(`drift: ${name} differs from the generator; run \`${COMMAND}\``)
    drifted = true
  }
  if (drifted) process.exit(1)
}
