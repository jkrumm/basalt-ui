/**
 * The oxlint preset, built from the rule table (guardrails sections 6, 9, 10): which ids run at
 * which profile, the options each profile writes, the zones a rule is off in, the shadcn rules and
 * the jsx-a11y component map. Nothing here lists an id or an option by hand; `presetInput(table)`
 * is the one source and `scripts/gen-oxlint.ts` writes the result to `configs/oxlint-<profile>.json`.
 *
 * Pure data in, config out: the generator reads the files (pins, contracts, `SLOTS`) and passes
 * them in, so `sync` can call the same builder with a manifest's roots and ejected paths.
 */
import type { Profile, RuleTable } from './rule-table'
import { PLUGIN_NAME, presetInput } from './rule-table'

/** `tokens` has no oxlint preset (guardrails section 6); the other three ship as files. */
export type PresetProfile = 'tokens' | 'bridge' | 'parts' | 'app'
export const SHIPPED_PROFILES = ['bridge', 'parts', 'app'] as const satisfies readonly Profile[]

/** The five bought token rules every shipped profile runs. */
export const SHADCN_TOKEN_RULES = [
  'no-raw-colors',
  'no-arbitrary-values',
  'no-unknown-classes',
  'no-inline-styles',
  'require-static-classes',
] as const
export const SHADCN_RESTYLE = 'no-restyle'
const SHADCN_RULES = [...SHADCN_TOKEN_RULES, SHADCN_RESTYLE] as const

/** The npm specifiers oxlint loads as JS plugins; the shipped file extends from a consumer's tree. */
export const JS_PLUGINS = ['basalt-ui/lint', '@shadcn/lint'] as const

/** `no-restyle` recognises primitives by import specifier: basalt's own at parts and app. */
export const PARTS_COMPONENT_IMPORTS = ['^basalt-ui/ui/'] as const
/** At bridge it recognises only the app's own `components/ui` (zone V is where they live). */
export const BRIDGE_COMPONENT_IMPORTS = ['(?:^|/)components/ui(?:/|$)'] as const
/** Zone V: the console's own shadcn files, a bridge-only zone (section 6). */
export const VENDORED_GLOB = '**/components/ui/**'

/** Base UI sets these on popups; `no-arbitrary-values` allows them in the S and E zones only. */
export const BASE_UI_VARS = [
  'origin-(--transform-origin)',
  'min-w-(--anchor-width)',
  'max-h-(--available-height)',
  'max-w-(--available-width)',
  'h-(--accordion-panel-height)',
  'h-(--collapsible-panel-height)',
] as const

/** One `shadcn/no-restyle` contract, generated from a primitive's cva table. */
export type Contract = {
  readonly pattern: string
  readonly allow: readonly string[]
  readonly deny: readonly string[]
  readonly message: string
}

export type PresetInputs = {
  readonly table: RuleTable
  readonly pins: { readonly oxlint: string; readonly shadcnLint: string }
  /** Generated from the cva tables; the contract list is empty until `ui/*` exists. */
  readonly contracts: readonly Contract[]
  /** `SLOTS`: every `basalt-ui/ui/*` module and the `data-slot` of each part it renders. */
  readonly uiSlots: Readonly<Record<string, readonly string[]>>
  /** The default profile of the repo (`manifest.profile`). */
  readonly profile: PresetProfile
  /** `manifest.roots`: a path to the profile its files lint at (E6). */
  readonly roots?: Readonly<Record<string, PresetProfile>>
  /** Zone E: `manifest.ejected[*].path`. */
  readonly ejected?: readonly string[]
  /** Zone S: seeds, in basalt-ui's own repo only. */
  readonly seeds?: readonly string[]
}

type Rules = Record<string, unknown>
export type Override = { files: string[]; rules: Rules }
export type PresetConfig = {
  plugins: string[]
  jsPlugins: string[]
  settings: Record<string, unknown>
  rules: Rules
  overrides: Override[]
}

const qualified = (rule: string): string => `shadcn/${rule}`

// ── jsx-a11y component map ───────────────────────────────────────────────────────────────────────

/** `toggle-group` → `ToggleGroup`: the export name of a part, as the no-restyle contracts name it. */
export const pascal = (slot: string): string =>
  slot
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')

/**
 * The native element a part renders as, for the slots that render one jsx-a11y reads differently
 * from a `div`. Every other part maps to `div`, which keeps the interaction rules on a wrapper.
 */
const NATIVE_ELEMENT: Readonly<Record<string, string>> = {
  button: 'button',
  pressable: 'button',
  input: 'input',
  textarea: 'textarea',
  'native-select': 'select',
  'number-field': 'input',
  'field-label': 'label',
  form: 'form',
  fieldset: 'fieldset',
  'fieldset-legend': 'legend',
  kbd: 'kbd',
  table: 'table',
  'table-header': 'thead',
  'table-body': 'tbody',
  'table-row': 'tr',
  'table-head': 'th',
  'table-cell': 'td',
  'table-caption': 'caption',
}

/** `settings.jsx-a11y.components`: every `ui/*` part, so native rules see through the wrapper. */
export function a11yComponents(
  uiSlots: Readonly<Record<string, readonly string[]>>,
): Record<string, string> {
  const slots = Object.values(uiSlots).flat()
  return Object.fromEntries(
    slots.toSorted().map((slot) => [pascal(slot), NATIVE_ELEMENT[slot] ?? 'div']),
  )
}

// ── rules per profile ────────────────────────────────────────────────────────────────────────────

const on = (options: readonly unknown[] | undefined): unknown =>
  options && options.length > 0 ? ['error', ...options] : 'error'

