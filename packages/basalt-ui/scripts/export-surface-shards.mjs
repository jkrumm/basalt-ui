/**
 * Export-surface shards — one generated JSON file per published JS subpath under
 * scripts/export-surface/, so parallel changes touch disjoint files. Shared by export-surface.mjs
 * (check + `--update`) and every reader of the snapshot (budgets, grace, doc drift, release gate).
 *
 * A shard is `<name>.json` holding that subpath's sorted export names as a JSON array. `<name>` is
 * the subpath without `./`, with `.` as `index` and `/` as `__`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SHARD_EXT = '.json'

/** `.` → `index`, `./charts` → `charts`, `./ui/button` → `ui__button`. */
export function shardName(subpath) {
  if (subpath === '.') return 'index'
  return subpath.replace(/^\.\//, '').replaceAll('/', '__')
}

/** The shard file name for a subpath (`./charts` → `charts.json`). */
export function shardFile(subpath) {
  return `${shardName(subpath)}${SHARD_EXT}`
}

/** Inverse of {@link shardFile}; undefined for a file that is not a shard. */
export function subpathOfShardFile(file) {
  if (!file.endsWith(SHARD_EXT)) return undefined
  const name = file.slice(0, -SHARD_EXT.length)
  return name === 'index' ? '.' : `./${name.replaceAll('__', '/')}`
}

/**
 * Shard files (`[file name, JSON text]`) → `Record<subpath, names[]>`. The single parse path, so a
 * reader of a git tag's blobs and a reader of the working tree agree.
 */
export function parseShards(files) {
  const surface = {}
  for (const [file, text] of files) {
    const subpath = subpathOfShardFile(file)
    if (subpath === undefined) continue
    surface[subpath] = JSON.parse(text)
  }
  return surface
}

/** Read every shard in `dir` into the `Record<subpath, names[]>` shape; `{}` when `dir` is absent. */
export function readShards(dir) {
  if (!existsSync(dir)) return {}
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(SHARD_EXT))
    .toSorted()
    .map((f) => [f, readFileSync(join(dir, f), 'utf8')])
  return parseShards(files)
}

/** A shard's on-disk text: the sorted names as a JSON array. */
export function serializeShard(names) {
  return `${JSON.stringify(names, null, 2)}\n`
}

/**
 * Drift between the committed shards (`expected`) and the built surface (`actual`), one message per
 * drifted shard, each naming the shard file. Empty means no drift. A subpath with no shard and a
 * shard with no subpath are drift too.
 */
export function diffShards(expected, actual) {
  const failures = []
  for (const subpath of [
    ...new Set([...Object.keys(expected), ...Object.keys(actual)]),
  ].toSorted()) {
    const file = `export-surface/${shardFile(subpath)}`
    const want = expected[subpath]
    const got = actual[subpath]
    if (want === undefined) {
      failures.push(`${file}: no shard for published subpath ${subpath}`)
      continue
    }
    if (got === undefined) {
      failures.push(`${file}: orphan shard, ${subpath} is not a published subpath`)
      continue
    }
    const missing = want.filter((k) => !got.includes(k))
    const added = got.filter((k) => !want.includes(k))
    if (missing.length > 0) failures.push(`${file}: missing exports: ${missing.join(', ')}`)
    if (added.length > 0) failures.push(`${file}: unsnapshotted exports: ${added.join(', ')}`)
    if (
      missing.length === 0 &&
      added.length === 0 &&
      serializeShard(want) !== serializeShard(got)
    ) {
      failures.push(`${file}: names are not the sorted, unique list`)
    }
  }
  return failures
}
