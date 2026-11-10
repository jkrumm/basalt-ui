/**
 * The v3 token table: the ONE authored list (docs/v3/concepts/tokens-visual.md 3.2). `emit.ts`
 * generates `tokens.css`, the `VX` type, the `check-tokens` name list and the zone A denial from it;
 * `gates.ts` proves its colours. A name is public once it is a row here, so adding one is a
 * deliberate edit with a count test behind it (`table.test.ts`: 74 booked + `input`, ceiling 90).
 *
 * Colour values come from `deriveV3` (HCT, hex out): the table never carries a hex. A value is a
 * `{ light, dark }` pair, or a scalar string for a scheme-free role. Pre-mixed alpha roles
 * (`hairline`, `hover`, `selected`, `scrim`, `input`, `grid`, `crosshair`) are `color-mix` strings
 * over `var(--vx-ink)`, so `/NN` on them would compound and is denied by `tw-off-law`.
 *
 * Pure: no React, no Tailwind, no `palette.ts`/`core.ts` (the 2.x modules this replaces).
 */
// theme-allow-file raw-hex, raw-color-fn — the table is the one authored list; its shadow pairs and scrim carry constant shadow colours, and every role colour comes from deriveV3.
import { DEFAULT_DERIVE_V3_CONFIG, INK_MIX_PCT, TINT_PCT, deriveV3 } from './derive'
import type { ColorNameV3, DerivedV3, DeriveV3Config } from './derive'

export type Scheme = 'light' | 'dark'
export type SchemePair = { light: string; dark: string }

export type TokenFamily =
  | 'surface'
  | 'interaction'
  | 'line'
  | 'ink'
  | 'brand'
  | 'status'
  | 'viz'
  | 'shadow'
  | 'radius'
  | 'size'
  | 'font'
  | 'weight'
  | 'type'
  | 'motion'
  | 'rhythm'
  | 'contract'

export type TokenDef = {
  /** Name without the `--vx-` prefix. */
  readonly name: string
  readonly family: TokenFamily
  /** One line: what the role is for. */
  readonly role: string
  readonly value: (derived: DerivedV3) => SchemePair | string
  /** Tailwind theme variables this token feeds directly, e.g. `--color-background`. */
  readonly tw?: readonly string[]
  /** 2.x names this replaces: the migration rows are generated from here. */
  readonly from?: readonly string[]
  /** Hue-bearing: the zone A `tw-off-law` denial is generated from every earned bridge target. */
  readonly earned?: true
}

const ink = (pct: number): string => `color-mix(in srgb, var(--vx-ink) ${pct}%, transparent)`
const inkMix = (key: keyof typeof INK_MIX_PCT) => (): SchemePair => ({
  light: ink(INK_MIX_PCT[key].light),
  dark: ink(INK_MIX_PCT[key].dark),
})
const color =
  (name: ColorNameV3) =>
  (derived: DerivedV3): SchemePair =>
    derived.colors[name]
const scalar = (value: string) => (): string => value

const STATUS_NAMES = ['good', 'warn', 'bad', 'info'] as const
const TEXT_RUNGS = [
  ['micro', '0.6875rem', '1rem'],
  ['xs', '0.75rem', '1rem'],
  ['sm', '0.8125rem', '1.25rem'],
  ['md', '0.9375rem', '1.25rem'],
  ['base', '1rem', '1.5rem'],
  ['lg', '1.125rem', '1.5rem'],
  ['display', '1.875rem', '1'],
] as const