function restyleOptions(profile: PresetProfile, contracts: readonly Contract[]): unknown {
  const bridge = profile === 'bridge'
  return [
    'error',
    {
      allow: ['layout'],
      componentImports: bridge ? BRIDGE_COMPONENT_IMPORTS : PARTS_COMPONENT_IMPORTS,
      contracts: bridge ? [] : contracts,
    },
  ]
}

/** Every rule the preset can set, each `off`: the base a profile's rules are written over. */
function allOff(table: RuleTable): Rules {
  return Object.fromEntries(
    [...Object.keys(table).map((id) => `${PLUGIN_NAME}/${id}`), ...SHADCN_RULES.map(qualified)].map(
      (name) => [name, 'off'],
    ),
  )
}

/** The rules a profile switches on, written over the all-off base so a root can stand any down. */
export function rulesFor(profile: PresetProfile, inputs: PresetInputs): Rules {
  const rules = allOff(inputs.table)
  if (profile === 'tokens') return rules
  const input = presetInput(inputs.table)
  for (const name of input.profiles[profile]) rules[name] = on(input.options[profile][name])
  for (const rule of SHADCN_TOKEN_RULES) rules[qualified(rule)] = 'error'
  rules[qualified(SHADCN_RESTYLE)] = restyleOptions(profile, inputs.contracts)
  return rules
}

// ── zones ────────────────────────────────────────────────────────────────────────────────────────

const offAll = (names: readonly string[]): Rules => Object.fromEntries(names.map((n) => [n, 'off']))

/** Zones E and S: eject transfers structure, never tokens, so only these rules go off. */
function structureZone(files: readonly string[], inputs: PresetInputs): Override {
  const input = presetInput(inputs.table)
  const names = [...new Set([...input.zonesOff.ejected, ...input.zonesOff.seed])]
  return {
    files: [...files],
    rules: {
      ...offAll(names),
      [qualified(SHADCN_RESTYLE)]: 'off',
      [qualified('no-arbitrary-values')]: ['error', { allow: [...BASE_UI_VARS] }],
    },
  }
}

/** Zone V: the console's own shadcn files, where the class rules and the bought rules are off. */
function vendoredZone(files: string, inputs: PresetInputs): Override {
  const input = presetInput(inputs.table)
  return {
    files: [files],
    rules: offAll([...input.zonesOff.vendored, ...SHADCN_RULES.map(qualified)]),
  }
}

const rootGlob = (root: string): string => `${root.replace(/\/+$/, '')}/**`

// ── the preset ───────────────────────────────────────────────────────────────────────────────────

/**
 * The preset for a manifest: the default profile's rules at the top, one `overrides` block per
 * root whose profile differs (E6), then the zone blocks. `undefined` when every file lints at
 * `tokens`: that profile ships no oxlint preset.
 */
export function buildPreset(inputs: PresetInputs): PresetConfig | undefined {
  const roots = Object.entries(inputs.roots ?? {})
  const profiles = [inputs.profile, ...roots.map(([, profile]) => profile)]
  if (profiles.every((profile) => profile === 'tokens')) return undefined

  const overrides: Override[] = []
  // Zone V first: a root at another profile then re-enables its own `components/ui` files.
  if (inputs.profile === 'bridge') overrides.push(vendoredZone(VENDORED_GLOB, inputs))
  for (const [root, profile] of roots) {
    if (profile !== inputs.profile) {
      overrides.push({ files: [rootGlob(root)], rules: rulesFor(profile, inputs) })
    }
  }
  for (const [root, profile] of roots) {
    if (profile === 'bridge')
      overrides.push(vendoredZone(`${rootGlob(root)}/components/ui/**`, inputs))
  }
  const ejected = inputs.ejected ?? []
  if (ejected.length > 0) overrides.push(structureZone(ejected, inputs))
  const seeds = inputs.seeds ?? []
  if (seeds.length > 0) overrides.push(structureZone(seeds, inputs))

  return {
    plugins: ['react', 'typescript', 'jsx-a11y'],
    jsPlugins: [...JS_PLUGINS],
    settings: {
      shadcn: { themeImports: ['^basalt-ui/'] },
      'jsx-a11y': { components: a11yComponents(inputs.uiSlots) },
      basalt: { pins: { oxlint: inputs.pins.oxlint, '@shadcn/lint': inputs.pins.shadcnLint } },
    },
    rules: rulesFor(inputs.profile, inputs),
    overrides,
  }
}

/** The preset a shipped profile writes to `configs/oxlint-<profile>.json`: no roots, no zones E/S. */
export const shippedPreset = (
  profile: (typeof SHIPPED_PROFILES)[number],
  inputs: Omit<PresetInputs, 'profile' | 'roots' | 'ejected' | 'seeds'>,
): PresetConfig => {
  const preset = buildPreset({ ...inputs, profile })
  if (!preset) throw new Error(`no preset for profile ${profile}`)
  return preset
}

// ── oxfmt ────────────────────────────────────────────────────────────────────────────────────────

/** The class-merge helpers whose arguments `sortTailwindcss` reorders (the table's class contexts). */
export const SORTED_FUNCTIONS = ['cn', 'clsx', 'cx', 'cva'] as const

/** The oxfmt options the package's formatter preset starts from. */
export type OxfmtBase = Readonly<Record<string, unknown>>

/** The oxfmt 0.78.0 preset: the base options plus `sortTailwindcss` on the class helpers. */
export const oxfmtPreset = (base: OxfmtBase): Record<string, unknown> => ({
  ...base,
  sortTailwindcss: { functions: [...SORTED_FUNCTIONS] },
})
