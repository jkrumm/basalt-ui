import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import type { CiRun, GuardPorts } from './merge-guard'
import { evaluate, headNotGreen, realPorts } from './merge-guard'

const green: CiRun = {
  status: 'completed',
  conclusion: 'success',
  url: 'https://example.com/green',
}
const red: CiRun = { status: 'completed', conclusion: 'failure', url: 'https://example.com/red' }
const cancelled: CiRun = { ...red, conclusion: 'cancelled' }
const running: CiRun = { status: 'in_progress', conclusion: '', url: 'https://example.com/running' }

let root: string
let work: string

const git = (cwd: string, ...args: string[]): void => {
  const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')}: ${out.stderr}`)
}

const commit = (name: string, body: string = name): void => {
  writeFileSync(join(work, name), body)
  git(work, 'add', name)
  git(work, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', name)
}

const ports = (over: Partial<GuardPorts> = {}): GuardPorts => ({
  ...realPorts(work),
  ciRuns: () => [green],
  masterRuns: () => [green],
  staleGenerated: () => [],
  ...over,
})

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'merge-guard-'))
  work = join(root, 'work')
  git(root, 'init', '-q', '--bare', '-b', 'master', 'origin.git')
  git(root, 'clone', '-q', 'origin.git', 'work')
  git(work, 'checkout', '-q', '-b', 'master')
  commit('base')
  git(work, 'push', '-q', 'origin', 'master')
  git(work, 'checkout', '-q', '-b', 'feature')
  commit('feature')
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('evaluate', () => {
  test('clear on a rebased clean branch', () => {
    expect(evaluate(ports())).toEqual([])
  })

  test('a branch behind master on other files clears while master is green, refuses while it is red', () => {
    git(work, 'checkout', '-q', 'master')
    commit('moved')
    git(work, 'push', '-q', 'origin', 'master')
    git(work, 'checkout', '-q', 'feature')
    expect(evaluate(ports())).toEqual([])
    const refusals = evaluate(ports({ masterRuns: () => [running, red] }))
    expect(refusals).toHaveLength(1)
    expect(refusals[0]).toContain("master's last finished CI run is failure")
    expect(evaluate(ports({ masterRuns: () => null }))[0]).toContain('is unknown')
  })

  test('refuses when master moved on a file this branch changes, clears after the rebase', () => {
    git(work, 'checkout', '-q', 'master')
    commit('feature', 'master edit')
    git(work, 'push', '-q', 'origin', 'master')
    git(work, 'checkout', '-q', 'feature')
    const refusals = evaluate(ports())
    expect(refusals).toHaveLength(1)
    expect(refusals[0]).toContain('master moved on files this branch changes (feature)')
    git(
      work,
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@example.com',
      'rebase',
      '-q',
      '-X',
      'theirs',
      'origin/master',
    )
    expect(evaluate(ports({ masterRuns: () => [red] }))).toEqual([])
  })

  test('refuses on stale generated files', () => {
    const refusals = evaluate(ports({ staleGenerated: () => ['bun gen-llms.ts --check'] }))
    expect(refusals[0]).toContain('generated files are stale')
  })

  test('refuses when the PR CI run for HEAD is red', () => {
    const refusals = evaluate(ports({ ciRuns: () => [red, green] }))
    expect(refusals).toHaveLength(1)
    expect(refusals[0]).toContain('failure')
  })

  test('refuses while the PR CI run for HEAD is in progress', () => {
    expect(evaluate(ports({ ciRuns: () => [running, green] }))[0]).toContain('still in_progress')
  })

  test('refuses when HEAD has no PR CI run', () => {
    expect(evaluate(ports({ ciRuns: () => [] }))[0]).toContain('no PR CI run for HEAD')
  })

  test('refuses when the runs cannot be read', () => {
    expect(evaluate(ports({ ciRuns: () => null }))[0]).toContain('cannot be read')
  })

  test('asks for the runs of the exact HEAD commit', () => {
    const asked: string[] = []
    evaluate(ports({ ciRuns: (sha) => (asked.push(sha), [green]) }))
    expect(asked).toEqual([realPorts(work).git(['rev-parse', 'HEAD']) ?? ''])
  })
})

describe('headNotGreen', () => {
  test('a cancelled run is skipped for the run before it', () => {
    expect(headNotGreen('abc', [cancelled, green])).toBeNull()
    expect(headNotGreen('abc', [cancelled, red])).toContain('failure')
  })

  test('only cancelled runs count as no run', () => {
    expect(headNotGreen('abc', [cancelled])).toContain('no PR CI run')
  })
})
