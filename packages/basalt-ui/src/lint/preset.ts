/**
 * The oxlint preset, built from the rule table (guardrails sections 6, 9, 10): which ids run at
 * which profile, the options each profile writes, the zones a rule is off in, the shadcn rules and
 * the jsx-a11y component map. Nothing here lists an id or an option by hand; `presetInput(table)`
 * is the one source and `scripts/gen-oxlint.ts` writes the result to `configs/oxlint-<profile>.json`.
 *
 * Pure data in, config out: the generator reads the files (pins, contracts, `SLOTS`) and passes
 * them in, so `sync` can call the same builder with a manifest's roots and ejected paths.
 */
import { zoneAPremixed, zoneATokenClasses } from './generated/zone-a'
import type { Profile, RuleTable } from './rule-table'
import { PLUGIN_NAME, presetInput } from './rule-table'

/** `tokens` has no oxlint preset (guardrails section 6); the other four ship as files. */
export type PresetProfile = 'tokens' | 'bridge' | 'parts' | 'app' | 'site'
export const SHIPPED_PROFILES = [
  'bridge',
  'parts',
  'app',
  'site',
] as const satisfies readonly Profile[]

/** The five bought token rules every shipped profile runs. */
export const SHADCN_TOKEN_RULES = [
  'no-raw-colors',
  'no-arbitrary-values',
  'no-unknown-classes',
  'no-inline-styles',
  'require-static-classes',
] as const
export const SHADCN_RESTYLE = 'no-restyle'

/**
 * Core oxlint rules a profile runs (not the plugin's): `no-use-before-define` at `parts` and `app`
 * flags a binding read before its declaration, a closure above a later `const` included (n18's
 * `announce` read a `const` three lines below it and threw on the first focus). Functions, classes
 * and types hoist, so they stay allowed. A closure that provably runs later (a submit handler
 * clearing a draft built below it) is the one shape it reports falsely: waive that line with a
 * reason. They are managed ids like the plugin's (`isManagedRuleId`).
 */
export const CORE_RULES: Readonly<Record<string, readonly [string, ...unknown[]]>> = {
  'no-use-before-define': [
    'error',
    { functions: false, classes: false, typedefs: false, variables: true },
  ],
}

/**
 * The preset's whole rule list: the plugin's (`basalt/*`), shadcn's (`shadcn/*`) and `CORE_RULES`,
 * which oxlint also spells `eslint/<id>`. `doctor` check 11 refuses one set by hand in
 * `.oxlintrc.json`, and the waiver budget counts a reasoned waiver of one.
 */
