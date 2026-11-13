/**
 * The rule table: the one source for basalt's own lint ids, the preset input, the
 * `<!-- basalt:coverage -->` block, the generated reference and the known-id list that rejects an
 * unknown waiver id (guardrails sections 4, 9, 10). 2.x kept five hand-synced registries and they
 * drifted; every list below is derived from the table, never typed beside it.
 *
 * A rule family (class, import-bypass, structure) declares its ids with `defineRules` in its own
 * module and adds one line to `FAMILIES` in `./index.ts`; `mergeTables` then enforces the ceiling
 * across all of them.
 */
import type { FormContext, Visitor } from './factory'

/** Guardrails section 1: 18 own ids, 16 planned. Raising it is an owner decision (DPO 15). */
export const ID_CEILING = 18

/** The plugin namespace every id is reported and waived under: `basalt/<id>`. */
export const PLUGIN_NAME = 'basalt'

/** `tokens` has no oxlint preset; `repo` ships in no preset (basalt-ui's own dogfood only). */
export type Profile = 'bridge' | 'parts' | 'app' | 'repo'
export const PROFILES: readonly Profile[] = ['bridge', 'parts', 'app', 'repo']

/** Zones a rule can be off in (section 6). Zone A, app code, switches nothing off. */
export type Zone = 'ejected' | 'seed' | 'vendored'
export const ZONES: readonly Zone[] = ['ejected', 'seed', 'vendored']

export type Family = 'class' | 'import' | 'structure'

type FormBase = {
  /** Kebab-case, unique within its rule; the diagnostic's messageId. */
  readonly id: string
  /** The fix the message names: a token, component or step, never only "not allowed". */
  readonly fix: string
  /** The next rung of the bending ladder when the fix does not fit. */
  readonly next: string
  /** One fixture file per form, unique across the table: the form count is this list. */
  readonly fixture: string
  /** `false` builds the form but runs nothing; the coverage block prints it as `not guarded:`. */
  readonly enabled?: boolean
  /** Required when `enabled` is false: why the form is off and what turns it on. */
  readonly reason?: string
}

/** A form `classPatternRule` runs: `pattern` is tested against each class token. */
export type ClassForm = FormBase & { readonly pattern: RegExp; readonly detect?: never }

/** A form with its own AST detector; it reports through `ctx.report` with this form's message. */
export type AstForm = FormBase & {
  readonly detect: (ctx: FormContext) => Visitor
  readonly pattern?: never
}

export type Form = ClassForm | AstForm

export type RuleEntry = {
  readonly family: Family
  readonly profiles: readonly Profile[]
  readonly zonesOff?: readonly Zone[]
  /** The recorded defect or reproduced trap the rule stops (section 1.3: no record, no rule). */
  readonly defect: string
  /** May be empty for an id registered ahead of its body; coverage then says `not guarded:`. */
  readonly forms: readonly Form[]
  /** JSON schema of the rule's options (ESLint rejects options a rule declares no schema for). */
  readonly schema?: readonly unknown[]
  /**
   * Rule options the preset writes for a profile, in the rule's option-array shape. A profile
   * absent here gets none. `tw-off-law` stands its parts-only forms down on `{ profile: 'bridge' }`.
   */
  readonly profileOptions?: Readonly<Partial<Record<Profile, readonly unknown[]>>>
}

export type RuleTable = Readonly<Record<string, RuleEntry>>

