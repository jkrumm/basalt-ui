#!/usr/bin/env bun
/**
 * The quality-matrix shards must run the whole matrix (.github/workflows/ci.yml, job `quality-matrix`). Each shard
 * job saves the output of `make quality-matrix BASALT_MATRIX_SHARD=<i>/<n>` to `quality-matrix-shard-<i>.log`. Two
 * things must hold, or a shard silently ran less than its share:
 *   - every shard's bun summary ("Ran X tests across Y files") counts as many files as the matrix directory has
 *     `*.test.ts` files, so no test file of the matrix was skipped or left out of the run;
 *   - the `matrix-shard <i>/<n> ran=K total=T` lines (printed by matrix.test.ts) name each of the n shards once, agree on
 *     T, the cells the matrix has, and their K add up to T.
 *
 * Usage: bun scripts/check-matrix-shards.ts <log-dir> [--shards <n>]   (default 5)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MATRIX = 'packages/basalt-ui/tests/quality/matrix'
const RAN = /Ran (\d+) tests? across (\d+) files?/
const LINE = /^matrix-shard (\d+)\/(\d+) ran=(\d+) total=(\d+)\s*$/m

export interface ShardReport {
  index: number
  count: number
  ran: number
  total: number
  files: number
}

/** What a shard log reports, or null when it lacks the summary or the shard line (a crashed shard). */
export function parseShardLog(log: string): ShardReport | null {
  const ran = RAN.exec(log)
  const line = LINE.exec(log)
  if (!ran || !line) return null
  return {
    index: Number(line[1]),
    count: Number(line[2]),
    ran: Number(line[3]),
    total: Number(line[4]),
    files: Number(ran[2]),
  }
}

export interface ShardCheck {
  ok: boolean
  message: string
}

/** One log per shard; they must be shards 1..n of n, run every matrix file, and run T cells between them. */
export function checkShards(logs: readonly string[], shards: number, files: number): ShardCheck {
  if (logs.length !== shards)
    return { ok: false, message: `${logs.length} shard logs, expected ${shards}` }
  const reports = logs.map(parseShardLog)
  if (reports.some((r) => r === null))
    return {
      ok: false,
      message: 'a shard log has no "Ran X tests across Y files" line or no "matrix-shard" line',
    }
  const found = reports.filter((r): r is ShardReport => r !== null)
  const indexes = found.map((r) => r.index).toSorted((a, b) => a - b)
  if (found.some((r) => r.count !== shards) || indexes.some((index, i) => index !== i + 1))
    return {
      ok: false,
      message: `shard lines name ${found.map((r) => `${r.index}/${r.count}`).join(', ')}, expected 1..${shards} of ${shards}`,
    }
  const short = found.filter((r) => r.files !== files)
  if (short.length > 0)
    return {
      ok: false,
      message: `shard ${short.map((r) => r.index).join(', ')} ran ${short.map((r) => r.files).join(', ')} files, the matrix has ${files}`,
    }
  const total = found[0]?.total ?? 0
  if (total === 0 || found.some((r) => r.total !== total))
    return {
      ok: false,
      message: `shards disagree on the cell count: ${found.map((r) => r.total).join(', ')}`,
    }
  const sum = found.reduce((a, r) => a + r.ran, 0)
  const counts = found.map((r) => r.ran).join(' + ')
  return sum === total
    ? {
        ok: true,
        message: `${shards} shards ran ${sum} cells (${counts}) of ${files} files each, the matrix has ${total}`,
      }
    : { ok: false, message: `shards ran ${sum} cells (${counts}), the matrix has ${total}` }
}

if (import.meta.main) {
  const dir = process.argv[2]
  if (!dir) {
    console.error('usage: bun scripts/check-matrix-shards.ts <log-dir> [--shards <n>]')
    process.exit(2)
  }
  const flag = process.argv.indexOf('--shards')
  const shards = flag > -1 ? Number(process.argv[flag + 1]) : 5
  const logs = readdirSync(dir)
    .filter((f) => /^quality-matrix-shard-.*\.log$/.test(f))
    .toSorted()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
  const files = readdirSync(MATRIX).filter((f) => f.endsWith('.test.ts')).length
  const result = checkShards(logs, shards, files)
  console.log(`check-matrix-shards: ${result.message}`)
  process.exit(result.ok ? 0 : 1)
}
