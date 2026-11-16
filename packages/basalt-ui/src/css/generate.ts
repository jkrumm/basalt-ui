/**
 * Renders the five committed CSS entries (`tokens`, `typography`, `prose`, `fonts`, `tailwind`) from
 * the token table. Pure and deterministic: no clock, no environment. The provenance version is the
 * fixed contract major, so a release bump never dirties a committed file.
 *
 * `bun packages/basalt-ui/src/css/generate.ts` writes the files; `--check` exits 1 on drift.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { emitTokensCss, provenanceHeader } from '../tokens/emit'
import { bridgeEntries, resolveTokens } from '../tokens/table'

export type CssFileName =
  | 'tokens.css'
  | 'typography.css'
  | 'prose.css'
  | 'fonts.css'
  | 'tailwind.css'

const CONTRACT_VERSION = '3.0.0'
const COMMAND = 'bun packages/basalt-ui/src/css/generate.ts'

const header = (): string => provenanceHeader(CONTRACT_VERSION, COMMAND)

const decl = (name: string, value: string): string => `  ${name}: ${value};\n`
const rule = (selector: string, body: string): string => `${selector} {\n${body}}\n`

// ── fonts.css, typography.css ───────────────────────────────────────────────────────────────────

const template = (name: 'fonts' | 'typography' | 'prose'): string =>
  readFileSync(join(import.meta.dir, 'templates', `${name}.css`), 'utf8')

const fontsCss = (): string => header() + template('fonts')

/** The seven rungs' size and line height, straight from the table, then the static base. */
function typographyCss(): string {
  const vars = resolveTokens()
    .filter(({ def }) => def.family === 'type' && def.name.startsWith('text-'))
    .map(({ def, value }) => decl(`--basalt-${def.name}`, String(value)))
    .join('')
  const scale = `@layer basalt.type {\n${rule(':where(:root)', vars).replace(/^(?=.)/gm, '  ')}}\n`
  return header() + scale + template('typography')
}

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
  '  @media (prefers-reduced-motion: no-preference) {\n    [data-chart-mark] {\n      transition: opacity 120ms ease-out;\n    }\n  }\n'

/** The reading-progress bar's keyframes (`page/article-progress.tsx`): a scroll or view timeline plays them. */
const articleProgressRules =
  '  @keyframes basalt-article-progress {\n    to {\n      transform: scaleX(1);\n    }\n  }\n'

function tailwindCss(): string {
  const entries = bridgeEntries()
  const colours = entries.filter((e) => e.tw.startsWith('--color-'))
  const others = entries.filter((e) => !e.tw.startsWith('--color-'))

  const utilities = [
    ['h-ctl', ['height: var(--basalt-ctl-h)']],
    ['size-ctl', ['width: var(--basalt-ctl-h)', 'height: var(--basalt-ctl-h)']],
    ['min-h-ctl', ['min-height: var(--basalt-ctl-h)']],
    ['min-h-row', ['min-height: var(--basalt-row-h)']],
    ['size-icon', ['width: var(--basalt-icon)', 'height: var(--basalt-icon)']],
    // Hubot Sans at 88% stretch draws a word space of ~0.15em; with tracking-tight a heading reads as one word.
    ['word-head', ['word-spacing: 0.12em']],
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
    surfaceRules +
    '  @media (forced-colors: active) {\n    [data-surface] {\n      border: 1px solid CanvasText;\n    }\n  }\n' +
    '  input:-webkit-autofill,\n  textarea:-webkit-autofill,\n  select:-webkit-autofill {\n' +
    '    -webkit-box-shadow: 0 0 0 100vh var(--basalt-surface) inset;\n' +
    '    -webkit-text-fill-color: var(--basalt-ink);\n' +
    '    caret-color: var(--basalt-ink);\n' +
    '  }\n' +
    '  @media (pointer: coarse) {\n    input,\n    select,\n    textarea {\n      font-size: max(16px, 1em) !important;\n    }\n  }\n' +
    chartMarkRules +
    articleProgressRules +
    '}\n'

  return (
    header() +
    '@layer theme, base, basalt, components, utilities;\n' +
    "@import 'tailwindcss';\n" +
    "@import './tokens.css' layer(theme);\n" +
    "@import './fonts.css';\n" +
    "@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));\n" +
    block(
      '@theme',
      RESETS.map((r) => `--${r}-*: initial`),
    ) +
    block(
      '@theme inline',
      colours.map((e) => `${e.tw}: ${e.value}`),
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
    utilityCss +
    focusRing +
    link +
    base
  )
}

// ── entry ───────────────────────────────────────────────────────────────────────────────────────

/** The five CSS entries, byte for byte as committed. */
export function generateCss(): Record<CssFileName, string> {
  return {
    'tokens.css': emitTokensCss({ version: CONTRACT_VERSION }),
    'typography.css': typographyCss(),
    'prose.css': proseCss(),
    'fonts.css': fontsCss(),
    'tailwind.css': tailwindCss(),
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
