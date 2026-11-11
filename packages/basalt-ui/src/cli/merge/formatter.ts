/**
 * The project formatter `sync` runs over the merge inputs of an ejected file (CE3): a seed in one
 * style and a local copy run through the consumer's formatter otherwise conflict on every upstream
 * change. Nothing formatted is hashed or stored. Resolution: the first of oxfmt, prettier and biome
 * the project declares (a dependency in its package.json) whose local bin exists in a
 * `node_modules/.bin` at or above it. Null means none: the caller merges raw and says so.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { hasDependency } from '../source-text'

export type Formatter = { name: 'oxfmt' | 'prettier' | 'biome'; bin: string; dir: string }

const CANDIDATES = [
  { name: 'oxfmt', pkg: 'oxfmt', bin: 'oxfmt' },
  { name: 'prettier', pkg: 'prettier', bin: 'prettier' },
  { name: 'biome', pkg: '@biomejs/biome', bin: 'biome' },
] as const

function findBin(from: string, bin: string): string | null {
  let dir = from
  for (;;) {
    const path = join(dir, 'node_modules', '.bin', bin)
    if (existsSync(path)) return path
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function resolveFormatter(projectDir: string): Formatter | null {
  for (const candidate of CANDIDATES) {
    if (!hasDependency(projectDir, candidate.pkg)) continue
    const bin = findBin(projectDir, candidate.bin)
    if (bin !== null) return { name: candidate.name, bin, dir: projectDir }
  }
  return null
}

const STDIN_ARGS: Record<Formatter['name'], (file: string) => string[]> = {
  oxfmt: (file) => [`--stdin-filepath=${file}`],
  prettier: (file) => ['--stdin-filepath', file],
  biome: (file) => ['format', `--stdin-file-path=${file}`],
}

/**
 * `text` formatted as if it were `filePath` (relative to the project, so the project's config and
 * parser apply), or null when the formatter fails on it.
 */
export function formatText(formatter: Formatter, text: string, filePath: string): string | null {
  const run = spawnSync(formatter.bin, STDIN_ARGS[formatter.name](filePath), {
    cwd: formatter.dir,
    input: text,
    encoding: 'utf8',
  })
  return run.status === 0 ? run.stdout : null
}
