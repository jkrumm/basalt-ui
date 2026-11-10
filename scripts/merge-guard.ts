#!/usr/bin/env bun
/**
 * The merge guard (`make merge-guard`): what a lead runs just before it merges its pull request, so the exact tree
 * that lands has passed CI. It refuses, with the reason, when
 *   - the branch does not contain the current `origin/master` (rebase, push, let PR CI run again),
 *   - a generated file is stale (the generation sync checks `make check` runs),
 *   - the PR CI run for HEAD is missing, still running or not green.
 * A head that contains origin/master and is green in PR CI proves master plus this change is green, so a red master
 * does not refuse on its own: the PR that fixes it must be able to land (2026-11-10, master was red for 4 hours after
 * a merge that never waited for its own CI, and the guard then refused the fix).
 * Exit 0 when clear, 1 on a refusal (the reasons on stderr), 2 on a usage error.
 */
import { spawnSync } from 'node:child_process'

export interface CiRun {
  status: string
  conclusion: string
  url: string
}

export interface GuardPorts {
  /** `git <args>` in the repo; the trimmed stdout, or null when git exits non-zero */
  git(args: string[]): string | null
  /** the ci.yml pull_request runs for one commit, newest first; null when they cannot be read */
  ciRuns(sha: string): CiRun[] | null
  /** the generation sync checks that fail, as the command that failed; empty when all are in sync */
  staleGenerated(): string[]
}

/** The generation sync checks `make check` runs first. */
export const GENERATION_CHECKS: readonly (readonly string[])[] = [
  ['packages/basalt-ui/scripts/gen-oxlint.ts', '--check'],
  ['packages/basalt-ui/scripts/gen-llms.ts', '--check'],
]

/**
 * The newest PR CI run for HEAD that was not cancelled (a cancelled run was superseded). A refusal reason, or null
 * when it is green.
 */
export function headNotGreen(sha: string, runs: CiRun[] | null): string | null {
  if (runs === null)
    return 'the PR CI runs cannot be read (gh failed): refusing, a merge needs a green run for HEAD'
  const last = runs.find((run) => run.conclusion !== 'cancelled')
  if (!last)
    return `no PR CI run for HEAD ${sha.slice(0, 12)}: push it to the pull request and wait for ci.yml`
  if (last.status !== 'completed')
    return `PR CI for HEAD ${sha.slice(0, 12)} is still ${last.status} (${last.url}): wait for it`
  if (last.conclusion === 'success') return null
  return `PR CI for HEAD ${sha.slice(0, 12)} is ${last.conclusion} (${last.url}): fix it, push, wait for green`
}

export function evaluate(ports: GuardPorts): string[] {
  const refusals: string[] = []

  if (ports.git(['rev-parse', '--verify', '-q', 'origin/master']) === null) {
    refusals.push('origin/master is unknown: git fetch origin master')
  } else if (ports.git(['merge-base', '--is-ancestor', 'origin/master', 'HEAD']) === null) {
    refusals.push(
      'master moved: this branch does not contain origin/master. git fetch origin master && git rebase origin/master, push, and wait for PR CI',
    )
  }

  for (const command of ports.staleGenerated())
    refusals.push(
      `generated files are stale: \`${command}\` failed. Regenerate without --check and commit it`,
    )

  const sha = ports.git(['rev-parse', 'HEAD'])
  const notGreen = sha === null ? 'HEAD cannot be resolved' : headNotGreen(sha, ports.ciRuns(sha))
  if (notGreen) refusals.push(notGreen)
  return refusals
}

export function realPorts(cwd: string = process.cwd()): GuardPorts {
  return {
    git(args) {
      const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
      return out.status === 0 ? out.stdout.trim() : null
    },
    ciRuns(sha) {
      const out = spawnSync(
        'gh',
        [
          'run',
          'list',
          '--workflow',
          'ci.yml',
          '--event',
          'pull_request',
          '--commit',
          sha,
          '--limit',
          '10',
          '--json',
          'status,conclusion,url',
        ],
        { cwd, encoding: 'utf8' },
      )
      if (out.status !== 0) return null
      try {
        return JSON.parse(out.stdout) as CiRun[]
      } catch {
        return null
      }
    },
    staleGenerated() {
      return GENERATION_CHECKS.filter(
        (args) => spawnSync('bun', [...args], { cwd, stdio: 'ignore' }).status !== 0,
      ).map((args) => `bun ${args.join(' ')}`)
    },
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const unknown = args.filter((a) => a !== '--no-fetch')
  if (unknown.length > 0) {
    console.error(`merge-guard: unknown argument ${unknown[0]}`)
    process.exit(2)
  }
  const ports = realPorts()
  if (!args.includes('--no-fetch')) ports.git(['fetch', '--quiet', 'origin', 'master'])
  const refusals = evaluate(ports)
  if (refusals.length > 0) {
    for (const reason of refusals) console.error(`merge-guard: refused: ${reason}`)
    process.exit(1)
  }
  console.log(
    'merge-guard: clear (contains origin/master, generated files in sync, PR CI green for HEAD)',
  )
}
