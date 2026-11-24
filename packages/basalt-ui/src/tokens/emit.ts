/**
 * The v3 emitter: the table (`table.ts`) resolved against a config, gated (`gates.ts`), and turned
 * into the generated outputs. Everything here is pure and deterministic - no clock, no filesystem,
 * no environment - so emitting twice is byte-identical and the output can be snapshotted.
 *
 * Outputs: `emitTokensCss` (tokens.css and tenant sheets), `emitBasaltTypes` (the `BASALT` constant and its
 * name union), `tokenNames` (the `check-tokens` name list) and `zoneADenial` (the generated half of
 * `tw-off-law`). The Tailwind bridge file, the CLI and the JSON format consume the same table in
 * their own Issues.
 */
import { ACCENTS } from './accents'
import type { AccentName } from './accents'
import { DEFAULT_DERIVE_V3_CONFIG, deriveV3 } from './derive'
import type { DerivedV3, DeriveV3Config } from './derive'
import { block, schemeBlocks } from './emit-fallback'
import type { Decl } from './emit-fallback'
import { assertGates } from './gates'
import { bridgeEntries, COARSE, DENSITY, isPair, resolveTokens, TOKENS } from './table'
import type { ResolvedToken, SchemePair } from './table'

/**
 * Line 1 of every generated stylesheet, verbatim: the contract with `guard`'s scanner (it compares
 * this line exactly, so it is restated here and `emit.test.ts` pins it against `guard`'s copy; the
 * token layer imports nothing from `guard`).
 */
export const GENERATED_HEADER_LINE =
  '/* @generated basalt-ui — do not edit; regenerate with the command on the next line */'

/** The two-line provenance header: the marker, then the emitting version and invocation. */
export function provenanceHeader(version: string, command: string): string {
  return `${GENERATED_HEADER_LINE}\n/* basalt-ui ${version} — \`${command}\` */\n`
}

export type EmitOptions = {
  /** Retune: omitted keys fall back to {@link DEFAULT_DERIVE_V3_CONFIG}. */
  config?: Partial<DeriveV3Config>
  /** The emitting package version (line 2 of the header). */
  version: string
  /** The invocation recorded on line 2; defaults to the bare command. */
  command?: string
  /**
   * Emit a tenant sheet instead of the full one: only the colour roles that differ from the
   * default, scoped to this selector. Must start with `:root[` so every block lands at 0-3-0,
   * above the default sheet's 0-2-0 whatever the source order.
   */
  selector?: string
}

type Side = 'light' | 'dark'

const SCALAR_EXCLUDED = new Set<string>(Object.keys(DENSITY.dense).concat(['hit']))
// Built, not quoted: `scripts/gen-basalt-names.ts` reads every quoted custom-property name in shipped source into
// the 2.x allowlist, and these v3 names must not enter it.
const basaltDecl = (name: string, value: string): Decl => [`--basalt-${name}`, value]

const decls = (tokens: readonly ResolvedToken[], side: Side): Decl[] =>
  tokens.flatMap(({ def, value }): Decl[] =>
    isPair(value) ? [[`--basalt-${def.name}`, value[side]]] : [],
  )

function colorBlocks(
  selectors: Record<'light' | 'dark' | 'auto', string>,
  tokens: readonly ResolvedToken[],
  scheme: boolean,
): string {
  const withScheme = (side: Side): Decl[] => [
    ...(scheme ? ([['color-scheme', side]] as Decl[]) : []),
    ...decls(tokens, side),
  ]
  return schemeBlocks(selectors, withScheme('light'), withScheme('dark'))
}