const SANS_FALLBACK =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export const TOKENS: readonly TokenDef[] = [
  // ── Surfaces ──────────────────────────────────────────────────────────────────────────────────
  {
    name: 'canvas',
    family: 'surface',
    role: 'Page, table head',
    value: color('canvas'),
    tw: ['--color-background'],
    from: ['surface-bg', 'surface-subtle'],
  },
  {
    name: 'inset',
    family: 'surface',
    role: 'The reading surface: data, rows, charts',
    value: color('inset'),
    tw: ['--color-inset'],
  },
  {
    name: 'card',
    family: 'surface',
    role: 'Ringed frame, header and footer bands',
    value: color('card'),
    tw: ['--color-card'],
    from: ['surface-panel', 'surface-field'],
  },
  {
    name: 'raised',
    family: 'surface',
    role: 'Controls, tiles, popovers, chips',
    value: color('raised'),
    tw: ['--color-popover'],
    from: ['surface-elevated', 'surface-overlay', 'tooltip-bg'],
  },
  {
    name: 'surface',
    family: 'surface',
    role: 'The current surface; Card and Inset re-point it per nesting level',
    value: scalar('var(--vx-canvas)'),
    tw: ['--color-surface'],
  },
  // ── Interaction ───────────────────────────────────────────────────────────────────────────────
  {
    name: 'hover',
    family: 'interaction',
    role: 'Row/control hover: an ink mix, so one value works on card and inset',
    value: inkMix('hover'),
    tw: ['--color-accent'],
    from: ['surface-row-hover', 'surface-panel-hover'],
  },
  {
    name: 'selected',
    family: 'interaction',
    role: 'Selected row/segment: one ink step above hover, never blue',
    value: inkMix('selected'),
    tw: ['--color-selected'],
    from: ['surface-row-selected'],
  },
  {
    name: 'scrim',
    family: 'interaction',
    role: 'Overlay backdrop',
    value: () => ({
      light: ink(INK_MIX_PCT.scrim.light),
      dark: 'color-mix(in srgb, #000000 60%, transparent)',
    }),
    tw: ['--color-scrim'],
  },
  // ── Line ──────────────────────────────────────────────────────────────────────────────────────
  {
    name: 'hairline',
    family: 'line',
    role: 'The ring and every seam: an ink alpha (12% light, 9% dark), never a hex',
    value: inkMix('hairline'),
    tw: ['--color-border'],
    from: ['surface-border', 'surface-hairline', 'divider', 'tooltip-border'],
  },
  {
    name: 'input',
    family: 'line',
    role: 'Input boundary: a deliberate heavier line, >= 3:1 on every surface (S3 spike)',
    value: inkMix('input'),
    tw: ['--color-input'],
  },
  // ── Inks ──────────────────────────────────────────────────────────────────────────────────────
  {
    name: 'ink',
    family: 'ink',
    role: 'Primary text; `primary` is ink, so action is ink and blue is data',
    value: color('ink'),
    tw: ['--color-foreground'],
    from: ['ink', 'ink2', 'tooltip-text'],
  },
  {
    name: 'ink-muted',
    family: 'ink',
    role: 'Secondary text',
    value: color('ink-muted'),
    tw: ['--color-muted-foreground'],
    from: ['muted', 'legend-text', 'line2', 'neutral', 'tooltip-muted'],
  },
  {
    name: 'ink-faint',
    family: 'ink',
    role: 'Tertiary text and the opaque chart axis; excluded from raised (3.91)',
    value: color('ink-faint'),
    tw: ['--color-faint'],
    from: ['faint', 'axis', 'axis-stroke'],
  },
  // ── Brand ─────────────────────────────────────────────────────────────────────────────────────
  {
    name: 'brand',
    family: 'brand',
    role: 'Blue as ink: links, focus ring, active-nav icon; >= 4.5 on canvas, inset, card',
    value: color('brand'),
    tw: ['--color-brand', '--color-ring'],
    from: ['accent', 'accent-hover'],
    earned: true,
  },
  {
    name: 'brand-fill',
    family: 'brand',
    role: 'Blue as fill, one value in both schemes; legal on canvas and inset only',
    value: color('brand-fill'),
    tw: ['--color-brand-fill'],
    from: ['accent-fill'],
    earned: true,
  },
  {
    name: 'on-brand',
    family: 'brand',
    role: 'Label on brand-fill, >= 4.5',
    value: color('on-brand'),
    tw: ['--color-on-brand'],
    from: ['on-accent'],
    earned: true,
  },
  // ── Status (+ tint) ───────────────────────────────────────────────────────────────────────────
  ...STATUS_NAMES.map((name): TokenDef => ({
    name,
    family: 'status',
    role: `${name}: ink solved to 4.5:1 on every text surface and on its own tint`,
    value: color(name),
    tw: name === 'bad' ? ['--color-bad', '--color-destructive'] : [`--color-${name}`],
    from: [`status-${name}`, `${name}-soft`],
    earned: true,
  })),
  {
    name: 'tint-pct',
    family: 'status',
    role: 'Share of a status ink in its `-tint` (16% dark, 12% light)',
    value: () => ({ light: `${TINT_PCT.light}%`, dark: `${TINT_PCT.dark}%` }),
  },
  // ── Viz ───────────────────────────────────────────────────────────────────────────────────────
  {
    name: 'line',
    family: 'viz',
    role: 'The neutral data line',
    value: color('line'),
    tw: ['--color-line'],
    earned: true,
  },
  {
    name: 'dim-bar',
    family: 'viz',
    role: 'A bar that is not the highlighted one; >= 2.0 on inset',
    value: color('dim-bar'),
    tw: ['--color-dim-bar'],
  },
  {
    name: 'grid',
    family: 'viz',
    role: 'Gridlines: an ink alpha',
    value: inkMix('grid'),
    tw: ['--color-grid'],
  },
  {
    name: 'crosshair',
    family: 'viz',
    role: 'Cursor crosshair: an ink alpha',
    value: inkMix('crosshair'),
    tw: ['--color-crosshair'],
  },
  ...([1, 2, 3, 4, 5] as const).map((n): TokenDef => ({
    name: `chart-${n}`,
    family: 'viz',
    role: `Categorical series ${n}, in the fill band: >= 3:1 on canvas and inset`,
    value: color(`chart-${n}`),
    tw: [`--color-chart-${n}`],
    earned: true,
  })),
  ...([1, 2, 3, 4, 5] as const).map((n): TokenDef => ({
    name: `seq-${n}`,
    family: 'viz',
    role: `Sequential ramp step ${n}, monotonic in lightness`,
    value: color(`seq-${n}`),
    tw: [`--color-seq-${n}`],
    earned: true,
  })),
  // ── Shadow ────────────────────────────────────────────────────────────────────────────────────
  // The card ring is `Card::after`, not part of this value (an inset shadow paints under a flush
  // opaque child). Dark cards cast no drop.
  {
    name: 'shadow-card',
    family: 'shadow',
    role: 'Card drop; the ring is an overlay, so nothing here draws an edge',
    value: () => ({ light: `0 1px 2px ${ink(5)}`, dark: 'none' }),
    tw: ['--shadow-card'],
    from: ['shadow-card'],
  },
  // THE TWO SCHEMES ARE SHAPED DIFFERENTLY, and the asymmetry is the whole design — do NOT "tidy"
  // them into one shape (2.x d9). Dark = drop + a full inset rim: its edge is a lightening, so it
  // cannot collide with the drop. Light = drop ONLY: every position for a darkening edge reads as a
  // border or a double bottom edge. S2 (docs/v3/spikes/token-surfaces.md) re-tested a light ring
  // on the warm ramp and refuted it: it adds a second edge on canvas, inset and card, so the
  // light `secondary` is `raised` + this drop and no hairline.
  {
    name: 'shadow-raised',
    family: 'shadow',
    role: 'Controls and tiles; light is drop-only on purpose',
    value: () => ({
      light: '0 1px 2px rgba(28, 25, 23, 0.1)',
      dark: '0 1px 2px rgba(0, 0, 0, 0.35), inset 0 0 0 1px color-mix(in srgb, #ffffff 8%, transparent)',
    }),
    tw: ['--shadow-raised'],
    from: ['shadow-ctrl'],
  },
  {
    name: 'shadow-overlay',
    family: 'shadow',
    role: 'Popovers, menus, tooltips, modals: a real lift',
    value: () => ({
      light: '0 8px 24px rgba(28, 25, 23, 0.1)',
      dark: '0 8px 24px rgba(0, 0, 0, 0.5)',
    }),
    tw: ['--shadow-overlay'],
    from: ['tooltip-shadow'],
  },
  // ── Radius ────────────────────────────────────────────────────────────────────────────────────
  // 14/10/8/5, no knob in 3.0 (DPO 5e): the owner's pick edits these four rows and nothing else.
  {
    name: 'radius-card',
    family: 'radius',
    role: 'Card',
    value: scalar('14px'),
    tw: ['--radius-card'],
  },
  {
    name: 'radius-inset',
    family: 'radius',
    role: 'Inset (flush edges are not concentric)',
    value: scalar('10px'),
    tw: ['--radius-inset'],
    from: ['radius-floating'],
  },
  {
    name: 'radius-ctrl',
    family: 'radius',
    role: 'Controls',
    value: scalar('8px'),
    tw: ['--radius-ctrl'],
  },
  {
    name: 'radius-chip',
    family: 'radius',
    role: 'Chips, segmented indicator',
    value: scalar('5px'),
    tw: ['--radius-chip'],
    from: ['radius-tight'],
  },
  // ── Size (density values live in DENSITY / COARSE) ────────────────────────────────────────────
  { name: 'ctl-h', family: 'size', role: 'Control height (`h-ctl`)', value: scalar('1.75rem') },
  {
    name: 'row-h',
    family: 'size',
    role: 'Row minimum height (`min-h-row`)',
    value: scalar('2rem'),
  },
  { name: 'icon', family: 'size', role: 'Icon box (`size-icon`)', value: scalar('1rem') },
  {
    name: 'hit',
    family: 'size',
    role: 'Hit target floor for icon-only controls in dense rows',
    value: scalar('1.5rem'),
  },
  // ── Fonts, weights ────────────────────────────────────────────────────────────────────────────
  {
    name: 'font-sans',
    family: 'font',
    role: 'Body and UI',
    value: scalar(`'Nunito Sans Variable', ${SANS_FALLBACK}`),
    tw: ['--font-sans'],
  },
  {
    name: 'font-head',
    family: 'font',
    role: 'Headings; digits come from Nunito via the Head Digits face',
    value: scalar(`'Head Digits', 'Hubot Sans Variable', ${SANS_FALLBACK}`),
    tw: ['--font-head'],
  },
  {
    name: 'font-mono',
    family: 'font',
    role: 'Machine strings, ids; ligatures off',
    value: scalar("'JetBrains Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace"),
    tw: ['--font-mono'],
  },
  {
    name: 'font-head-stretch',
    family: 'font',
    role: 'Hubot-only `font-stretch`',
    value: scalar('88%'),
  },
  {
    name: 'weight-body',
    family: 'weight',
    role: 'Body',
    value: scalar('400'),
    tw: ['--font-weight-normal'],
  },
  {
    name: 'weight-medium',
    family: 'weight',
    role: 'Labels',
    value: scalar('500'),
    tw: ['--font-weight-medium'],
  },
  {
    name: 'weight-strong',
    family: 'weight',
    role: 'Titles, hero figures',
    value: scalar('600'),
    tw: ['--font-weight-semibold'],
  },
  // ── Type: seven rem rungs, each with its line height ──────────────────────────────────────────
  ...TEXT_RUNGS.flatMap(([rung, size, lineHeight]): TokenDef[] => [
    {
      name: `text-${rung}`,
      family: 'type',
      role: `Type rung ${rung}`,
      value: scalar(size),
      tw: [`--text-${rung}`],
    },
    {
      name: `text-${rung}-lh`,
      family: 'type',
      role: `Line height of ${rung}`,
      value: scalar(lineHeight),
      tw: [`--text-${rung}--line-height`],
    },
  ]),
  // ── Motion, rhythm, contract ──────────────────────────────────────────────────────────────────
  { name: 'dur-fast', family: 'motion', role: 'Hover, press', value: scalar('150ms') },
  { name: 'dur-base', family: 'motion', role: 'Enter, exit, reveal', value: scalar('250ms') },
  {
    name: 'ease',
    family: 'motion',
    role: 'Standard curve',
    value: scalar('cubic-bezier(0.4, 0, 0.2, 1)'),
    tw: ['--ease-standard'],
  },
  { name: 'measure', family: 'rhythm', role: '`.vx-prose` line length', value: scalar('68ch') },
  { name: 'rhythm-1', family: 'rhythm', role: 'Tight block gap', value: scalar('0.75em') },
  { name: 'rhythm-2', family: 'rhythm', role: 'Block gap', value: scalar('1.25em') },
  { name: 'rhythm-3', family: 'rhythm', role: 'Section gap', value: scalar('2em') },
  {
    name: 'contract',
    family: 'contract',
    role: 'Token contract version; a value shift needs a `valueShifts` row',
    value: scalar('3'),
  },
]

