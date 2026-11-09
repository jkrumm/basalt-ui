import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import type { CiRun, GuardPorts } from './merge-guard'
import { evaluate, masterRed, realPorts } from './merge-guard'

const green: CiRun = {
  status: 'completed',
  conclusion: 'success',
  url: 'https://example.com/green',
}
const red: CiRun = { status: 'completed', conclusion: 'failure', url: 'https://example.com/red' }
const running: CiRun = { status: 'in_progress', conclusion: '', url: 'https://example.com/running' }

let root: string
let work: string

const git = (cwd: string, ...args: string[]): void => {
  const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')}: ${out.stderr}`)
}

const commit = (name: string): void => {
  writeFileSync(join(work, name), name)
  git(work, 'add', name)
  git(work, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', name)
}

const ports = (over: Partial<GuardPorts> = {}): GuardPorts => ({
  ...realPorts(work),
  ciRuns: () => [green],
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

  test('refuses when the branch does not contain origin/master', () => {
    git(work, 'checkout', '-q', 'master')
    commit('moved')
    git(work, 'push', '-q', 'origin', 'master')
    git(work, 'checkout', '-q', 'feature')
    const refusals = evaluate(ports())
    expect(refusals).toHaveLength(1)
    expect(refusals[0]).toContain('does not contain origin/master')
    git(work, 'rebase', '-q', 'origin/master')
    expect(evaluate(ports())).toEqual([])
  })

  test('refuses on stale generated files', () => {
    const refusals = evaluate(ports({ staleGenerated: () => ['bun gen-llms.ts --check'] }))
    expect(refusals[0]).toContain('generated files are stale')
  })

  test('refuses on a seeded red run', () => {
    const refusals = evaluate(ports({ ciRuns: () => [red, green] }))
    expect(refusals).toHaveLength(1)
    expect(refusals[0]).toContain('failure')
  })

  test('refuses when the runs cannot be read', () => {
    expect(evaluate(ports({ ciRuns: () => null }))[0]).toContain('cannot be read')
  })

  test('does not refuse while the latest run is in progress', () => {
    expect(evaluate(ports({ ciRuns: () => [running, green] }))).toEqual([])
  })
})

describe('masterRed', () => {
  test('an in-progress run is skipped, the last finished red one still refuses', () => {
    expect(masterRed([running, red])).toContain('failure')
  })

  test('cancelled runs are skipped', () => {
    expect(masterRed([{ ...red, conclusion: 'cancelled' }, green])).toBeNull()
  })
})
