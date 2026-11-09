#!/usr/bin/env bun
/**
 * The merge guard (`make merge-guard`): what a lead runs just before it merges its pull request, so parallel
 * leads never land onto a master that moved or is red. It refuses, with the reason, when
 *   - the branch does not contain the current `origin/master` (rebase, then `make check` again),
 *   - a generated file is stale (the generation sync checks `make check` runs),
 *   - master's last finished CI run is red. A run still in progress does not refuse.
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
  /** master's ci.yml runs, newest first; null when they cannot be read */
  ciRuns(): CiRun[] | null
  /** the generation sync checks that fail, as the command that failed; empty when all are in sync */
  staleGenerated(): string[]
}

/** The generation sync checks `make check` runs first. */
export const GENERATION_CHECKS: readonly (readonly string[])[] = [
  ['packages/basalt-ui/scripts/gen-oxlint.ts', '--check'],
  ['packages/basalt-ui/scripts/gen-llms.ts', '--check'],
]

/**
 * master's last finished CI run: in-progress runs are skipped (a 17 min CI would otherwise cap landings) and so
 * are cancelled ones (superseded by a newer run). A refusal reason, or null when green or nothing finished yet.
 */
export function masterRed(runs: CiRun[] | null): string | null {
  if (runs === null)
    return "master's CI runs cannot be read (gh failed): refusing, a merge needs to know master is green"
  const last = runs.find((run) => run.status === 'completed' && run.conclusion !== 'cancelled')
  if (!last || last.conclusion === 'success') return null
  return `master's last finished CI run is ${last.conclusion} (${last.url}): fix master first, a merge onto red hides the next break`
}

export function evaluate(ports: GuardPorts): string[] {
  const refusals: string[] = []

  if (ports.git(['rev-parse', '--verify', '-q', 'origin/master']) === null) {
    refusals.push('origin/master is unknown: git fetch origin master')
  } else if (ports.git(['merge-base', '--is-ancestor', 'origin/master', 'HEAD']) === null) {
    refusals.push(
      'master moved: this branch does not contain origin/master. git fetch origin master && git rebase origin/master, then make check again',
    )
  }

  for (const command of ports.staleGenerated())
    refusals.push(
      `generated files are stale: \`${command}\` failed. Regenerate without --check and commit it`,
    )

  const red = masterRed(ports.ciRuns())
  if (red) refusals.push(red)
  return refusals
}

export function realPorts(cwd: string = process.cwd()): GuardPorts {
  return {
    git(args) {
      const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
      return out.status === 0 ? out.stdout.trim() : null
    },
    ciRuns() {
      const out = spawnSync(
        'gh',
        [
          'run',
          'list',
          '--branch',
          'master',
          '--workflow',
          'ci.yml',
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
    'merge-guard: clear (contains origin/master, generated files in sync, master CI not red)',
  )
}