export function isManagedRuleId(id: string): boolean {
  if (id.startsWith('basalt/') || id.startsWith('shadcn/')) return true
  return Object.hasOwn(CORE_RULES, id.replace(/^eslint\//, ''))
}
const CORE_PROFILES: readonly PresetProfile[] = ['parts', 'app']
const SHADCN_RULES = [...SHADCN_TOKEN_RULES, SHADCN_RESTYLE] as const

/** The npm specifiers oxlint loads as JS plugins; the shipped file extends from a consumer's tree. */
export const JS_PLUGINS = ['basalt-ui/lint', '@shadcn/lint'] as const

/** `no-restyle` recognises primitives by import specifier: basalt's own at parts and app. */
export const PARTS_COMPONENT_IMPORTS = ['^basalt-ui/ui/'] as const
/** At bridge it recognises only the app's own `components/ui` (zone V is where they live). */
export const BRIDGE_COMPONENT_IMPORTS = ['(?:^|/)components/ui(?:/|$)'] as const
/** At site, basalt's own primitives and static parts: the site parts are basalt's, never a restyle. */
export const SITE_COMPONENT_IMPORTS = ['^basalt-ui/(?:ui|static)/'] as const
/** The profiles that carry bridge's shape: bridge's rule options, no restyle contracts, zone V. */
const BRIDGE_LIKE: readonly PresetProfile[] = ['bridge', 'site']
const componentImportsAt = (profile: PresetProfile): readonly string[] =>
  profile === 'bridge'
    ? BRIDGE_COMPONENT_IMPORTS
    : profile === 'site'
      ? SITE_COMPONENT_IMPORTS
      : PARTS_COMPONENT_IMPORTS
/**
 * Zones E and S: a rule that stays on but loses single forms there gets `formsOff` in its options,
 * written per profile so the options the profile gives the rule (`bridge`'s gate) are kept.
 */
function formZones(files: readonly string[], inputs: PresetInputs): Override[] {
  const input = presetInput(inputs.table)
  const formsOff: Record<string, string[]> = {}
  for (const zone of ['ejected', 'seed'] as const) {
    for (const [name, ids] of Object.entries(input.formsOff[zone])) {
      formsOff[name] = [...new Set([...(formsOff[name] ?? []), ...ids])]
    }
  }
  const byProfile = new Map<PresetProfile, string[]>()
  for (const file of files) {
    const profile = profileOfPath(file, inputs)
    byProfile.set(profile, [...(byProfile.get(profile) ?? []), file])
  }
  return [...byProfile].flatMap(([profile, group]) => {
    if (profile === 'tokens') return []
    const rules: Rules = {}
    for (const [name, ids] of Object.entries(formsOff)) {
      if (!input.profiles[profile].includes(name)) continue
      rules[name] = ['error', { ...(input.options[profile][name]?.[0] as object), formsOff: ids }]
    }
    return Object.keys(rules).length > 0 ? [{ files: group, rules }] : []
  })
}

/** Zone V: the console's own shadcn files, a bridge-only zone (section 6). */
export const VENDORED_GLOB = '**/components/ui/**'

/**
 * `no-arbitrary-values` passes a grid track list: `grid-cols-[auto_1fr]` carries no length. A length
 * inside one is `basalt/tw-off-law` `track-length`'s. An entry with `:` is a full-token glob, so the
 * variant spellings are listed too.
 */
export const GRID_TRACKS = [
  'grid-cols-[*]',
  'grid-rows-[*]',
  '*:grid-cols-[*]',
  '*:grid-rows-[*]',
] as const

/**
 * `no-unknown-classes` leaves a viewport variant to `basalt/viewport-keyed`: its advice (declare it
 * with `@custom-variant`) would re-add what that rule bans, and the token would be reported twice. An
 * entry with `:` is a full-token glob, so each breakpoint is listed bare and behind any other variant.
 */
const VIEWPORT_VARIANTS = ['sm', 'md', 'lg', 'xl', '2xl'].flatMap((bp) => [
  bp,
  `max-${bp}`,
  `min-${bp}`,
])
export const VIEWPORT_ALLOW = [...VIEWPORT_VARIANTS, 'min-[*]', 'max-[*]'].flatMap((variant) => [
  `${variant}:*`,
  `*:${variant}:*`,
])

/**
 * `no-raw-colors` reads `shadow-<anything>` as a color utility and flags the shadow sizes; the
 * sizes are not colors. `shadow-<color>` stays checked. Limit: the rule cannot tell a type step
 * (`text-title`) from a color name, so an unknown `text-*` is still called out as a color.
 */
const SHADOW_SIZES = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'inner', 'none'].map(
  (size) => `shadow-${size}`,
)

/**
 * A pre-mixed token carries its alpha already; `basalt/tw-off-law` `alpha-on-premixed` owns the
 * `bg-accent/60` report, so `no-raw-colors` lets the pre-mixed theme classes through (an entry
 * matches the token without its `/NN` modifier). The names are the theme's (`accent`, `border`),
 * never the token's (`hover`, `hairline`): `bg-hover` is no class.
 */
const PREMIXED_ALPHA = zoneAPremixed.map((name) => `*-${name}`)

/**
 * A `--basalt-*` token name written as a class (`bg-hover`, `bg-canvas`) is no class: the theme reads the
 * token under another name. Both color messages print the class for each such token (lint-4.14),
 * generated from the `@theme inline` map, so `bg-hover` is told `bg-accent`, not its nearest spelling.
 */
const TOKEN_CLASSES = `Token names are not classes: ${Object.entries(zoneATokenClasses)
  .map(([token, cls]) => `${token} is ${cls}`)
  .join(', ')}.`

/** oxlint validates a JS plugin's options against its schema: shadcn caps `message` at 500 characters. */
export const SHADCN_MESSAGE_MAX = 500

/**
 * The `message` option of the bought rules, where the rule's own advice names a fix another shipped
 * rule reports (lint-1.16): `use margin here` against app-spacing, `w-120` against fixed-width, a new
 * `--color-<name>` against the derived palette, `declare it with @utility` against the stylesheet's
 * at-rule ban (lint-3.12). `{{suggestions|...}}` is a universal slot, so it never prints raw.
 *
 * Bridge's `no-raw-colors` names its fix by role and prints no `{{suggestions}}` (lint-4.13): shadcn
 * picks them by color distance alone and keeps the token's variants (`withBase`), so `dark:bg-gray-900`
 * got `dark:bg-primary` (dark-fork), `text-gray-400` got `text-dim-bar` (status-fill-as-text) and a
 * border got `border-seq-1`, and the rule takes no option to filter them. The role list holds only
 * classes the bridge class forms pass.
 */
export const SHADCN_MESSAGES: Readonly<
  Partial<Record<PresetProfile, Readonly<Record<string, string | Record<string, string>>>>>
> = (() => {
  const owned = {
    'no-restyle': {
      spacing:
        '"{{className}}" is not allowed on <{{component}}>: it owns its spacing. Use its size prop if it has one, or gap-* on the parent for space around it.',
    },
    // One string for every kind of value (the option takes no per-kind form), so it names the fix by kind;
    // only a spacing value takes a ladder step, which is what app-spacing would reject on a margin.
    'no-arbitrary-values':
      '"{{className}}" hardcodes an off-token value. By kind: a color comes from Status, Lozenge, DeltaBadge or a Num tone; overflow is ui/scroll-area, or the page owns the scroll; space around an element is gap on the parent; a spacing value is a step of the spacing ladder (integers, halves below 4); a width belongs to the parent container, and one computed from data is BarList, ui/progress or ui/meter.',
    'no-raw-colors': `"{{className}}" is no color the theme declares. ${TOKEN_CLASSES} Otherwise app color comes from Status, Lozenge, DeltaBadge or a Num tone; the palette is derived, so no color is declared per app. A shadow or a type step is not a color: check its spelling.`,
    // One string for the four reports (a property, a dynamic object, a raw color in a custom
    // property, a `<style>` element). shadcn's own text sends a dynamic value to a custom property,
    // which this rule does not read: a bar sized through one (`w-(--w)`, `grow-(--g)`) is
    // `basalt/primitive-bypass`'s html-data-marks, so this text claims no custom-property route
    // (lint-5.6, lint-10.4).
    'no-inline-styles':
      'An inline style sets a value outside the design system. A bar, column or mark sized from data is BarList from basalt-ui/cards, ui/progress, ui/meter or a chart kind; any other value is a class, or a theme token in CSS.',
    // One string for the unknown class and the unknown variant; `rounded-card` is surface-recipe's to report.
    'no-unknown-classes': `"{{className}}" is no class or variant this project's Tailwind knows. ${TOKEN_CLASSES} Nearest spelling: {{suggestions|none}}. A radius is rounded-ctrl or rounded-chip; a card surface is owned by Card and Inset; no class or variant is declared per app.`,
  }
  const bridge = {
    'no-raw-colors': `"{{className}}" is a raw color. Use one theme class with no dark: variant (tokens switch per scheme): ink is text-foreground or text-muted-foreground, status text text-good or text-brand, a surface bg-background, bg-card or bg-popover, a line border-border. ${TOKEN_CLASSES} No color is added per app.`,
  }
  return { bridge, site: bridge, parts: owned, app: owned }
})()

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
  /** Zone B: `manifest.bespoke`, directories that draw their own surface. */
  readonly bespoke?: readonly string[]
  /** `manifest.classPrefixes`: third-party class prefixes (`maplibregl-`) `no-unknown-classes` lets through. */
  readonly classPrefixes?: readonly string[]
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
  'copy-button': 'button',
  input: 'input',
  'password-input': 'input',
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
  const message = SHADCN_MESSAGES[profile]?.[SHADCN_RESTYLE]
  return [
    'error',
    {
      allow: ['layout'],
      ...(message === undefined ? {} : { message }),
      componentImports: componentImportsAt(profile),
      contracts: BRIDGE_LIKE.includes(profile) ? [] : contracts,
    },
  ]
}