/** Control and row heights per `data-density` (3.6). `dense` is the default and sits on `:root`. */
export const DENSITY = {
  dense: { 'ctl-h': '1.75rem', 'row-h': '2rem' },
  normal: { 'ctl-h': '2rem', 'row-h': '2.5rem' },
  comfortable: { 'ctl-h': '2.5rem', 'row-h': '3rem' },
} as const
export type Density = keyof typeof DENSITY

/** Primary-pointer overrides: the 2.x 44px floor, asserted in the layout suite (d14). */
export const COARSE = { 'row-h': '2.75rem', hit: '2.75rem' } as const

/** Tailwind-only colour aliases, which name no `--vx-*` of their own (3.2). */
export const COLOR_ALIASES: readonly { readonly tw: string; readonly token: string }[] = [
  { tw: '--color-primary', token: 'ink' },
  { tw: '--color-primary-foreground', token: 'canvas' },
  // S2: raised with the drop-only `shadow-raised`; the hairline ring is refuted on the warm ramp.
  { tw: '--color-secondary', token: 'raised' },
  { tw: '--color-muted', token: 'card' },
]

/** `foreground` roles and the fill each is painted on; every pair is gated (d33). */
export const FOREGROUND_PAIRS = [
  { foreground: 'on-brand', fill: 'brand-fill', tw: '--color-on-brand' },
  { foreground: 'canvas', fill: 'ink', tw: '--color-primary-foreground' },
] as const

