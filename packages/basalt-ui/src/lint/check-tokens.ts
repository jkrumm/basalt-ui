/**
 * `check-tokens` — the `--vx-*` name registry check. A typo in a `--vx-*` name resolves to nothing
 * any linter sees (`bg-(--vx-typo)`), so every spelling in `.css .tsx .astro .mdx` is checked
 * against the token table's names plus the app-owned `extraNames` (tokens-visual 3.8).
 */
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

import { tokenNames } from '../tokens/emit'

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

/** The known name closest to `name` (ties go to the first in sort order), or undefined past `NEAR`. */
export function nearestToken(name: string, known: Iterable<string>): string | undefined {
  let best: string | undefined
  let bestDistance = NEAR + 1
  for (const candidate of [...known].toSorted()) {
    const distance = editDistance(name, candidate)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
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
