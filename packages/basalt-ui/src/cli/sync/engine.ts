/**
 * The placement engine: compare what `render.ts` produced with the tree, then (not under `--check`)
 * write the difference. Render-then-compare on raw bytes, no normalisation. A managed file is
 * `current` when its bytes equal the render, `stale` when they differ but still hash to the digest
 * `sync` recorded (the render moved, nobody edited), `edited` otherwise: never clobbered without
 * `--force` (invariant 24, guardrails E1). A generated file has no local content worth keeping.
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { Manifest } from '../manifest'
import { scanBlock, spliceBlock } from './block'
import type { Unit } from './render'

export const AGENTS_FILE = 'AGENTS.md'

export type State = 'current' | 'missing' | 'stale' | 'edited'
export type Item = Unit & { state: State }
export type Retired = { path: string; state: 'untouched' | 'edited' | 'gone' }
export type Plan = {
  items: Item[]
  retired: Retired[]
  block: { state: Exclude<State, 'edited'>; text: string } | { error: string }
}

export const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex')

const readText = (root: string, path: string): string | null => {
  try {
    return readFileSync(resolve(root, path), 'utf8')
  } catch {
    return null
  }
}

function stateOf(unit: Unit, current: string | null, digest: string | undefined): State {
  if (current === null) return 'missing'
  if (current === unit.content) return 'current'
  return unit.generated === true || digest === sha256(current) ? 'stale' : 'edited'
}

/** Reads the tree under `root`; writes nothing. */
export function planSync(root: string, manifest: Manifest, units: Unit[], block: string): Plan {
  const items = units.map((unit) => ({
    ...unit,
    state: stateOf(unit, readText(root, unit.path), manifest.managed[unit.path]),
  }))
  const wanted = new Set(units.map((unit) => unit.path))
  const retired = Object.entries(manifest.managed)
    .filter(([path]) => !wanted.has(path))
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([path, digest]): Retired => {
      const current = readText(root, path)
      const state = current === null ? 'gone' : sha256(current) === digest ? 'untouched' : 'edited'
      return { path, state }
    })

  const host = readText(root, AGENTS_FILE) ?? ''
  const scan = scanBlock(host, AGENTS_FILE)
  if (typeof scan === 'object' && 'error' in scan) return { items, retired, block: scan }
  const text = spliceBlock(host, scan, block)
  const state = scan === 'absent' ? 'missing' : text === host ? 'current' : 'stale'
  return { items, retired, block: { state, text } }
}

/** Every path a plan would change; `--check` is red on any, a locally edited file included. */
export function differences(plan: Plan): string[] {
  const how = { missing: 'missing', stale: 'out of date', edited: 'edited locally', current: '' }
  const lines = plan.items
    .filter((i) => i.state !== 'current')
    .map((i) => `${i.path}: ${how[i.state]}`)
  for (const r of plan.retired) {
    if (r.state !== 'gone')
      lines.push(`${r.path}: retired${r.state === 'edited' ? ' (edited locally)' : ''}`)
  }
  if ('state' in plan.block && plan.block.state !== 'current') {
    lines.push(`${AGENTS_FILE}: basalt block ${how[plan.block.state]}`)
  }
  return lines
}

export type Applied = { written: number; removed: number; left: string[]; manifest: Manifest }

function put(root: string, path: string, content: string): void {
  mkdirSync(dirname(resolve(root, path)), { recursive: true })
  writeFileSync(resolve(root, path), content)
}

/** Removes a file, then each parent directory it leaves empty, up to (not including) `root`. */
function remove(root: string, path: string): void {
  rmSync(resolve(root, path), { force: true })
  for (let dir = dirname(resolve(root, path)); dir !== root; dir = dirname(dir)) {
    if (!existsSync(dir) || readdirSync(dir).length > 0) return
    rmdirSync(dir)
  }
}

/** Writes a plan with no block error. `force` finishes edited managed files and edited retired ones. */
export function applySync(root: string, manifest: Manifest, plan: Plan, force: boolean): Applied {
  const next: Manifest = { ...manifest, managed: { ...manifest.managed } }
  const applied: Applied = { written: 0, removed: 0, left: [], manifest: next }
  for (const item of plan.items) {
    if (item.state === 'edited' && !force) applied.left.push(item.path)
    else {
      if (item.state !== 'current') {
        put(root, item.path, item.content)
        applied.written++
      }
      if (item.generated !== true) next.managed[item.path] = sha256(item.content)
    }
  }
  for (const { path, state } of plan.retired) {
    if (state === 'edited' && !force) applied.left.push(path)
    else {
      if (state !== 'gone') {
        remove(root, path)
        applied.removed++
      }
      delete next.managed[path]
    }
  }
  if ('state' in plan.block && plan.block.state !== 'current') {
    put(root, AGENTS_FILE, plan.block.text)
    applied.written++
  }
  return applied
}