export type BridgeEntry = {
  /** The Tailwind theme variable, e.g. `--color-good-tint`. */
  readonly tw: string
  /** Its value: always a reference to `--vx-*`, so `@theme inline` keeps one truth. */
  readonly value: string
  /** The token the entry resolves to. */
  readonly token: string
  readonly earned: boolean
}

const BY_NAME: ReadonlyMap<string, TokenDef> = new Map(TOKENS.map((t) => [t.name, t]))

export function tokenByName(name: string): TokenDef {
  const token = BY_NAME.get(name)
  if (!token) throw new Error(`unknown token --vx-${name}`)
  return token
}

/**
 * Every Tailwind theme variable the table feeds: direct targets, the colour aliases, and the
 * `-tint` of each status tone (and `destructive`). Order is table order, so output is stable.
 */
export function bridgeEntries(): BridgeEntry[] {
  const entries: BridgeEntry[] = []
  const tint = (name: string): string =>
    `color-mix(in srgb, var(--vx-${name}) var(--vx-tint-pct), transparent)`
  for (const token of TOKENS) {
    for (const tw of token.tw ?? []) {
      entries.push({
        tw,
        value: `var(--vx-${token.name})`,
        token: token.name,
        earned: !!token.earned,
      })
      if (token.family === 'status' && tw.startsWith('--color-')) {
        entries.push({ tw: `${tw}-tint`, value: tint(token.name), token: token.name, earned: true })
      }
    }
  }
  for (const { tw, token } of COLOR_ALIASES) {
    entries.push({ tw, value: `var(--vx-${token})`, token, earned: !!tokenByName(token).earned })
  }
  return entries
}

export type ResolvedToken = { readonly def: TokenDef; readonly value: SchemePair | string }

/** The table resolved against a config: one value per token, pair or scalar. */
export function resolveTokens(
  config?: Partial<DeriveV3Config>,
  derived: DerivedV3 = deriveV3({ ...DEFAULT_DERIVE_V3_CONFIG, ...config }),
): ResolvedToken[] {
  return TOKENS.map((def) => ({ def, value: def.value(derived) }))
}

export function isPair(value: SchemePair | string): value is SchemePair {
  return typeof value !== 'string'
}
