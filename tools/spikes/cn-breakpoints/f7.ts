/**
 * F7: every `sm:`, `lg:`, `max-` and `min-` use in the consumers, plus seeded dead and live classes,
 * judged against the v3 reset and flagged by a standalone `no-unknown-classes` matcher.
 */
import { extractTokens } from './classes'
import { parse, siteRef } from './scan'
import type { RepoName, ScannedRepo, SiteRef } from './scan'

export type UseKind = 'sm' | 'lg' | 'max-variant' | 'min-variant' | 'max-utility' | 'min-utility'
export const USE_KINDS: UseKind[] = [
  'sm',
  'lg',
  'max-variant',
  'min-variant',
  'max-utility',
  'min-utility',
]

function splitTop(s: string, sep: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '[' || ch === '(') depth++
    if (ch === ']' || ch === ')') depth--
    if (ch === sep && depth === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  parts.push(cur)
  return parts
}

export function kindsOf(token: string): UseKind[] {
  const parts = splitTop(token, ':')
  const utility = (parts.at(-1) ?? '').replace(/^!/, '').replace(/^-/, '')
  const variants = parts.slice(0, -1)
  const kinds = new Set<UseKind>()
  for (const v of variants) {
    if (v === 'sm') kinds.add('sm')
    else if (v === 'lg') kinds.add('lg')
    else if (v.startsWith('max-')) kinds.add('max-variant')
    else if (v.startsWith('min-')) kinds.add('min-variant')
  }
  if (utility.startsWith('max-')) kinds.add('max-utility')
  if (utility.startsWith('min-')) kinds.add('min-utility')
  return USE_KINDS.filter((k) => kinds.has(k))
}

export interface Use {
  repo: RepoName
  file: string
  line: number
  text: string
  kinds: UseKind[]
}

/** A class token, not a partial template piece or a stray string. */
const CLASS_SHAPED = /^[!\w@*:[\](){}#%.,'/=&>~+-]+$/

export function collectUses(repo: ScannedRepo): Use[] {
  const uses: Use[] = []
  for (const file of repo.files) {
    for (const t of extractTokens(parse(file))) {
      if (t.partial || t.text.includes('${') || !CLASS_SHAPED.test(t.text)) continue
      if (t.text.endsWith('-') || t.text.endsWith(':')) continue
      const kinds = kindsOf(t.text)
      if (kinds.length > 0) {
        uses.push({ repo: repo.def.name, file: file.rel, line: t.line, text: t.text, kinds })
      }
    }
  }
  return uses
}

/**
 * The standalone matcher: a class is unknown iff no selector of the emitted CSS carries it.
 * (`emitted` is the class set of a build over every candidate; nothing here knows Tailwind.)
 */
export function noUnknownClasses(classes: string[], emitted: Set<string>): string[] {
  return classes.filter((c) => !emitted.has(c))
}

/** Seeded dead under the v3 reset: breakpoints that are gone and vocabulary that was reset. */
export const SEEDED_DEAD = [
  'sm:hidden',
  'lg:hidden',
  '2xl:hidden',
  'max-sm:hidden',
  'min-lg:hidden',
  'max-w-screen-sm',
  'text-xl',
  'bg-red-500',
  'shadow-md',
  'rounded-lg',
] as const

/** Seeded live controls: the two kept breakpoints and kept vocabulary. */
export const SEEDED_LIVE = [
  'md:hidden',
  'xl:hidden',
  'max-md:hidden',
  'min-xl:hidden',
  'max-w-2xl',
  'text-md',
  'bg-card',
  'text-good',
  'p-4',
  'min-h-row',
] as const

export interface DeadSite {
  ref: SiteRef | null
  kinds: UseKind[]
}

export function deadSites(
  repo: ScannedRepo,
  uses: Use[],
  dead: Set<string>,
): { occurrences: number; refs: SiteRef[] } {
  const hit = uses.filter((u) => dead.has(u.text))
  const refs = hit.flatMap((u) => {
    const r = siteRef(u.repo, repo.visibility, u.file, u.line)
    return r ? [r] : []
  })
  return { occurrences: hit.length, refs }
}
