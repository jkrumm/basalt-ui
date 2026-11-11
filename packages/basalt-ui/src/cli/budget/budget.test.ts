/**
 * The budget module against temp git repos: the base-ref cases of `landBudget` need a real
 * `git show`, so each one builds a repo whose `origin/master` ref holds (or lacks) a base copy.
 *
 * Run: bun test packages/basalt-ui/src/cli/budget
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  BUDGET_PATH,
  countBreaches,
  landBudget,
  parseBudget,
  readBudget,
  seedBudget,
  serializeBudget,
  writeBudget,
} from './index'
import type { Budget } from './index'

const BASE_REF = 'origin/master'
const scratch: string[] = []
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function git(dir: string, ...args: string[]): void {
  const run = Bun.spawnSync(['git', '-C', dir, ...args], { stderr: 'pipe' })
  if (run.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${run.stderr.toString()}`)
}

function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'budget-'))
  scratch.push(dir)
  return dir
}

/** A repo whose `origin/master` holds `base` (none when null) and whose working tree holds `work`. */
function repo({ base, work }: { base: Budget | null; work: Budget }): string {
  const dir = tmp()
  git(dir, 'init', '-q')
  git(dir, 'config', 'user.email', 't@example.com')
  git(dir, 'config', 'user.name', 't')
  git(dir, 'config', 'commit.gpgsign', 'false')
  writeFileSync(join(dir, 'README.md'), 'x\n')
  if (base !== null) writeBudget(dir, base)
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'base')
  git(dir, 'update-ref', `refs/remotes/${BASE_REF}`, 'HEAD')
  writeBudget(dir, work)
  return dir
}

const budgetWith = (over: Partial<Budget>): Budget => ({ ...seedBudget('app'), ...over })
const onDisk = (dir: string): string => readFileSync(join(dir, BUDGET_PATH), 'utf8')

describe('seedBudget', () => {
  it('returns the section 2 defaults and readBudget accepts them', () => {
    const seed = seedBudget('bridge')
    expect(seed).toEqual({
      ejects: 3,
      adopted: 0,
      waivers: 0,
      escapes: 3,
      profileFloor: 'bridge',
      raises: [],
    })
    const dir = tmp()
    writeBudget(dir, seed)
    expect(readBudget(dir)).toEqual({ budget: seed })
  })

  it('round-trips through the canonical bytes', () => {
    const seed = seedBudget('tokens')
    expect(parseBudget(serializeBudget(seed))).toEqual({ budget: seed })
    expect(serializeBudget(seed).endsWith('}\n')).toBe(true)
  })
})

function readText(text: string) {
  const dir = tmp()
  mkdirSync(join(dir, '.basalt'))
  writeFileSync(join(dir, BUDGET_PATH), text)
  return readBudget(dir)
}

describe('readBudget', () => {
  const seed = seedBudget('app')

  it('rejects a missing waivers field', () => {
    const { waivers: _omitted, ...rest } = seed
    const read = readText(JSON.stringify(rest))
    expect(read).toEqual({ error: expect.stringContaining('missing `waivers`') })
  })

  it('rejects a string ejects', () => {
    const read = readText(JSON.stringify({ ...seed, ejects: '3' }))
    expect(read).toEqual({ error: expect.stringContaining('`ejects` must be') })
  })

  it('rejects a negative, fractional, unknown-profile or non-array field', () => {
    for (const bad of [
      { escapes: -1 },
      { waivers: 1.5 },
      { profileFloor: 'elsewhere' },
      { raises: {} },
      { raises: ['x'] },
    ]) {
      expect(readText(JSON.stringify({ ...seed, ...bad }))).toHaveProperty('error')
    }
  })

  it('rejects invalid JSON, a non-object and a missing file', () => {
    expect(readText('{')).toHaveProperty('error')
    expect(readText('[]')).toHaveProperty('error')
    expect(readBudget(tmp())).toEqual({ error: expect.stringContaining('not found') })
  })
})

describe('countBreaches', () => {
  const budget = budgetWith({ ejects: 3, waivers: 3, escapes: 3 })

  it('names waivers when the count is 4 against a ceiling of 3', () => {
    expect(countBreaches(budget, { waivers: 4 })).toEqual([
      { name: 'waivers', count: 4, ceiling: 3 },
    ])
  })

  it('lists every breach and passes a count at its ceiling', () => {
    expect(countBreaches(budget, { ejects: 4, waivers: 3, escapes: 9 }).map((b) => b.name)).toEqual(
      ['ejects', 'escapes'],
    )
    expect(countBreaches(budget, { ejects: 3, waivers: 0, escapes: 3 })).toEqual([])
  })

  it('skips a ceiling whose count is absent', () => {
    expect(countBreaches(budget, {})).toEqual([])
  })
})