/** A bought token rule at a profile: `error`, with the options it carries there. */
function shadcnRule(profile: PresetProfile, rule: string, inputs: PresetInputs): unknown {
  const message = SHADCN_MESSAGES[profile]?.[rule]
  const options: Record<string, unknown> = {}
  if (rule === 'no-arbitrary-values') options['allow'] = [...GRID_TRACKS]
  // It finds a design-system component as `no-restyle` does; with no option it reads only a
  // components.json ui directory, which a basalt app has none of, and never fires (lint-8.6).
  if (rule === 'require-static-classes')
    options['componentImports'] = [...componentImportsAt(profile)]
  if (rule === 'no-raw-colors') options['allow'] = [...SHADOW_SIZES, ...PREMIXED_ALPHA]
  if (rule === 'no-unknown-classes') {
    const prefixes = inputs.classPrefixes ?? []
    options['allow'] = [...VIEWPORT_ALLOW, ...prefixes.flatMap((p) => [`${p}*`, `*:${p}*`])]
  }
  if (message !== undefined) options['message'] = message
  return on(Object.keys(options).length > 0 ? [options] : undefined)
}

/** Every rule the preset can set, each `off`: the base a profile's rules are written over. */
function allOff(table: RuleTable): Rules {
  return Object.fromEntries(
    [
      ...Object.keys(table).map((id) => `${PLUGIN_NAME}/${id}`),
      ...SHADCN_RULES.map(qualified),
      ...Object.keys(CORE_RULES),
    ].map((name) => [name, 'off']),
  )
}

