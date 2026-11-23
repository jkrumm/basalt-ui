/**
 * `sync` on added blocks (`basalt-ui add`, docs/v3/BENCHMARK-ACCORDEE-BLUEPRINT.md section 6): the
 * eject path's three-way merge, run per file of a block whose shipped digest moved. A local edit
 * survives or stops on diff3 markers; it is never silently lost. Per `origin: 'block'` row:
 *
 * - A file the app never edited takes the shipped bytes; an edited one goes through `merge`
 *   (formatter, `git merge-file --diff3`, labels `local`, `base@<from>`, `shipped@<to>`).
 * - A file new upstream is written when absent; when the app already has a file there, it is
 *   merged against an empty base, so every difference is a conflict to resolve by hand.
 * - A file the block no longer ships stays in the app, untracked; its base is deleted.
 * - A file the app deleted stays deleted.
 * - The bases, `files`, `fromVersion` and `seedDigest` advance even on a conflict, as for an eject,
 *   so a second run finds nothing to do instead of stacking markers.
 *
 * It adds to the eject plan, so `--check`, the exit code and the writes are one.
 */
import { blockBasePath, readBlockRow } from '../eject/ledger'
import type { BlockRow } from '../eject/ledger'
import { readBlock } from '../add/catalog'
import type { Block } from '../add/catalog'
import { resolveFormatter } from '../merge/formatter'
import type { Formatter } from '../merge/formatter'
import type { Manifest } from '../manifest'
import { merge, read } from './three-way'
import type { EjectedPlan, EjectedWrite } from './three-way'

type Input = { root: string; manifest: Manifest; pkgRoot: string; version: string }

const BLOCK_KEY = /^(.*)#block:([a-z][a-z0-9-]*)$/

/** Adds every block row's writes, lines and ledger update to `plan`; reads the tree, writes nothing. */
export function planBlocks({ root, manifest, pkgRoot, version }: Input, plan: EjectedPlan): void {
  let resolved: Formatter | null | undefined
  const formatter = (): Formatter | null => (resolved ??= resolveFormatter(root))
  let mergedRaw = false
  const error = (line: string): void => {
    plan.errors.push(line)
    plan.lines.push(`✖ ${line}`)
  }

  for (const key of Object.keys(manifest.ejected).toSorted()) {
    const value = manifest.ejected[key] ?? {}
    if (value['origin'] !== 'block') continue
    const match = BLOCK_KEY.exec(key)
    const row = readBlockRow(value)
    if (match === null || row === null) {
      error(`manifest.ejected["${key}"] is malformed; fix or remove the row`)
      continue
    }
    const [, blockRoot = '', name = ''] = match
    const block = readBlock(pkgRoot, name)
    if (block === null) {
      error(
        `${row.path}: the block ${name} is no longer shipped; the files are yours, remove manifest.ejected["${key}"] to stop tracking them`,
      )
      continue
    }
    if ('error' in block) {
      error(`${row.path}: ${block.error}`)
      continue
    }
    if (row.seedDigest === block.digest) continue

    const step = planBlock({ root, blockRoot, name, row, block, version, formatter })
    if ('error' in step) {
      error(step.error)
      continue
    }
    mergedRaw ||= step.raw
    plan.work++
    plan.writes.push(...step.writes)
    plan.conflicts.push(...step.conflicts)
    plan.lines.push(...step.lines)
    plan.ejected[key] = {
      ...row,
      files: block.files,
      fromVersion: version,
      seedDigest: block.digest,
    } satisfies BlockRow
  }
  if (mergedRaw) {
    plan.lines.push(
      'no project formatter resolved (oxfmt, prettier or biome in package.json with its bin installed): merged raw',
    )
  }
}

type Step =
  | { writes: EjectedWrite[]; lines: string[]; conflicts: string[]; raw: boolean }
  | { error: string }

type BlockInput = {
  root: string
  blockRoot: string
  name: string
  row: BlockRow
  block: Block
  version: string
  formatter: () => Formatter | null
}

/** One block's file-by-file plan; an error leaves the whole block untouched. */
function planBlock({ root, blockRoot, name, row, block, version, formatter }: BlockInput): Step {
  const writes: EjectedWrite[] = []
  const lines: string[] = []
  const conflicts: string[] = []
  let raw = false
  const span = `${row.fromVersion} -> ${version}`
  const labels = { base: `base@${row.fromVersion}`, shipped: `shipped@${version}` }
  const had = new Set(row.files)

  for (const file of block.files) {
    const path = `${row.path}/${file}`
    const base = blockBasePath(blockRoot, name, file)
    const shipped = block.sources.get(file) ?? ''
    const local = read(root, path)
    writes.push({ path: base, content: shipped })
    if (!had.has(file) && local === null) {
      writes.push({ path, content: shipped })
      lines.push(`added ${path}: new in the block (${span})`)
      continue
    }
    if (had.has(file) && local === null) {
      lines.push(`kept ${path} deleted: removed in the app, so the block's change is not applied`)
      continue
    }
    const from = had.has(file) ? read(root, base) : ''
    if (from === null) {
      return {
        error: `${base} is missing, so ${path} has nothing to merge; restore it from git`,
      }
    }
    const merged = merge(local as string, from, shipped, labels, formatter, path)
    if ('error' in merged) return { error: `${path}: ${merged.error}` }
    raw ||= merged.raw
    if (merged.text !== local) writes.push({ path, content: merged.text })
    if (merged.conflicts > 0) {
      conflicts.push(path)
      lines.push(
        `✖ conflict ${path} (${span}): ${merged.conflicts} conflict(s), markers labelled local, ${labels.base}, ${labels.shipped}; resolve them, the base already advanced`,
      )
    } else {
      lines.push(`merged ${path} (${span})`)
    }
  }
  const kept = new Set(block.files)
  for (const file of row.files.filter((f) => !kept.has(f))) {
    writes.push({ path: blockBasePath(blockRoot, name, file), content: null })
    lines.push(`kept ${row.path}/${file}: the block no longer ships it, so it is untracked now`)
  }
  return { writes, lines, conflicts, raw }
}
