/**
 * `check-tokens` — the `--basalt-*` name registry check. A typo in a `--basalt-*` name resolves to nothing
 * any linter sees (`bg-(--basalt-typo)`), so every spelling in `.css .tsx .astro .mdx` is checked
 * against the token table's names plus the app-owned `extraNames` (tokens-visual 3.8).
 */
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

import { tokenNames } from '../tokens/emit'
import type { TokenFamily } from '../tokens/table'
import { bridgeEntries, TOKENS } from '../tokens/table'

const SCANNED_EXTENSIONS: ReadonlySet<string> = new Set(['.css', '.tsx', '.astro', '.mdx'])

/** A whole name: a trailing `-` or `${` is a template prefix, not a spelling. */
const BASALT_NAME = /--basalt-[a-z0-9]+(?:-[a-z0-9]+)*(?![\w-]|\$\{)/gi

export type TokenFinding = {
  file: string
  line: number
  name: string
  /** The closest known name within a few edits, when there is one. */
  nearest?: string
}
export type CheckTokensResult = {
  scanned: number
  findings: TokenFinding[]
  /** 0 clean; 1 on an unknown name or when no file was scanned. */
  exitCode: 0 | 1
}

/** How many edits away a name may be and still read as a typo of a token. */
const NEAR = 3

function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        (row[j] ?? 0) + 1,
        (next[j - 1] ?? 0) + 1,
        (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    row = next
  }
  return row[b.length] ?? 0
}

/** The kind a family belongs to: every color role is one kind, a type size is another. */
const KIND_OF_FAMILY: Readonly<Record<TokenFamily, string>> = {
  surface: 'color',
  interaction: 'color',
  line: 'color',
  ink: 'color',
  brand: 'color',
  status: 'color',
  viz: 'color',
  shadow: 'shadow',
  radius: 'radius',
  size: 'size',
  font: 'font',
  weight: 'weight',
  type: 'type',
  motion: 'motion',
  rhythm: 'spacing',
  contract: 'contract',
}

/** Words an author writes for a kind that no token name carries (`--basalt-space-1`). */
const KIND_WORDS: Readonly<Record<string, string>> = {
  space: 'spacing',
  spacing: 'spacing',
  gap: 'spacing',
  margin: 'spacing',
  padding: 'spacing',
  color: 'color',
  // The British spelling an author may write in a token name; basalt's own names never carry it.
  colour: 'color',
}

const segmentsOf = (name: string): string[] => name.replace(/^--basalt-/, '').split('-')

const KINDS_BY_NAME: ReadonlyMap<string, string> = new Map(
  TOKENS.map((t) => [`--basalt-${t.name}`, KIND_OF_FAMILY[t.family]]),
)

/** The one kind every package token carrying `segment` as a name segment has, else undefined. */
function kindOfSegment(segment: string): string | undefined {
  const kinds = new Set<string>()
  for (const [name, kind] of KINDS_BY_NAME) if (segmentsOf(name).includes(segment)) kinds.add(kind)
  return kinds.size === 1 ? [...kinds][0] : undefined
}

/** A step of a size scale (`sm`, `lg`, `2xl`): every scale spells it, so it names no kind. */
const SCALE_STEP = /^(?:\d*x?s|sm|md|lg|\d*x?l)$/

/**
 * The kind an unknown name asks for: its qualifier (last segment, `muted` is a color) beats its head
 * (`text` is a type size), unless the qualifier is a scale step (`--basalt-radius-lg` is a radius, not
 * the type size `text-lg`); a head that is a kind word (`space`) names the kind directly.
 */
export function kindOfName(name: string): string | undefined {
  const known = KINDS_BY_NAME.get(name)
  if (known !== undefined) return known
  const segments = segmentsOf(name)
  const last = segments.at(-1) ?? ''
  const head = segments[0] ?? ''
  const byHead = kindOfSegment(head) ?? KIND_WORDS[head]
  if (SCALE_STEP.test(last) && byHead !== undefined) return byHead
  const byLast = /^\d+$/.test(last) ? undefined : kindOfSegment(last)
  return byLast ?? byHead
}

/** `--basalt-surfaceRaised` as the token table spells names: kebab-case, lower case. */
const kebab = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/**
 * A shadcn role name written as a token (`--basalt-accent`, `--basalt-background`) to the token the theme
 * reads under it (`--color-accent: var(--basalt-hover)`), from the `@theme inline` map.
 */
const ROLE_TOKENS: ReadonlyMap<string, string> = new Map(
  bridgeEntries()
    .filter((e) => e.tw.startsWith('--color-') && e.value === `var(--basalt-${e.token})`)
    .map((e) => [`--basalt-${e.tw.slice('--color-'.length)}`, `--basalt-${e.token}`] as const)
    .filter(([role, token]) => role !== token && !KINDS_BY_NAME.has(role)),
)

