/**
 * The eject rows of check 11 (primitives-distribution section 6): every `manifest.ejected` row has
 * its file, header, guard, base and tsconfig `paths` row; seed and guard match the installed
 * package; no conflict marker or dropped `data-slot` is left in the file; the `ejects` and
 * `adopted` counts sit within `.basalt/budget.json`; and every `<root>/components/ui/*.tsx` has a
 * row. Each finding names the command or edit that fixes it.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { SLOTS } from '../../ui/slots'
import { BUDGET_PATH } from '../budget'
import type { Budget } from '../budget'
import { basePath, countRows, rowsOfRoot } from '../eject/ledger'
import type { EjectedRow } from '../eject/ledger'
import { appTsconfig } from '../eject/tsconfig'
import { parseHeader } from '../merge/header'
import { ejectedGuard, readSeed } from '../merge/seed'
import { parseJsonc } from '../source-text'
import { filesUnder, readText, rootsOf } from './types'
import type { Ctx } from './types'

const SYNC = 'run `basalt-ui sync`'
const MARKER = /^(?:<{7}|\|{7}|>{7})(?: |$)/m

const uiDir = (root: string): string => (root === '.' ? 'components/ui' : `${root}/components/ui`)
const guardOf = (path: string): string => path.replace(/\.tsx$/, '.guard.ts')

/** The tsconfig eject wrote the `paths` row into: the nearest one at or above the root. */
function tsconfigOf(ctx: Ctx, root: string): string | null {
  for (let dir = resolve(ctx.root, root); ; dir = dirname(dir)) {
    const found = appTsconfig(dir)
    if (found !== null) return found
    if (dir === ctx.root || !dir.startsWith(ctx.root)) return null
  }
}

function hasPathsRow(tsconfig: string, name: string): boolean {
  const options = parseJsonc(readFileSync(tsconfig, 'utf8'))?.['compilerOptions']
  const paths = (options as { paths?: unknown } | undefined)?.paths
  return typeof paths === 'object' && paths !== null && `basalt-ui/ui/${name}` in paths
}

/** Slots of `name` the file no longer names as a string outside its own `<name>Parts` list. */
function droppedSlots(name: string, text: string): string[] {
  const slots = (SLOTS as Record<string, readonly string[]>)[name] ?? []
  const body = text.replace(/export const [A-Za-z]+Parts = \[[^\]]*\] as const/, '')
  return slots.filter((slot) => !body.includes(`'${slot}'`) && !body.includes(`"${slot}"`))
}

function rowFindings(ctx: Ctx, root: string, name: string, row: EjectedRow): string[] {
  const findings: string[] = []
  const text = readText(ctx.root, row.path)
  if (text === null) {
    findings.push(
      `ejected ${row.path} is missing: restore it from git, or \`basalt-ui eject --undo ${name}\``,
    )
  } else {
    if (parseHeader(text.split('\n', 1)[0] ?? '')?.name !== name) {
      findings.push(
        `${row.path} lost its header: line 1 must be \`// basalt:ejected ${name}@${row.fromVersion} <why>\``,
      )
    }
    const marker = MARKER.exec(text)
    if (marker !== null) {
      const line = text.slice(0, marker.index).split('\n').length
      findings.push(`${row.path}:${line} holds conflict markers: resolve them and commit`)
    }
    for (const slot of droppedSlots(name, text)) {
      findings.push(
        `${row.path} dropped the data-slot "${slot}" SLOTS lists for ${name}: render it again (slot names are frozen)`,
      )
    }
  }
  if (row.reason.trim() === '') findings.push(`ejected ${row.path} carries no reason`)
  if (row.origin === 'local') return findings

  const base = basePath(root, name)
  if (!existsSync(resolve(ctx.root, base))) {
    findings.push(
      `${base} (the merge base of ${row.path}) is missing: restore it from git (\`git checkout -- ${base}\`)`,
    )
  }
  const tsconfig = tsconfigOf(ctx, root)
  if (tsconfig === null || !hasPathsRow(tsconfig, name)) {
    findings.push(
      `${tsconfig === null ? `no tsconfig at or above ${root}` : tsconfig.slice(ctx.root.length + 1)} has no paths row "basalt-ui/ui/${name}" -> ${row.path}: add it to compilerOptions.paths`,
    )
  }
  const seed = readSeed(ctx.pkgRoot, name)
  if (seed === null) {
    findings.push(
      `${row.path}: the installed basalt-ui ships no ${name}; \`basalt-ui eject --undo ${name}\``,
    )
    return findings
  }
  if (row.seedDigest !== seed.digest) {
    findings.push(`${row.path} was ejected from another seed than the installed one: ${SYNC}`)
  }
  const guard = seed.guard === null ? null : ejectedGuard(seed.guard, name)
  if (guard !== null && 'text' in guard) {
    const local = readText(ctx.root, guardOf(row.path))
    if (local === null) findings.push(`${guardOf(row.path)} is missing: ${SYNC}`)
    else if (local !== guard.text) {
      findings.push(`${guardOf(row.path)} differs from the shipped guard: ${SYNC}`)
    }
  }
  return findings
}

/** Every eject finding, with the per-root `ejects` and `adopted` checked against the budget. */
export function ejectFindings(ctx: Ctx, budget: Budget): string[] {
  const manifest = ctx.manifest
  if (manifest === null) return []
  const findings: string[] = []
  const keyed = new Set<string>()
  for (const [root] of rootsOf(manifest)) {
    const { rows, bad } = rowsOfRoot(manifest, root)
    for (const key of bad) findings.push(`ejected ${key} is malformed: fix or remove the row`)
    const counts = countRows(rows)
    for (const field of ['ejects', 'adopted'] as const) {
      if (counts[field] > budget[field]) {
        findings.push(
          `${counts[field]} ${field} is above the ceiling ${budget[field]} in ${BUDGET_PATH} (root ${root}): \`basalt-ui eject --undo <name>\`, or raise it with \`--raise "<named consumer>"\``,
        )
      }
    }
    const paths = new Set<string>()
    for (const [name, row] of rows) {
      keyed.add(`${root}#${name}`)
      paths.add(row.path)
      findings.push(...rowFindings(ctx, root, name, row))
    }
    for (const file of filesUnder(ctx.root, uiDir(root), /\.tsx$/)) {
      if (file.split('/').length !== uiDir(root).split('/').length + 1) continue
      if (file.endsWith('.test.tsx') || paths.has(file)) continue
      findings.push(
        `${file} is not in manifest.ejected: adopt it (\`basalt-ui eject --adopt ${file} --reason "<why>"\`) or delete it`,
      )
    }
  }
  for (const key of Object.keys(manifest.ejected)) {
    if (!keyed.has(key) && !findings.some((f) => f.includes(key))) {
      findings.push(`ejected ${key} belongs to no declared root`)
    }
  }
  return findings
}
