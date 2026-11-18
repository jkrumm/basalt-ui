#!/usr/bin/env bun
/**
 * The layout shards must sum to the whole suite (.github/workflows/ci.yml, job `layout`). Each shard job saves
 * the output of `bun test --shard=i/N` to `layout-shard-<i>.log`; bun ends it with "Ran X tests across Y files".
 * The Y of the shards must add up to the number of `*.layout.test.ts` files, or a shard silently ran less than
 * its share (a crashed shard, a changed pattern) and the suite no longer runs once per head.
 *
 * Usage: bun scripts/check-layout-shards.ts <log-dir> [--shards <n>]   (default 4)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const LAYOUT = 'packages/basalt-ui/tests/layout'
const RAN = /Ran (\d+) tests? across (\d+) files?/

/** The file count a shard's bun output reports, or null when it has no summary line. */
export function shardFiles(log: string): number | null {
  const m = RAN.exec(log)
  return m ? Number(m[2]) : null
}

export interface ShardCheck {
  ok: boolean
  message: string
}

/** One log per shard; every shard must report, and the files they report must equal `expected`. */
export function checkShards(logs: readonly string[], shards: number, expected: number): ShardCheck {
  if (logs.length !== shards)
    return { ok: false, message: `${logs.length} shard logs, expected ${shards}` }
  const counts = logs.map(shardFiles)
  if (counts.some((c) => c === null))
    return {
      ok: false,
      message: `a shard log has no "Ran X tests across Y files" line: ${counts.join(', ')}`,
    }
  const sum = counts.reduce<number>((a, c) => a + (c ?? 0), 0)
  return sum === expected
    ? {
        ok: true,
        message: `${shards} shards ran ${sum} layout files (${counts.join(' + ')}), the suite has ${expected}`,
      }
    : {
        ok: false,
        message: `shards ran ${sum} layout files (${counts.join(' + ')}), the suite has ${expected}`,
      }
}

function listTests(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') out.push(...listTests(path))
    } else if (entry.name.endsWith('.layout.test.ts')) out.push(path)
  }
  return out
}

if (import.meta.main) {
  const dir = process.argv[2]
  if (!dir) {
    console.error('usage: bun scripts/check-layout-shards.ts <log-dir> [--shards <n>]')
    process.exit(2)
  }
  const flag = process.argv.indexOf('--shards')
  const shards = flag > -1 ? Number(process.argv[flag + 1]) : 4
  const logs = readdirSync(dir)
    .filter((f) => /^layout-shard-.*\.log$/.test(f))
    .toSorted()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
  const result = checkShards(logs, shards, listTests(LAYOUT).length)
  console.log(`check-layout-shards: ${result.message}`)
  process.exit(result.ok ? 0 : 1)
}
