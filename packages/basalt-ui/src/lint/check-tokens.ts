/**
 * `check-tokens` — the `--vx-*` name registry check. A typo in a `--vx-*` name resolves to nothing
 * any linter sees (`bg-(--vx-typo)`), so every spelling in `.css .tsx .astro .mdx` is checked
 * against the token table's names plus the app-owned `extraNames` (tokens-visual 3.8).
 */
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

import { tokenNames } from '../tokens/emit'
import type { TokenFamily } from '../tokens/table'
import { TOKENS } from '../tokens/table'

const SCANNED_EXTENSIONS: ReadonlySet<string> = new Set(['.css', '.tsx', '.astro', '.mdx'])

/** A whole name: a trailing `-` or `${` is a template prefix, not a spelling. */
const VX_NAME = /--vx-[a-z0-9]+(?:-[a-z0-9]+)*(?![\w-]|\$\{)/gi

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

/** The kind a family belongs to: every colour role is one kind, a type size is another. */
const KIND_OF_FAMILY: Readonly<Record<TokenFamily, string>> = {
  surface: 'colour',
  interaction: 'colour',
  line: 'colour',
  ink: 'colour',
  brand: 'colour',
  status: 'colour',
  viz: 'colour',
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

/** Words an author writes for a kind that no token name carries (`--vx-space-1`). */
const KIND_WORDS: Readonly<Record<string, string>> = {
  space: 'spacing',
  spacing: 'spacing',
  gap: 'spacing',
  margin: 'spacing',
  padding: 'spacing',
  color: 'colour',
  colour: 'colour',
}

const segmentsOf = (name: string): string[] => name.replace(/^--vx-/, '').split('-')

const KINDS_BY_NAME: ReadonlyMap<string, string> = new Map(
  TOKENS.map((t) => [`--vx-${t.name}`, KIND_OF_FAMILY[t.family]]),
)

/** The one kind every package token carrying `segment` as a name segment has, else undefined. */
function kindOfSegment(segment: string): string | undefined {
  const kinds = new Set<string>()
  for (const [name, kind] of KINDS_BY_NAME) if (segmentsOf(name).includes(segment)) kinds.add(kind)
  return kinds.size === 1 ? [...kinds][0] : undefined
}

/**
 * The kind an unknown name asks for: its qualifier (last segment, `muted` is a colour) beats its head
 * (`text` is a type size); a head that is a kind word (`space`) names the kind directly.
 */
export function kindOfName(name: string): string | undefined {
  const known = KINDS_BY_NAME.get(name)
  if (known !== undefined) return known
  const segments = segmentsOf(name)
  const last = segments.at(-1) ?? ''
  const head = segments[0] ?? ''
  const byLast = /^\d+$/.test(last) ? undefined : kindOfSegment(last)
  return byLast ?? kindOfSegment(head) ?? KIND_WORDS[head]
}

/**
 * The known name closest to `name` (ties go to the first in sort order), or undefined past `NEAR`.
 * Candidates stay within the kind the name asks for (`--vx-text-muted` never suggests `--vx-text-md`);
 * within that kind a token that shares a name segment is near however many edits away, since a role
 * invented beside a real one (`--vx-brand-500`, `--vx-space-1`) means it. App-owned names carry no
 * kind and always qualify. A known name the unknown one ends with, on a segment boundary, beats
 * any edit distance: `--vx-color-brand` is `--vx-brand` with a prefix added, not `--vx-on-brand`.
 */
export function nearestToken(name: string, known: Iterable<string>): string | undefined {
  const kind = kindOfName(name)
  const own = new Set(segmentsOf(name))
  const tail = name.replace(/^--vx-/, '')
  let best: string | undefined
  let bestRank: [number, number] = [Infinity, Infinity]
  for (const candidate of [...known].toSorted()) {
    const candidateKind = KINDS_BY_NAME.get(candidate)
    if (kind !== undefined && candidateKind !== undefined && candidateKind !== kind) continue
    const distance = editDistance(name, candidate)
    const shares = kind !== undefined && segmentsOf(candidate).some((s) => own.has(s))
    if (distance > NEAR && !shares) continue
    const suffix = tail.endsWith(`-${candidate.replace(/^--vx-/, '')}`)
    // A suffix match ranks first, the longest one first; then the fewest edits.
    const rank: [number, number] = [suffix ? -candidate.length : 0, distance]
    if (rank[0] < bestRank[0] || (rank[0] === bestRank[0] && rank[1] < bestRank[1])) {
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
        for (const [name] of text.matchAll(VX_NAME)) {
          if (known.has(name)) continue
          const nearest = nearestToken(name, known)
          findings.push({ file, line: i + 1, name, ...(nearest === undefined ? {} : { nearest }) })
        }
      })
  }
  return { scanned, findings, exitCode: scanned === 0 || findings.length > 0 ? 1 : 0 }
}
