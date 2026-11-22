#!/usr/bin/env bun
/**
 * A git merge driver for generated JSON whose lines are keys (`.gitattributes`: `merge=basalt-json`), such as
 * apps/marketing's `.basalt/manifest.json`, one digest line per managed file. Git's line merge conflicts when two
 * branches change neighbouring lines, so two branches that edit two neighbouring skill files conflicted in the
 * manifest on every rebase though their changes never touch. This merges the three versions key by key: a key one
 * side changed takes that side, a key both changed alike takes it, a key both changed apart is a real conflict and
 * falls back to git's line merge with markers. The result is written in the file's own canonical form (two-space
 * JSON, maps sorted where both sides kept them sorted).
 *
 *   bun scripts/merge-json.ts %O %A %B     the driver: base, ours (written in place), theirs; exit 0 merged, 1 conflict
 *   bun scripts/merge-json.ts --install    register the driver in this clone's git config (`bun install` runs it)
 *
 * Without the driver registered git merges the file line by line, as before.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type Obj = { [key: string]: Json }

const CONFLICT = Symbol('conflict')

const isObj = (v: Json | undefined): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const same = (a: Json | undefined, b: Json | undefined): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

const isSorted = (keys: readonly string[]): boolean =>
  keys.every((k, i) => i === 0 || keys[i - 1]!.localeCompare(k) <= 0)

/** The three-way merge of one value; `undefined` is a key that is absent. */
export function merge3(
  base: Json | undefined,
  ours: Json | undefined,
  theirs: Json | undefined,
): Json | undefined | typeof CONFLICT {
  if (same(ours, theirs)) return ours
  if (same(base, ours)) return theirs
  if (same(base, theirs)) return ours
  if (!isObj(ours) || !isObj(theirs)) return CONFLICT
  const b = isObj(base) ? base : {}
  const keys = [...Object.keys(ours), ...Object.keys(theirs).filter((k) => !(k in ours))]
  const sort = isSorted(Object.keys(ours)) && isSorted(Object.keys(theirs))
  const out: Obj = {}
  for (const key of sort ? keys.toSorted((x, y) => x.localeCompare(y)) : keys) {
    const v = merge3(b[key], ours[key], theirs[key])
    if (v === CONFLICT) return CONFLICT
    if (v !== undefined) out[key] = v
  }
  return out
}

const canonical = (v: Json): string => `${JSON.stringify(v, null, 2)}\n`

/** The merged text, or null when the three cannot be merged key by key (a real conflict, or a file not canonical). */
export function mergeText(base: string, ours: string, theirs: string): string | null {
  let parsed: [Json, Json, Json]
  try {
    parsed = [JSON.parse(base), JSON.parse(ours), JSON.parse(theirs)]
  } catch {
    return null
  }
  if (canonical(parsed[1]) !== ours || canonical(parsed[2]) !== theirs) return null
  const merged = merge3(...parsed)
  return merged === CONFLICT || merged === undefined ? null : canonical(merged)
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args[0] === '--install') {
    const set = (key: string, value: string) =>
      spawnSync('git', ['config', key, value], { stdio: 'ignore' }).status === 0
    const ok =
      set('merge.basalt-json.name', 'generated JSON merged key by key (scripts/merge-json.ts)') &&
      set('merge.basalt-json.driver', 'bun scripts/merge-json.ts %O %A %B')
    if (!ok) console.error('merge-json: not a git checkout; the driver is not registered')
    process.exit(0)
  }
  const [base, ours, theirs] = args
  if (!base || !ours || !theirs) {
    console.error('usage: bun scripts/merge-json.ts <base> <ours> <theirs> | --install')
    process.exit(2)
  }
  const merged = mergeText(
    readFileSync(base, 'utf8'),
    readFileSync(ours, 'utf8'),
    readFileSync(theirs, 'utf8'),
  )
  if (merged !== null) {
    writeFileSync(ours, merged)
    process.exit(0)
  }
  // A real conflict: git's own line merge, markers and all, so the lead sees both sides.
  const line = spawnSync('git', ['merge-file', ours, base, theirs], { stdio: 'inherit' })
  process.exit(line.status === 0 ? 0 : 1)
}
