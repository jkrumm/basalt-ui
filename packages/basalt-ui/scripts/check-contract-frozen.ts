#!/usr/bin/env bun
/**
 * Contract gate: parallel leads build against frozen types, so a changed contract fails the build
 * unless an explicit amendment row changes the pin (docs/v3/ARCHITECTURE.md section 7.1).
 *
 * `scripts/contract-pins.json` maps a repo-relative file path to the sha256 of that file's bytes.
 *   - A file that differs from its pin (or is missing) fails, naming the file.
 *   - A pin key added relative to the base passes (a new contract file).
 *   - A pin value changed or a key removed relative to the base passes only when a commit in
 *     `<base>..HEAD` has a subject starting `chore: contract amendment`.
 *   - No pin file on the base (or no base ref at all) passes the base comparison.
 *
 * Usage: bun packages/basalt-ui/scripts/check-contract-frozen.ts [--base <ref>] [--root <dir>]
 * The base defaults to `origin/master`. Exit 0 when frozen, 1 on a violation, 2 on a usage error.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PINS_PATH = 'packages/basalt-ui/scripts/contract-pins.json'
export const AMENDMENT_PREFIX = 'chore: contract amendment'

export type Pins = Record<string, string>

export interface FrozenInput {
  /** The pins at HEAD. */
  pins: Pins
  /** The pins on the base, or null when the base has no pin file. */
  basePins: Pins | null
  /** sha256 of a pinned file's bytes at HEAD, or null when the file is missing. */
  hashOf(path: string): string | null
  /** True when a commit in the range carries the amendment subject. */
  amended: boolean
}

export function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Every violation, each naming the file or key; empty when the contract is frozen. */
export function checkFrozen({ pins, basePins, hashOf, amended }: FrozenInput): string[] {
  const failures: string[] = []

  for (const [path, pin] of Object.entries(pins)) {
    const actual = hashOf(path)
    if (actual === null) failures.push(`${path}: pinned file is missing`)
    else if (actual !== pin)
      failures.push(
        `${path}: differs from its pin in ${PINS_PATH} (a contract edit needs a "${AMENDMENT_PREFIX}" commit that updates the pin)`,
      )
  }

  if (basePins === null || amended) return failures

  for (const [path, basePin] of Object.entries(basePins)) {
    if (!(path in pins))
      failures.push(`${path}: pin removed without a "${AMENDMENT_PREFIX}" commit`)
    else if (pins[path] !== basePin)
      failures.push(`${path}: pin changed without a "${AMENDMENT_PREFIX}" commit`)
  }
  return failures
}

function git(root: string, args: string[]): string | null {
  const res = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  return res.status === 0 ? res.stdout : null
}

function parsePins(text: string, where: string): Pins {
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new Error(`${where}: expected an object of path to sha256`)
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') throw new Error(`${where}: ${key} must be a sha256 string`)
  }
  return parsed as Pins
}

export function main(argv: string[]): number {
  let base = 'origin/master'
  let root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if ((flag === '--base' || flag === '--root') && value) {
      if (flag === '--base') base = value
      else root = resolve(value)
      i++
    } else {
      console.error(
        `unknown argument: ${flag}\nusage: check-contract-frozen.ts [--base <ref>] [--root <dir>]`,
      )
      return 2
    }
  }

  const pinsFile = join(root, PINS_PATH)
  if (!existsSync(pinsFile)) {
    console.error(`${PINS_PATH}: missing`)
    return 1
  }
  const pins = parsePins(readFileSync(pinsFile, 'utf8'), PINS_PATH)

  const baseExists = git(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]) !== null
  if (!baseExists)
    console.error(`check-contract-frozen: base ${base} not found, skipping the pin comparison`)
  const baseText = baseExists ? git(root, ['show', `${base}:${PINS_PATH}`]) : null
  const basePins = baseText === null ? null : parsePins(baseText, `${base}:${PINS_PATH}`)
  const subjects = baseExists ? (git(root, ['log', `${base}..HEAD`, '--format=%s']) ?? '') : ''
  const amended = subjects.split('\n').some((subject) => subject.startsWith(AMENDMENT_PREFIX))

  const failures = checkFrozen({
    pins,
    basePins,
    amended,
    hashOf: (path) => {
      const file = join(root, path)
      return existsSync(file) ? sha256(readFileSync(file)) : null
    },
  })

  if (failures.length > 0) {
    console.error(`check-contract-frozen: ${failures.length} violation(s)`)
    for (const failure of failures) console.error(`  ${failure}`)
    return 1
  }
  console.log(`check-contract-frozen: ${Object.keys(pins).length} pinned file(s) frozen`)
  return 0
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