function scalarBlocks(tokens: readonly ResolvedToken[]): string {
  const scalars = tokens.flatMap(({ def, value }): Decl[] =>
    isPair(value) || SCALAR_EXCLUDED.has(def.name) ? [] : [[`--basalt-${def.name}`, value]],
  )
  const density = (key: keyof typeof DENSITY): Decl[] =>
    Object.entries(DENSITY[key]).map(([name, value]): Decl => [`--basalt-${name}`, value])
  return (
    block(':root', [...scalars, basaltDecl('hit', tokenScalar(tokens, 'hit'))]) +
    block(":root,\n[data-density='dense']", density('dense')) +
    block("[data-density='normal']", density('normal')) +
    block("[data-density='comfortable']", density('comfortable')) +
    // `comfortable` stays 48 on touch, so the row floor skips it; `:root:not([data-density])` is
    // the default (dense) subtree and outranks the plain `:root` above.
    `@media (pointer: coarse) {\n` +
    block(
      ":root:not([data-density]),\n[data-density='dense'],\n[data-density='normal']",
      [basaltDecl('ctl-h', COARSE['ctl-h']), basaltDecl('row-h', COARSE['row-h'])],
      1,
    ) +
    // `comfortable` keeps its 48 px row, so only the control height rises (40 px to 44 px).
    block("[data-density='comfortable']", [basaltDecl('ctl-h', COARSE['ctl-h'])], 1) +
    block(':root', [basaltDecl('hit', COARSE.hit)], 1) +
    `}\n` +
    // The one reduced-motion policy: every motion token ends at once, so anything timed by a token
    // (a `duration-*` class, an `animate-enter-*` preset, a hand-written `var(--basalt-dur-base)`) lands
    // on its end state with no caller asking. `basalt-ui/motion` collapses its presets the same way.
    `@media (prefers-reduced-motion: reduce) {\n` +
    block(':root', reducedMotionDecls(tokens), 1) +
    `}\n`
  )
}

/** Every motion token's reduced value: a duration or a stagger is `0ms`, a spring `0ms linear`. */
function reducedMotionDecls(tokens: readonly ResolvedToken[]): Decl[] {
  return tokens.flatMap(({ def }): Decl[] => {
    if (def.family !== 'motion' || def.name.startsWith('ease')) return []
    return [basaltDecl(def.name, def.name.startsWith('spring') ? '0ms linear' : '0ms')]
  })
}

function tokenScalar(tokens: readonly ResolvedToken[], name: string): string {
  const found = tokens.find((t) => t.def.name === name)?.value
  if (typeof found !== 'string') throw new Error(`--basalt-${name} is not a scalar token`)
  return found
}

function tenantSelectors(selector: string): Record<'light' | 'dark' | 'auto', string> {
  if (!selector.startsWith(':root[')) {
    throw new Error(
      `tenant selector must start with ":root[" so it outranks the default sheet, got "${selector}"`,
    )
  }
  return {
    light: `${selector}:not([data-theme]),\n${selector}[data-theme='light']`,
    dark: `${selector}[data-theme='dark']`,
    auto: `${selector}:not([data-theme])`,
  }
}

const same = (a: SchemePair | string, b: SchemePair | string): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * `tokens.css` for a config, or a tenant sheet when `selector` is given.
 * @throws GateError when the config fails a gate; the emitter never ships a silent bad accent.
 */
export function emitTokensCss(options: EmitOptions): string {
  return emitDerived(deriveV3({ ...DEFAULT_DERIVE_V3_CONFIG, ...options.config }), options)
}

/** {@link emitTokensCss} over an already derived palette; the seam the refusal test pokes. */
export function emitDerived(derived: DerivedV3, options: EmitOptions): string {
  assertGates(derived)
  const tokens = resolveTokens(undefined, derived)
  const header = provenanceHeader(options.version, options.command ?? 'basalt-ui tokens:css')

  if (options.selector !== undefined)
    return header + tenantBlocks(tokens, resolveTokens(DEFAULT_DERIVE_V3_CONFIG), options.selector)

  const pairs = tokens.filter((t) => isPair(t.value))
  return (
    header +
    colorBlocks(
      {
        light: ":root,\n:root[data-theme='light']",
        dark: ":root[data-theme='dark']",
        auto: ':root:not([data-theme])',
      },
      pairs,
      true,
    ) +
    scalarBlocks(tokens)
  )
}

/** The colour roles of `tokens` that differ from `baseline`, scoped to `selector`; empty when none do. */
function tenantBlocks(
  tokens: readonly ResolvedToken[],
  baseline: readonly ResolvedToken[],
  selector: string,
): string {
  const selectors = tenantSelectors(selector)
  const changed = tokens.filter((t, i) => isPair(t.value) && !same(t.value, baseline[i]!.value))
  return changed.length === 0 ? '' : colorBlocks(selectors, changed, false)
}

export type EmitAccentsOptions = Omit<EmitOptions, 'selector'> & {
  /** The accents the app ships, by name; each becomes one `:root[data-accent='<name>']` block. */
  accents: readonly AccentName[]
}

