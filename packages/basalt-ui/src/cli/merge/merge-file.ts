/**
 * `git merge-file --diff3` over three in-memory texts (primitives-distribution section 6, step 3).
 * Runs outside any repository: the inputs go to a private temp dir, the result comes back on
 * stdout (`-p`), so the consumer's tree is never touched by the merge itself.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type MergeInputs = {
  local: string
  base: string
  shipped: string
  /** Conflict-marker labels, e.g. `local`, `base@3.0.0`, `shipped@3.1.0`. */
  labels: { local: string; base: string; shipped: string }
}

/** `conflicts` is git's count (0 = clean); `error` when git could not run or failed outright. */
export type MergeResult = { text: string; conflicts: number } | { error: string }

export function mergeFile({ local, base, shipped, labels }: MergeInputs): MergeResult {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-merge-'))
  try {
    const paths = {
      local: join(dir, 'local'),
      base: join(dir, 'base'),
      shipped: join(dir, 'shipped'),
    }
    writeFileSync(paths.local, local)
    writeFileSync(paths.base, base)
    writeFileSync(paths.shipped, shipped)
    const run = spawnSync(
      'git',
      [
        'merge-file',
        '--diff3',
        '-p',
        '-L',
        labels.local,
        '-L',
        labels.base,
        '-L',
        labels.shipped,
        paths.local,
        paths.base,
        paths.shipped,
      ],
      { encoding: 'utf8' },
    )
    if (run.error !== undefined)
      return { error: `git merge-file did not run: ${run.error.message}` }
    // Exit status is the conflict count (capped at 127); a negative one is a failure, which
    // spawnSync reports as 255.
    if (run.status === null || run.status > 127) {
      return { error: `git merge-file failed: ${run.stderr.trim() || `exit ${run.status}`}` }
    }
    return { text: run.stdout, conflicts: run.status }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
