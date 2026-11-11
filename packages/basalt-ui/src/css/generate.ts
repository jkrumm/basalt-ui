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

const template = (name: 'fonts' | 'typography'): string =>
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

const PROSE: readonly (readonly [
  selector: string,
  decls: readonly (readonly [string, string])[],
])[] = [
  [
    '.vx-prose',
    [
      ['max-inline-size', 'var(--vx-measure)'],
      ['font-size', 'var(--vx-text-base)'],
      ['line-height', 'var(--vx-text-base-lh)'],
      ['text-wrap', 'pretty'],
      ['overflow-wrap', 'break-word'],
    ],
  ],
  ['.vx-prose > :first-child', [['margin-block-start', '0']]],
  ['.vx-prose > :last-child', [['margin-block-end', '0']]],
  [
    '.vx-prose :is(p, ul, ol, dl, blockquote, pre, figure, table, hr, details)',
    [['margin-block', 'var(--vx-rhythm-2) 0']],
  ],
  [
    '.vx-prose :is(h2, h3, h4)',
    [
      ['font-family', 'var(--vx-font-head)'],
      ['font-stretch', 'var(--vx-font-head-stretch)'],
      ['font-weight', 'var(--vx-weight-strong)'],
      ['text-wrap', 'balance'],
      ['margin-block', 'var(--vx-rhythm-3) var(--vx-rhythm-1)'],
      ['scroll-margin-block-start', 'var(--vx-rhythm-3)'],
    ],
  ],
  [
    '.vx-prose h2',
    [
      ['font-size', '1.625rem'],
      ['line-height', '1.2'],
      ['letter-spacing', '-0.01em'],
    ],
  ],
  [
    '.vx-prose h3',
    [
      ['font-size', '1.3125rem'],
      ['line-height', '1.25'],
    ],
  ],
  [
    '.vx-prose h4',
    [
      ['font-size', 'var(--vx-text-lg)'],
      ['line-height', 'var(--vx-text-lg-lh)'],
      ['margin-block-start', 'var(--vx-rhythm-2)'],
    ],
  ],
  [
    '.vx-prose :is(h2, h3, h4) + :is(p, ul, ol, blockquote, pre, figure, table)',
    [['margin-block-start', 'var(--vx-rhythm-1)']],
  ],
  [
    '.vx-prose a',
    [
      ['color', 'var(--vx-brand)'],
      ['text-decoration-line', 'underline'],
      ['text-decoration-thickness', '1px'],
      ['text-underline-offset', '2px'],
    ],
  ],
  ['.vx-prose a:hover', [['text-decoration-thickness', '2px']]],
  ['.vx-prose :is(strong, b, th)', [['font-weight', 'var(--vx-weight-strong)']]],
  ['.vx-prose :is(ul, ol)', [['padding-inline-start', '1.5em']]],
  ['.vx-prose ul', [['list-style-type', 'disc']]],
  ['.vx-prose ol', [['list-style-type', 'decimal']]],
  ['.vx-prose li', [['margin-block-start', 'var(--vx-rhythm-1)']]],
  ['.vx-prose li::marker', [['color', 'var(--vx-ink-muted)']]],
  ['.vx-prose li > :is(ul, ol)', [['margin-block-start', 'var(--vx-rhythm-1)']]],
  [
    '.vx-prose dt',
    [
      ['font-weight', 'var(--vx-weight-strong)'],
      ['margin-block-start', 'var(--vx-rhythm-1)'],
    ],
  ],
  [
    '.vx-prose dd',
    [
      ['margin-inline-start', '1.5em'],
      ['color', 'var(--vx-ink-muted)'],
    ],
  ],
  [
    '.vx-prose blockquote',
    [
      ['margin-inline', '0'],
      ['padding-inline-start', '1em'],
      ['border-inline-start', '2px solid var(--vx-hairline)'],
      ['color', 'var(--vx-ink-muted)'],
    ],
  ],
  ['.vx-prose blockquote > :first-child', [['margin-block-start', '0']]],
  [
    '.vx-prose hr',
    [
      ['border', '0'],
      ['border-block-start', '1px solid var(--vx-hairline)'],
      ['margin-block', 'var(--vx-rhythm-3)'],
    ],
  ],
  [
    '.vx-prose table',
    [
      ['inline-size', '100%'],
      ['border-collapse', 'collapse'],
      ['font-size', 'var(--vx-text-sm)'],
      ['line-height', 'var(--vx-text-sm-lh)'],
    ],
  ],
  [
    '.vx-prose :is(th, td)',
    [
      ['padding', '0.5em 0.75em'],
      ['text-align', 'start'],
      ['border-block-end', '1px solid var(--vx-hairline)'],
      ['font-variant-numeric', 'tabular-nums'],
    ],
  ],
  [
    '.vx-prose thead th',
    [
      ['color', 'var(--vx-ink-muted)'],
      ['background-color', 'var(--vx-card)'],
    ],
  ],
  [
    '.vx-prose :is(code, kbd, samp)',
    [
      ['font-size', '0.875em'],
      ['padding', '0.125em 0.375em'],
      ['border-radius', 'var(--vx-radius-chip)'],
      ['background-color', 'var(--vx-card)'],
      ['box-shadow', 'inset 0 0 0 1px var(--vx-hairline)'],
    ],
  ],
  [
    '.vx-prose pre',
    [
      ['overflow-x', 'auto'],
      ['padding', '1em'],
      ['font-size', 'var(--vx-text-sm)'],
      ['line-height', 'var(--vx-text-sm-lh)'],
      ['border-radius', 'var(--vx-radius-inset)'],
      ['background-color', 'var(--vx-inset)'],
      ['box-shadow', 'inset 0 0 0 1px var(--vx-hairline)'],
      ['tab-size', '2'],
    ],
  ],
  [
    '.vx-prose pre code',
    [
      ['padding', '0'],
      ['font-size', 'inherit'],
      ['background', 'none'],
      ['box-shadow', 'none'],
    ],
  ],
  [
    '.vx-prose :is(img, video, svg)',
    [
      ['max-inline-size', '100%'],
      ['block-size', 'auto'],
    ],
  ],
  ['.vx-prose figure', [['margin-inline', '0']]],
  [
    '.vx-prose figcaption',
    [
      ['margin-block-start', 'var(--vx-rhythm-1)'],
      ['font-size', 'var(--vx-text-xs)'],
      ['line-height', 'var(--vx-text-xs-lh)'],
      ['color', 'var(--vx-ink-muted)'],
    ],
  ],
  ['.vx-prose sup', [['line-height', '0']]],
  [
    '.vx-prose :is([data-footnote-ref], [data-footnote-backref])',
    [['text-decoration-line', 'none']],
  ],
  [
    '.vx-prose :is(.footnotes, [data-footnotes])',
    [
      ['margin-block-start', 'var(--vx-rhythm-3)'],
      ['padding-block-start', 'var(--vx-rhythm-2)'],
      ['border-block-start', '1px solid var(--vx-hairline)'],
      ['font-size', 'var(--vx-text-sm)'],
      ['line-height', 'var(--vx-text-sm-lh)'],
      ['color', 'var(--vx-ink-muted)'],
    ],
  ],
  [
    '.vx-prose :is(.footnotes, [data-footnotes]) :is(ol, p)',
    [['margin-block-start', 'var(--vx-rhythm-1)']],
  ],
  [
    '.vx-prose mark',
    [
      ['background-color', 'var(--vx-selected)'],
      ['color', 'inherit'],
    ],
  ],
  [
    '.vx-prose summary',
    [
      ['cursor', 'pointer'],
      ['font-weight', 'var(--vx-weight-medium)'],
    ],
  ],
]