export class RuleTableError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid rule table:\n- ${problems.join('\n- ')}`)
    this.name = 'RuleTableError'
  }
}

const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const BARE_DENIAL = /^\s*(?:not allowed|forbidden|disallowed|banned|invalid|don'?t|do not)\.?\s*$/i

export const isClassForm = (form: Form): form is ClassForm => form.pattern !== undefined
export const isEnabled = (form: Form): boolean => form.enabled !== false

function formProblems(ruleId: string, form: Form): string[] {
  const at = `${ruleId}/${form.id}`
  const problems: string[] = []
  if (!KEBAB.test(form.id)) problems.push(`${at}: form id is not kebab-case`)
  for (const field of ['fix', 'next'] as const) {
    const text = form[field]?.trim() ?? ''
    if (text === '') problems.push(`${at}: no ${field} text`)
    else if (BARE_DENIAL.test(text)) problems.push(`${at}: ${field} names no fix ("${text}")`)
    else if (text.includes('{{')) problems.push(`${at}: ${field} must not contain "{{"`)
  }
  const fixture = form.fixture?.trim() ?? ''
  if (fixture === '') problems.push(`${at}: no fixture path`)
  else if (fixture.startsWith('/') || fixture.split('/').includes('..')) {
    problems.push(`${at}: fixture path must be relative to the fixtures root`)
  }
  if (form.enabled === false && (form.reason?.trim() ?? '') === '') {
    problems.push(`${at}: a disabled form needs a reason`)
  }
  const hasPattern = form.pattern !== undefined
  const hasDetect = form.detect !== undefined
  if (hasPattern === hasDetect) problems.push(`${at}: needs exactly one of pattern or detect`)
  if (form.pattern && /[gy]/.test(form.pattern.flags)) {
    problems.push(`${at}: pattern must not be global or sticky (lastIndex carries between tokens)`)
  }
  return problems
}

function tableProblems(entries: readonly (readonly [string, RuleEntry])[]): string[] {
  const problems: string[] = []
  const seenIds = new Set<string>()
  const seenFixtures = new Map<string, string>()
  for (const [id, entry] of entries) {
    if (seenIds.has(id)) problems.push(`${id}: duplicate rule id`)
    seenIds.add(id)
    if (!KEBAB.test(id)) problems.push(`${id}: rule id is not kebab-case`)
    if (entry.profiles.length === 0) problems.push(`${id}: no profile`)
    for (const profile of Object.keys(entry.profileOptions ?? {}) as Profile[]) {
      if (!PROFILES.includes(profile))
        problems.push(`${id}: options for unknown profile "${profile}"`)
      else if (!entry.profiles.includes(profile)) {
        problems.push(`${id}: options for profile "${profile}", which does not run the rule`)
      }
      if (entry.schema === undefined) problems.push(`${id}: profile options need a schema`)
    }
    for (const profile of entry.profiles) {
      if (!PROFILES.includes(profile)) problems.push(`${id}: unknown profile "${profile}"`)
    }
    for (const zone of entry.zonesOff ?? []) {
      if (!ZONES.includes(zone)) problems.push(`${id}: unknown zone "${zone}"`)
    }
    if (entry.defect.trim() === '') problems.push(`${id}: no recorded defect`)
    const formIds = new Set<string>()
    for (const form of entry.forms) {
      if (formIds.has(form.id)) problems.push(`${id}/${form.id}: duplicate form id`)
      formIds.add(form.id)
      problems.push(...formProblems(id, form))
      const owner = seenFixtures.get(form.fixture)
      if (owner) problems.push(`${id}/${form.id}: fixture ${form.fixture} already used by ${owner}`)
      else seenFixtures.set(form.fixture, `${id}/${form.id}`)
    }
  }
  if (seenIds.size > ID_CEILING) {
    problems.push(`${seenIds.size} ids exceed the ceiling of ${ID_CEILING}`)
  }
  return problems
}

function assertValid(entries: readonly (readonly [string, RuleEntry])[]): void {
  const problems = tableProblems(entries)
  if (problems.length > 0) throw new RuleTableError(problems)
}

/** Declare one family's ids. Throws `RuleTableError` naming every problem at once. */
export function defineRules<const T extends Record<string, RuleEntry>>(table: T): Readonly<T> {
  assertValid(Object.entries(table))
  return Object.freeze(table)
}

/** Join the families into the one table; a rule id in two families or a 19th id throws. */
export function mergeTables(tables: readonly RuleTable[]): RuleTable {
  const entries = tables.flatMap((table) => Object.entries(table))
  assertValid(entries)
  return Object.freeze(Object.fromEntries(entries))
}

export const ruleIds = (table: RuleTable): string[] => Object.keys(table)

/** The ids a waiver may name; a directive naming anything else is rejected, not ignored. */
export const knownWaiverIds = (table: RuleTable): string[] =>
  ruleIds(table).map((id) => `${PLUGIN_NAME}/${id}`)

export const isKnownWaiverId = (table: RuleTable, id: string): boolean =>
  knownWaiverIds(table).includes(id)

/** The gated form count (E2): one per enabled form's fixture. Disabled forms are not counted. */
export const formCount = (table: RuleTable): number =>
  new Set(
    Object.values(table).flatMap((entry) =>
      entry.forms.filter(isEnabled).map((form) => form.fixture),
    ),
  ).size

export type PresetInput = {
  readonly plugin: typeof PLUGIN_NAME
  /** Qualified rule names (`basalt/<id>`) enabled per profile, in table order. */
  readonly profiles: Readonly<Record<Profile, readonly string[]>>
  /** Rule options per profile, keyed by qualified name; only rules that declare some appear. */
  readonly options: Readonly<Record<Profile, Readonly<Record<string, readonly unknown[]>>>>
  /** Qualified rule names switched off per zone, for the preset's `overrides`. */
  readonly zonesOff: Readonly<Record<Zone, readonly string[]>>
}

/** What the preset generator (v3-gr-4) reads; it never lists an id by hand. */
export function presetInput(table: RuleTable): PresetInput {
  const qualified = (id: string): string => `${PLUGIN_NAME}/${id}`
  const entries = Object.entries(table)
  const byProfile = (profile: Profile): string[] =>
    entries.filter(([, e]) => e.profiles.includes(profile)).map(([id]) => qualified(id))
  const byZone = (zone: Zone): string[] =>
    entries.filter(([, e]) => e.zonesOff?.includes(zone)).map(([id]) => qualified(id))
  const optionsFor = (profile: Profile): Record<string, readonly unknown[]> =>
    Object.fromEntries(
      entries.flatMap(([id, e]) => {
        const options = e.profileOptions?.[profile]
        return options && e.profiles.includes(profile) ? [[qualified(id), options]] : []
      }),
    )
  return {
    plugin: PLUGIN_NAME,
    options: {
      bridge: optionsFor('bridge'),
      parts: optionsFor('parts'),
      app: optionsFor('app'),
      repo: optionsFor('repo'),
    },
    profiles: {
      bridge: byProfile('bridge'),
      parts: byProfile('parts'),
      app: byProfile('app'),
      repo: byProfile('repo'),
    },
    zonesOff: { ejected: byZone('ejected'), seed: byZone('seed'), vendored: byZone('vendored') },
  }
}

export const COVERAGE_START = '<!-- basalt:coverage -->'
export const COVERAGE_END = '<!-- /basalt:coverage -->'

/**
 * The `<!-- basalt:coverage -->` block for a doc. `ids` narrows it to the rules a doc teaches;
 * `advisory` adds laws the doc states and nothing guards. Every disabled form and every id with no
 * live form prints as `not guarded:`, so the block never claims coverage that does not run.
 */
export function renderCoverage(input: {
  table: RuleTable
  ids?: readonly string[]
  advisory?: readonly string[]
}): string {
  const ids = input.ids ?? ruleIds(input.table)
  const guarded: string[] = []
  const notGuarded: string[] = []
  for (const id of ids) {
    const entry = input.table[id]
    if (!entry) throw new RuleTableError([`${id}: not in the rule table`])
    const live = entry.forms.filter(isEnabled)
    if (live.length > 0) {
      guarded.push(`${PLUGIN_NAME}/${id} (${live.map((form) => form.id).join(', ')})`)
    } else if (entry.forms.length === 0) {
      notGuarded.push(`${PLUGIN_NAME}/${id}: no live form yet`)
    }
    for (const form of entry.forms.filter((f) => !isEnabled(f))) {
      notGuarded.push(`${PLUGIN_NAME}/${id}/${form.id}: ${form.reason?.trim()}`)
    }
  }
  notGuarded.push(...(input.advisory ?? []))
  return [
    COVERAGE_START,
    '<!-- GENERATED from src/lint/rule-table.ts. Do not hand-edit. -->',
    `<!-- guarded: ${guarded.length > 0 ? guarded.join(' · ') : '—'} -->`,
    ...notGuarded.map((line) => `<!-- not guarded: ${line} -->`),
    COVERAGE_END,
  ].join('\n')
}

/** Replace the coverage block inside `doc`; a doc without exactly one block throws. */
export function spliceCoverage(doc: string, block: string): string {
  const occurrences = (marker: string): number => doc.split(marker).length - 1
  const start = doc.indexOf(COVERAGE_START)
  const end = doc.indexOf(COVERAGE_END)
  if (occurrences(COVERAGE_START) !== 1 || occurrences(COVERAGE_END) !== 1 || end < start) {
    throw new RuleTableError(['doc needs exactly one coverage block'])
  }
  return doc.slice(0, start) + block + doc.slice(end + COVERAGE_END.length)
}

const cell = (text: string): string => text.replaceAll('|', '\\|').replaceAll('\n', ' ')

/** The generated rule reference: one row per form, never a hand table. */
export function renderReference(table: RuleTable): string {
  const rows = Object.entries(table).flatMap(([id, entry]) => {
    const profiles = entry.profiles.join(', ')
    if (entry.forms.length === 0) return [`| \`${PLUGIN_NAME}/${id}\` | — | ${profiles} | — | — |`]
    return entry.forms.map((form) => {
      const fix = isEnabled(form) ? cell(form.fix) : `off: ${cell(form.reason ?? '')}`
      return `| \`${PLUGIN_NAME}/${id}\` | ${form.id} | ${profiles} | ${fix} | ${cell(form.next)} |`
    })
  })
  return ['| Rule | Form | Profiles | Fix | Next |', '|-|-|-|-|-|', ...rows].join('\n')
}
