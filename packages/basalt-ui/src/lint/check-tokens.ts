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

export type TokenFinding = { file: string; line: number; name: string }
export type CheckTokensResult = {
  scanned: number
  findings: TokenFinding[]
  /** 0 clean; 1 on an unknown name or when no file was scanned. */
  exitCode: 0 | 1
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
          if (!known.has(name)) findings.push({ file, line: i + 1, name })
        }
      })
  }
  return { scanned, findings, exitCode: scanned === 0 || findings.length > 0 ? 1 : 0 }
}
