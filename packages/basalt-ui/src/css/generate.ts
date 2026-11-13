/**
 * Renders the five committed CSS entries (`tokens`, `typography`, `prose`, `fonts`, `tailwind`) from
 * the token table. Pure and deterministic: no clock, no environment. The provenance version is the
 * fixed contract major, so a release bump never dirties a committed file.
 *
 * `bun packages/basalt-ui/src/css/generate.ts` writes the files; `--check` exits 1 on drift.
 */
// theme-allow-file unknown-vx-token — the v3 names are not in the 2.x allowlist `gen-vx-names` builds.
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

/**
 * The provenance header plus a file-level waiver: the 2.x guard (`check-theme`) knows no v3 name
 * and reads these sheets as consumer CSS. `tokens.css` needs none, its header is the guard's own
 * generated-sheet shape; `check-tokens` (tok-t4) judges the rest.
 */
const WAIVER = 'theme-allow' + '-file' // split: the guard reads a literal annotation in this file too
const headerWaiving = (ids: string): string =>
  `${provenanceHeader(CONTRACT_VERSION, COMMAND)}/* ${WAIVER} ${ids} — v3 sheet generated from the token table */\n`

const decl = (name: string, value: string): string => `  ${name}: ${value};\n`
const rule = (selector: string, body: string): string => `${selector} {\n${body}}\n`

// ── fonts.css, typography.css ───────────────────────────────────────────────────────────────────

const template = (name: 'fonts' | 'typography' | 'prose'): string =>
  readFileSync(join(import.meta.dir, 'templates', `${name}.css`), 'utf8')

const fontsCss = (): string => headerWaiving('raw-font-family') + template('fonts')

/** The seven rungs' size and line height, straight from the table, then the static base. */
function typographyCss(): string {
  const vars = resolveTokens()
    .filter(({ def }) => def.family === 'type' && def.name.startsWith('text-'))
    .map(({ def, value }) => decl(`--vx-${def.name}`, String(value)))
    .join('')
  const scale = `@layer basalt.type {\n${rule(':where(:root)', vars).replace(/^(?=.)/gm, '  ')}}\n`
  return headerWaiving('unknown-vx-token') + scale + template('typography')
}

// ── prose.css ───────────────────────────────────────────────────────────────────────────────────

const proseCss = (): string => headerWaiving('inline-spacing, unknown-vx-token') + template('prose')

// ── tailwind.css ────────────────────────────────────────────────────────────────────────────────

const block = (at: string, lines: readonly string[]): string =>
  `${at} {\n${lines.map((l) => `  ${l};\n`).join('')}}\n`

const RESETS = ['color', 'shadow', 'radius', 'text', 'breakpoint'] as const

const SURFACES = ['canvas', 'card', 'inset', 'raised'] as const

function tailwindCss(): string {
  const entries = bridgeEntries()
  const colours = entries.filter((e) => e.tw.startsWith('--color-'))
  const others = entries.filter((e) => !e.tw.startsWith('--color-'))

  const utilities = [
    ['h-ctl', ['height: var(--vx-ctl-h)']],
    ['size-ctl', ['width: var(--vx-ctl-h)', 'height: var(--vx-ctl-h)']],
    ['min-h-row', ['min-height: var(--vx-row-h)']],
    ['size-icon', ['width: var(--vx-icon)', 'height: var(--vx-icon)']],
  ] as const
  const utilityCss = utilities.map(([name, lines]) => block(`@utility ${name}`, lines)).join('')
  const focusRing =
    '@utility focus-ring {\n  /* Focus scrolls the element flush to its scrollport; the margin keeps the 2px ring + 2px offset in view. */\n  scroll-margin: 4px;\n  &:focus-visible {\n    outline: 2px solid var(--vx-brand);\n    outline-offset: 2px;\n  }\n}\n'
  const link = '@utility link {\n  color: var(--vx-brand);\n  text-underline-offset: 2px;\n}\n'

  const surfaceRules = SURFACES.map(
    (s) => `  [data-surface='${s}'] {\n    --vx-surface: var(--vx-${s});\n  }\n`,
  ).join('')

  const base =
    '@layer basalt {\n' +
    surfaceRules +
    '  @media (forced-colors: active) {\n    [data-surface] {\n      border: 1px solid CanvasText;\n    }\n  }\n' +
    '  input:-webkit-autofill,\n  textarea:-webkit-autofill,\n  select:-webkit-autofill {\n' +
    '    -webkit-box-shadow: 0 0 0 100vh var(--vx-surface) inset;\n' +
    '    -webkit-text-fill-color: var(--vx-ink);\n' +
    '    caret-color: var(--vx-ink);\n' +
    '  }\n' +
    '  @media (pointer: coarse) {\n    input,\n    select,\n    textarea {\n      font-size: max(16px, 1em) !important;\n    }\n  }\n' +
    '}\n'

  return (
    headerWaiving('unknown-vx-token') +
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