/**
 * The accent sheet: per named accent, the colour roles its seed changes against the app's own base
 * (`config`, the same retune its `tokens.css` was emitted with), scoped to
 * `:root[data-accent='<name>']`. An accent equal to the base emits nothing, so the default accent costs
 * no bytes. Each seed passes the gates or the emitter throws, as a retune does.
 * @throws GateError when an accent over this base fails a gate.
 */
export function emitAccentsCss(options: EmitAccentsOptions): string {
  const base = { ...DEFAULT_DERIVE_V3_CONFIG, ...options.config }
  const baseline = resolveTokens(undefined, deriveV3(base))
  const header = provenanceHeader(options.version, options.command ?? 'basalt-ui tokens:css')
  const blocks = [...new Set(options.accents)].map((name) => {
    const derived = deriveV3({ ...base, accent: ACCENTS[name] })
    assertGates(derived)
    return tenantBlocks(resolveTokens(undefined, derived), baseline, `:root[data-accent='${name}']`)
  })
  return header + blocks.join('')
}

/** The public `--basalt-*` names, in table order. */
export function tokenNames(): string[] {
  return TOKENS.map((t) => `--basalt-${t.name}`)
}

const camel = (name: string): string =>
  name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/** TypeScript source for `BASALT` (each key a `var(--basalt-*)` ref) and its name unions. */
export function emitBasaltTypes(options: Pick<EmitOptions, 'version' | 'command'>): string {
  const rows = TOKENS.map((t) => `  ${camel(t.name)}: 'var(--basalt-${t.name})',`)
  const names = tokenNames().map((n) => `  | '${n}'`)
  return (
    provenanceHeader(options.version, options.command ?? 'basalt-ui tokens:css') +
    `export const BASALT = {\n${rows.join('\n')}\n} as const\n\n` +
    `export type BasaltKey = keyof typeof BASALT\n\n` +
    `export type BasaltVar =\n${names.join('\n')}\n`
  )
}

/** Utility prefixes the zone A colour denial applies to (tokens-visual 3.5). */
export const ZONE_A_PREFIXES = [
  'bg',
  'border',
  'ring',
  'outline',
  'divide',
  'from',
  'via',
  'to',
  'fill',
  'stroke',
  'decoration',
  'shadow',
  'accent',
  'caret',
  'text',
] as const

/** Denied outright, whatever the colour. */
export const ZONE_A_DENIED_OUTRIGHT = [
  'bg-current',
  'border-current',
  'ring-current',
  'outline-current',
  'divide-current',
  'from-',
  'via-',
  'to-current',
] as const

/** Survive: no text hue exists for them to inherit. */
export const ZONE_A_ALLOWED_CURRENT = ['fill-current', 'stroke-current', 'text-current'] as const

export type ZoneADenial = {
  /** Colour names (the `--color-` suffix) resolving to brand, status, tint, chart or seq. */
  names: string[]
  /** Pre-mixed alpha roles (`hairline`, `hover`, ...): `/NN` on them compounds the alpha. */
  premixed: string[]
  /** Fill-only roles, earned or not (`brand-fill`, `chart-N`, `seq-N`, `dim-bar`): never text. */
  fillOnly: string[]
  prefixes: readonly string[]
  deniedOutright: readonly string[]
  allowedCurrent: readonly string[]
}

/**
 * The generated half of `tw-off-law`: every bridge target that resolves to an earned token, so a
 * new alias cannot slip the list. `bg-brand`, `text-good`, `border-good-tint` are all denied in
 * app code (zone A); ejected primitives are zone S for this denial only.
 */
export function zoneADenial(): ZoneADenial {
  const names = bridgeEntries()
    .filter((e) => e.earned && e.tw.startsWith('--color-'))
    .map((e) => e.tw.slice('--color-'.length))
  return {
    names: [...new Set(names)],
    premixed: TOKENS.filter((t) => t.premixed).map((t) => t.name),
    fillOnly: TOKENS.filter((t) => t.fillOnly).map((t) => t.name),
    prefixes: ZONE_A_PREFIXES,
    deniedOutright: ZONE_A_DENIED_OUTRIGHT,
    allowedCurrent: ZONE_A_ALLOWED_CURRENT,
  }
}