describe('landBudget', () => {
  const counts = { waivers: 7, escapes: 7 }

  it('writes any counted value when the base ref has no copy', () => {
    const dir = repo({ base: null, work: seedBudget('app') })
    const landed = landBudget({ counts, baseRef: BASE_REF, dir })
    expect(landed).toHaveProperty('budget.waivers', 7)
    expect(readBudget(dir)).toEqual({ budget: { ...seedBudget('app'), waivers: 7, escapes: 7 } })
  })

  it('refuses an unresolvable base ref instead of reading it as no copy', () => {
    const dir = repo({ base: budgetWith({ waivers: 1 }), work: seedBudget('app') })
    const before = onDisk(dir)
    expect(landBudget({ counts, baseRef: 'origin/nope', dir })).toEqual({
      error: expect.stringContaining('does not resolve'),
    })
    expect(onDisk(dir)).toBe(before)
  })

  it('refuses a value above a base copy of 3, names eject --raise and writes nothing', () => {
    const dir = repo({
      base: budgetWith({ waivers: 3, escapes: 9 }),
      work: budgetWith({ waivers: 2, escapes: 2 }),
    })
    const before = onDisk(dir)
    const landed = landBudget({ counts, baseRef: BASE_REF, dir })
    expect(landed).toEqual({ error: expect.stringContaining('eject --raise') })
    expect(landed).toEqual({ error: expect.stringContaining('waivers 7 > 3') })
    expect(landed).toEqual({ error: expect.not.stringContaining('escapes 7') })
    expect(onDisk(dir)).toBe(before)
  })

  it('writes 7 against a base copy of 9, and a value equal to the base', () => {
    const dir = repo({ base: budgetWith({ waivers: 9, escapes: 9 }), work: seedBudget('app') })
    expect(landBudget({ counts, baseRef: BASE_REF, dir })).toHaveProperty('budget.waivers', 7)
    expect(
      landBudget({ counts: { waivers: 9, escapes: 9 }, baseRef: BASE_REF, dir }),
    ).toHaveProperty('budget.escapes', 9)
  })

  it('never writes ejects, adopted, raises or profileFloor', () => {
    const work = budgetWith({
      ejects: 5,
      adopted: 2,
      profileFloor: 'parts',
      raises: [{ ceiling: 'ejects', from: 3, to: 5 }],
    })
    const dir = repo({ base: null, work })
    landBudget({ counts, baseRef: BASE_REF, dir })
    expect(readBudget(dir)).toEqual({ budget: { ...work, waivers: 7, escapes: 7 } })
  })

  it('reads the base copy relative to a consumer root below the repo root', () => {
    const dir = tmp()
    const root = join(dir, 'apps', 'web')
    mkdirSync(root, { recursive: true })
    git(dir, 'init', '-q')
    git(dir, 'config', 'user.email', 't@example.com')
    git(dir, 'config', 'user.name', 't')
    git(dir, 'config', 'commit.gpgsign', 'false')
    writeBudget(root, budgetWith({ waivers: 3 }))
    git(dir, 'add', '-A')
    git(dir, 'commit', '-q', '-m', 'base')
    git(dir, 'update-ref', `refs/remotes/${BASE_REF}`, 'HEAD')
    expect(landBudget({ counts, baseRef: BASE_REF, dir: root })).toHaveProperty('error')
  })

  it('refuses a missing current file, an invalid base copy and non-integer counts', () => {
    expect(landBudget({ counts, baseRef: BASE_REF, dir: tmp() })).toHaveProperty('error')
    const dir = repo({ base: null, work: seedBudget('app') })
    expect(
      landBudget({ counts: { waivers: 1.5, escapes: 0 }, baseRef: BASE_REF, dir }),
    ).toHaveProperty('error')
    const broken = repo({ base: null, work: seedBudget('app') })
    writeFileSync(join(broken, BUDGET_PATH), '{}')
    git(broken, 'add', '-A')
    git(broken, 'commit', '-q', '-m', 'broken')
    git(broken, 'update-ref', `refs/remotes/${BASE_REF}`, 'HEAD')
    writeBudget(broken, seedBudget('app'))
    expect(landBudget({ counts, baseRef: BASE_REF, dir: broken })).toEqual({
      error: expect.stringContaining(BASE_REF),
    })
  })
})