/** The rules a profile switches on, written over the all-off base so a root can stand any down. */
export function rulesFor(profile: PresetProfile, inputs: PresetInputs): Rules {
  const rules = allOff(inputs.table)
  if (profile === 'tokens') return rules
  const input = presetInput(inputs.table)
  for (const name of input.profiles[profile]) rules[name] = on(input.options[profile][name])
  for (const rule of SHADCN_TOKEN_RULES) rules[qualified(rule)] = shadcnRule(profile, rule, inputs)
  rules[qualified(SHADCN_RESTYLE)] = restyleOptions(profile, inputs.contracts)
  if (CORE_PROFILES.includes(profile))
    for (const [name, setting] of Object.entries(CORE_RULES)) rules[name] = [...setting]
  return rules
}

// ── zones ────────────────────────────────────────────────────────────────────────────────────────

const offAll = (names: readonly string[]): Rules => Object.fromEntries(names.map((n) => [n, 'off']))

/**
 * Zones E and S: eject transfers structure, never tokens. The file is the primitive, so the rules that
 * police how a primitive is built from structure go off: the ones in the table, `no-restyle`, and the
 * bought `no-arbitrary-values`, `no-inline-styles` (a primitive's geometry is calc, anchor and
 * position values and a virtualised list's measured height) and `require-static-classes` (a seed
 * builds its classes with `cva` and merges the caller's `className`, the shape that rule cannot
 * read). The color rules stay on.
 */