const proseRule = ([selector, decls]: (typeof PROSE)[number]): string =>
  rule(`:where(${selector})`, decls.map(([name, value]) => decl(name, value)).join(''))

function proseCss(): string {
  const forced =
    '@media (forced-colors: active) {\n' +
    '  :where(.vx-prose :is(code, kbd, samp, pre)) {\n' +
    '    border: 1px solid CanvasText;\n' +
    '  }\n' +
    '  :where(.vx-prose a) {\n' +
    '    color: LinkText;\n' +
    '  }\n' +
    '}\n'
  const print =
    '@media print {\n' +
    '  :where(.vx-prose) {\n' +
    '    max-inline-size: none;\n' +
    '  }\n' +
    '  :where(.vx-prose a) {\n' +
    '    color: inherit;\n' +
    '  }\n' +
    '  :where(.vx-prose :is(pre, blockquote, figure, tr)) {\n' +
    '    break-inside: avoid;\n' +
    '  }\n' +
    '  :where(.vx-prose :is(h2, h3, h4)) {\n' +
    '    break-after: avoid;\n' +
    '  }\n' +
    '}\n'
  const body = [...PROSE.map(proseRule), forced, print].join('').replace(/^(?=.)/gm, '  ')
  return `${headerWaiving('inline-spacing, unknown-vx-token')}@layer basalt.prose {\n${body}}\n`
}

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
    '@utility focus-ring {\n  &:focus-visible {\n    outline: 2px solid var(--vx-brand);\n    outline-offset: 2px;\n  }\n}\n'
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