/**
 * Names an author writes from another vocabulary, to the token that means it: the bold weight is
 * `strong` (`--basalt-weight-body` is 400), and shadcn's `*-foreground` is the ink or the `on-*` token.
 * Keyed without the `--basalt-` prefix, so the invented names never read as emitted ones
 * (`scripts/gen-basalt-names.ts` collects every quoted `--basalt-*` string in `src/`).
 */
const ALIAS_TOKENS: ReadonlyMap<string, string> = new Map([
  ['weight-bold', 'weight-strong'],
  ['weight-semibold', 'weight-strong'],
  ['weight-normal', 'weight-body'],
  ['accent-foreground', 'on-brand'],
  ['primary-foreground', 'canvas'],
  ['secondary-foreground', 'ink'],
  ['muted-foreground', 'ink-muted'],
  ['card-foreground', 'ink'],
  ['popover-foreground', 'ink'],
])

const aliasOf = (name: string): string | undefined => {
  const alias = name.startsWith('--basalt-')
    ? ALIAS_TOKENS.get(name.slice('--basalt-'.length))
    : undefined
  return alias === undefined ? undefined : `--basalt-${alias}`
}

/**
 * The known name closest to `name` (ties go to the first in sort order), or undefined past `NEAR`.
 * Candidates stay within the kind the name asks for (`--basalt-text-muted` never suggests `--basalt-text-md`);
 * within that kind a token that shares a name segment is near however many edits away, since a role
 * invented beside a real one (`--basalt-brand-500`, `--basalt-space-1`) means it. App-owned names carry no
 * kind and always qualify. A known name the unknown one ends with, on a segment boundary, beats
 * any edit distance: `--basalt-color-brand` is `--basalt-brand` with a prefix added, not `--basalt-on-brand`.
 * Then a candidate of the same family prefix (`radius-`) beats a closer spelling elsewhere.
 *
 * Before the search a camelCase name is folded to kebab-case (`--basalt-surfaceRaised` reads as
 * `--basalt-surface-raised`), and a shadcn role name maps to the token the theme reads under it
 * (`--basalt-accent` is `--basalt-hover`).
 */
export function nearestToken(name: string, known: Iterable<string>): string | undefined {
  const knownSet = new Set(known)
  const folded = kebab(name)
  const alias = aliasOf(folded)
  if (alias !== undefined && knownSet.has(alias)) return alias
  const role = ROLE_TOKENS.get(folded)
  if (role !== undefined && knownSet.has(role)) return role
  if (folded !== name && knownSet.has(folded)) return folded
  const kind = kindOfName(folded)
  const own = new Set(segmentsOf(folded))
  const head = segmentsOf(folded)[0]
  const tail = folded.replace(/^--basalt-/, '')
  let best: string | undefined
  let bestRank: [number, number, number, number] = [Infinity, Infinity, Infinity, Infinity]
  for (const candidate of [...knownSet].toSorted()) {
    const candidateKind = KINDS_BY_NAME.get(candidate)
    if (kind !== undefined && candidateKind !== undefined && candidateKind !== kind) continue
    const distance = editDistance(folded, candidate)
    const shares = kind !== undefined && segmentsOf(candidate).some((s) => own.has(s))
    if (distance > NEAR && !shares) continue
    const suffix = tail.endsWith(`-${candidate.replace(/^--basalt-/, '')}`)
    const sameHead = segmentsOf(candidate)[0] === head
    const prefix = tail.startsWith(candidate.replace(/^--basalt-/, ''))
    // A suffix match ranks first, the longest one first; then the same family prefix; then the fewest
    // edits; then, at equal edits, a known name the unknown one starts with (`--basalt-warning` is
    // `--basalt-warn` lengthened, not `--basalt-spring` at the same distance).
    const rank: [number, number, number, number] = [
      suffix ? -candidate.length : 0,
      sameHead ? 0 : 1,
      distance,
      prefix ? 0 : 1,
    ]
    const better = rank.findIndex((r, i) => r !== bestRank[i])
    if (better !== -1 && rank[better]! < bestRank[better]!) {
      best = candidate
      bestRank = rank
    }
  }
  return best
}

export function packageTokenNames(): Set<string> {
  return new Set(tokenNames())
}

export function checkTokens(input: {
  files: readonly string[]
  extraNames?: readonly string[]
}): CheckTokensResult {
  const known = packageTokenNames()
  for (const extra of input.extraNames ?? []) known.add(extra)
  const findings: TokenFinding[] = []
  let scanned = 0
  for (const file of input.files) {
    if (!SCANNED_EXTENSIONS.has(extname(file))) continue
    scanned += 1
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((text, i) => {
        for (const [name] of text.matchAll(BASALT_NAME)) {
          if (known.has(name)) continue
          const nearest = nearestToken(name, known)
          findings.push({ file, line: i + 1, name, ...(nearest === undefined ? {} : { nearest }) })
        }
      })
  }
  return { scanned, findings, exitCode: scanned === 0 || findings.length > 0 ? 1 : 0 }
}