function structureZone(files: readonly string[], inputs: PresetInputs): Override {
  const input = presetInput(inputs.table)
  const names = [...new Set([...input.zonesOff.ejected, ...input.zonesOff.seed])]
  return {
    files: [...files],
    rules: {
      ...offAll(names),
      [qualified(SHADCN_RESTYLE)]: 'off',
      [qualified('no-arbitrary-values')]: 'off',
      [qualified('no-inline-styles')]: 'off',
      [qualified('require-static-classes')]: 'off',
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

/** The profile an ejected file lints at: its longest declared root, else the default. */
function profileOfPath(path: string, inputs: PresetInputs): PresetProfile {
  const own = Object.entries(inputs.roots ?? {})
    .filter(
      ([root]) => root === '.' || path === root || path.startsWith(`${root.replace(/\/+$/, '')}/`),
    )
    .toSorted(([a], [b]) => b.length - a.length)[0]
  return own?.[1] ?? inputs.profile
}

/**
 * Zone B for `manifest.bespoke`: a directory that draws its own surface (a game table, a seating
 * plan) positions and draws marks from state, so the forms marked off in `bespoke` (positioned
 * geometry, hand-drawn marks) go off in `formsOff` for its files, per the profile its files lint at.
 * Every other rule and form stays on, `shadcn/no-inline-styles` included: a mark is placed through a
 * custom property a class reads (`left-(--x)`), not an inline `left`.
 */
function bespokeZones(dirs: readonly string[], inputs: PresetInputs): Override[] {
  const input = presetInput(inputs.table)
  return dirs.flatMap((dir) => {
    const profile = profileOfPath(dir, inputs)
    if (profile === 'tokens') return []
    const rules: Rules = {}
    for (const [name, ids] of Object.entries(input.formsOff.bespoke)) {
      if (!input.profiles[profile].includes(name)) continue
      rules[name] = ['error', { ...(input.options[profile][name]?.[0] as object), formsOff: ids }]
    }
    return Object.keys(rules).length > 0 ? [{ files: [rootGlob(dir)], rules }] : []
  })
}

/**
 * Zone E for `manifest.ejected`: the structure block, plus `import-boundary` told which files are
 * owned copies (so a copy may hold its own `@base-ui` import) where that rule runs at all.
 */
function ejectedZones(ejected: readonly string[], inputs: PresetInputs): Override[] {
  const zones = [structureZone(ejected, inputs), ...formZones(ejected, inputs)]
  const boundary = ejected.filter((path) => {
    const profile = profileOfPath(path, inputs)
    return profile === 'parts' || profile === 'app'
  })
  if (boundary.length > 0) {
    zones.push({
      files: boundary,
      rules: { [`${PLUGIN_NAME}/import-boundary`]: ['error', { ejected: boundary }] },
    })
  }
  return zones
}

// ── the preset ───────────────────────────────────────────────────────────────────────────────────

/**
 * TanStack file routes keep their component unexported (an exported one is not code-split) beside
 * `export const Route`; `react/only-export-components` warns on that, so it is off under `routes/`.
 */
const ROUTE_FILE_OVERRIDE: Override = {
  files: ['**/routes/**'],
  rules: { 'react/only-export-components': 'off' },
}

/**
 * The preset for a manifest: the default profile's rules at the top, one `overrides` block per
 * root whose profile differs (E6), then the zone blocks. `undefined` when every file lints at
 * `tokens`: that profile ships no oxlint preset.
 */
export function buildPreset(inputs: PresetInputs): PresetConfig | undefined {
  const roots = Object.entries(inputs.roots ?? {})
  const profiles = [inputs.profile, ...roots.map(([, profile]) => profile)]
  if (profiles.every((profile) => profile === 'tokens')) return undefined

  // Route files keep their component unexported so the router splits it; the rule would warn on `Route`.
  const overrides: Override[] = [ROUTE_FILE_OVERRIDE]
  // Zone V first: a root at another profile then re-enables its own `components/ui` files.
  if (BRIDGE_LIKE.includes(inputs.profile)) overrides.push(vendoredZone(VENDORED_GLOB, inputs))
  for (const [root, profile] of roots) {
    if (profile !== inputs.profile) {
      overrides.push({ files: [rootGlob(root)], rules: rulesFor(profile, inputs) })
    }
  }
  for (const [root, profile] of roots) {
    if (BRIDGE_LIKE.includes(profile))
      overrides.push(vendoredZone(`${rootGlob(root)}/components/ui/**`, inputs))
  }
  // Zone B before E and S: an ejected file inside a bespoke directory keeps the rule off.
  overrides.push(...bespokeZones(inputs.bespoke ?? [], inputs))
  const ejected = inputs.ejected ?? []
  if (ejected.length > 0) overrides.push(...ejectedZones(ejected, inputs))
  const seeds = inputs.seeds ?? []
  if (seeds.length > 0) overrides.push(structureZone(seeds, inputs), ...formZones(seeds, inputs))

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

/** The preset a shipped profile writes to `configs/oxlint-<profile>.json`: no roots, no zones E/S/B. */
export const shippedPreset = (
  profile: (typeof SHIPPED_PROFILES)[number],
  inputs: Omit<PresetInputs, 'profile' | 'roots' | 'ejected' | 'seeds' | 'bespoke'>,
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
