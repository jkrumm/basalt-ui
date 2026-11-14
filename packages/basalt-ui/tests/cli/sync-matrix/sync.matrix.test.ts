/**
 * sync.matrix (primitives-distribution section 6): `sync` on an ejected primitive across the
 * upgrade cases, with a real `git merge-file` and the app's oxfmt. Every case asserts the exit code
 * and the output, then that a second run changes nothing and `--check` is green.
 */
import { afterEach, describe, expect, it } from 'bun:test'

import { formatText, resolveFormatter } from '../../../src/cli/merge/formatter'
import { mergeFile } from '../../../src/cli/merge/merge-file'
import { seedDigest } from '../../../src/cli/merge/seed'
import {
  BASE,
  bump,
  cleanup,
  commit,
  edit,
  editRow,
  ejected,
  FILE,
  GUARD,
  GUARD_V1,
  gitDiff,
  makeFixture,
  read,
  row,
  runSync,
  SEED_V1,
  snapshot,
  split,
  text,
  write,
} from './support'
import type { Fixture } from './support'

afterEach(cleanup)

const SIZE = 7
const UNIT = 16
const LOCAL_UNIT = "  const unit = count === 1 ? 'entry' : 'entries'"
const SHIPPED_SIZE = "  const size = 'lg'"
const MERGED = `merged ${FILE} (3.0.0 -> 3.1.0)`

/** The app's copy with its body replaced, header kept, committed. */
function localEdit(f: Fixture, body: string): string {
  const { header } = split(read(f, FILE))
  write(f, FILE, `${header}\n${body}`)
  commit(f.app)
  return header
}

/** A second run writes nothing and exits 0; `--check` agrees. */
function expectSettled(f: Fixture): void {
  const before = snapshot(f.app)
  const again = runSync(f)
  expect(again.code).toBe(0)
  expect(again.log).not.toContain('merged')
  expect(snapshot(f.app)).toEqual(before)
  expect(runSync(f, true).code).toBe(0)
}

/** The row, base and guard after a sync to 3.1.0 with `seed` and `guard`. */
function expectAdvanced(f: Fixture, seed: string, guard: string | null = GUARD_V1): void {
  expect(row(f)).toMatchObject({ fromVersion: '3.1.0', seedDigest: seedDigest(seed, guard) })
  expect(read(f, BASE)).toBe(ejected(seed))
}

describe('sync.matrix: seed origin', () => {
  it('pristine-stale: an untouched copy becomes the new seed under its header', () => {
    const f = makeFixture()
    const { header } = split(read(f, FILE))
    const shipped = text(edit(SEED_V1, SIZE, SHIPPED_SIZE))
    bump(f.pkg, '3.1.0', shipped, GUARD_V1)

    const run = runSync(f)
    expect(run.code).toBe(0)
    expect(run.log).toContain(MERGED)
    expect(read(f, FILE)).toBe(`${header}\n${ejected(shipped)}`)
    expectAdvanced(f, shipped)
    expectSettled(f)
  })

  it('disjoint: a local and an upstream edit both land; a changed guard is overwritten', () => {
    const f = makeFixture()
    localEdit(f, ejected(text(edit(SEED_V1, UNIT, LOCAL_UNIT))))
    const shipped = text(edit(SEED_V1, SIZE, SHIPPED_SIZE))
    const guard = `${GUARD_V1}export type Size = 'lg'\n`
    bump(f.pkg, '3.1.0', shipped, guard)

    const run = runSync(f)
    expect(run.code).toBe(0)
    expect(run.log).toContain(MERGED)
    const { body } = split(read(f, FILE))
    expect(body).toContain('"entry"')
    expect(body).toContain('const size = "lg";')
    expect(body).not.toContain('<<<<<<<')
    expect(read(f, GUARD)).toBe(guard)
    expectAdvanced(f, shipped, guard)
    expectSettled(f)
  })

  it('overlapping: one line edited both ways conflicts, exits 1, and still advances', () => {
    const f = makeFixture()
    localEdit(f, ejected(text(edit(SEED_V1, SIZE, "  const size = 'sm'"))))
    const shipped = text(edit(SEED_V1, SIZE, SHIPPED_SIZE))
    bump(f.pkg, '3.1.0', shipped, GUARD_V1)

    const run = runSync(f)
    expect(run.code).toBe(1)
    expect(run.log).toContain(`✖ conflict ${FILE} (3.0.0 -> 3.1.0): 1 conflict(s)`)
    const content = read(f, FILE)
    expect(content.split('\n')[0]).toStartWith('// basalt:ejected widget@3.0.0 dense rows')
    for (const marker of ['<<<<<<< local', '||||||| base@3.0.0', '>>>>>>> shipped@3.1.0']) {
      expect(content).toContain(marker)
    }
    expect(content.match(/<<<<<<< /g)).toHaveLength(1)
    // Base and digest advanced on the conflict, so the re-run finds nothing and stacks nothing.
    expectAdvanced(f, shipped)
    expectSettled(f)
    expect(read(f, FILE)).toBe(content)
  })

  it('structural: an upstream insert and a removed function merge around a local edit', () => {
    const f = makeFixture()
    localEdit(f, ejected(text(edit(SEED_V1, UNIT, LOCAL_UNIT))))
    const added = ['', 'export function widgetSize(): string {', "  return 'md'", '}']
    const shipped = text([...SEED_V1.slice(0, 14), ...added, ...SEED_V1.slice(14, 19), ''])
    bump(f.pkg, '3.1.0', shipped, GUARD_V1)

    const run = runSync(f)
    expect(run.code).toBe(0)
    expect(run.log).toContain(MERGED)
    const { body } = split(read(f, FILE))
    expect(body).toContain('export function widgetSize(): string {')
    expect(body).not.toContain('widgetTone')
    expect(body).toContain('"entry"')
    expect(body).not.toContain('<<<<<<<')
    expectAdvanced(f, shipped)
    expectSettled(f)
  })

  it('header-adjacent: an upstream edit to line 1 does not meet the header', () => {
    const f = makeFixture()
    const local = ejected(text(edit(SEED_V1, UNIT, LOCAL_UNIT)))
    const header = localEdit(f, local)
    const shipped = text(edit(SEED_V1, 0, "import { cn, cx } from '../core/cn'"))
    // Left on line 1, the header itself conflicts with the upstream edit there.
    const naive = mergeFile({
      local: `${header}\n${local}`,
      base: ejected(text(SEED_V1)),
      shipped: ejected(shipped),
      labels: { local: 'local', base: 'base', shipped: 'shipped' },
    })
    expect('conflicts' in naive && naive.conflicts).toBeGreaterThan(0)
    bump(f.pkg, '3.1.0', shipped, GUARD_V1)

    const run = runSync(f)
    expect(run.code).toBe(0)
    expect(run.log).toContain(MERGED)
    const lines = read(f, FILE).split('\n')
    expect(lines[0]).toBe(header)
    expect(lines[1]).toBe('import { cn, cx } from "basalt-ui/core/cn";')
    expectAdvanced(f, shipped)
    expectSettled(f)
  })
})

describe('sync.matrix: reformatted copy (single-quote seed vs the oxfmt copy)', () => {
  /** The ejected copy as the app's oxfmt writes it, with the local unit edit. */
  function formattedCopy(f: Fixture): string {
    const formatter = resolveFormatter(f.app)
    const out =
      formatter === null
        ? null
        : formatText(formatter, ejected(text(edit(SEED_V1, UNIT, LOCAL_UNIT))), FILE)
    if (out === null) throw new Error('oxfmt did not run in the fixture')
    expect(out).toContain('from "basalt-ui/core/cn";')
    return out
  }

  it('merges cleanly with the project formatter on all three inputs', () => {
    const f = makeFixture()
    localEdit(f, formattedCopy(f))
    const shipped = text(edit(SEED_V1, SIZE, SHIPPED_SIZE))
    bump(f.pkg, '3.1.0', shipped, GUARD_V1)

    const run = runSync(f)
    expect(run.code).toBe(0)
    expect(run.log).toContain(MERGED)
    expect(run.log).not.toContain('merged raw')
    const { body } = split(read(f, FILE))
    expect(body).toContain('const size = "lg";')
    expect(body).toContain('"entry"')
    // The base stays the raw seed: nothing formatted is stored.
    expectAdvanced(f, shipped)
    expectSettled(f)
  })

  it('with no formatter resolved, merges raw, says so, and conflicts', () => {
    const copy = formattedCopy(makeFixture())
    const f = makeFixture({ formatter: false })
    localEdit(f, copy)
    const shipped = text(edit(SEED_V1, SIZE, SHIPPED_SIZE))
    bump(f.pkg, '3.1.0', shipped, GUARD_V1)

    const run = runSync(f)
    expect(run.code).toBe(1)
    expect(run.log).toContain('no project formatter resolved')
    expect(run.log).toContain('merged raw')
    expect(run.log).toContain(`✖ conflict ${FILE}`)
    expectAdvanced(f, shipped)
    expectSettled(f)
  })
})

describe('sync.matrix: adopted and local origins', () => {
  it('an adopted file stays byte-identical across a seed bump, and the output names it', () => {
    const f = makeFixture()
    editRow(f, { origin: 'adopted' })
    const { header } = split(read(f, FILE))
    write(f, FILE, `${header}\nexport const Widget = () => null\n`)
    commit(f.app)
    const before = read(f, FILE)
    const shipped = text(edit(SEED_V1, SIZE, SHIPPED_SIZE))
    bump(f.pkg, '3.1.0', shipped, GUARD_V1)

    const run = runSync(f)
    expect(run.code).toBe(0)
    expect(run.log).toContain(`adopted ${FILE}: left byte-identical (3.0.0 -> 3.1.0)`)
    expect(run.log).toContain(`\`git diff -- ${BASE}\``)
    expect(read(f, FILE)).toBe(before)
    expect(gitDiff(f.app, BASE)).toContain(`+${SHIPPED_SIZE}`)
    expectAdvanced(f, shipped)
    expectSettled(f)
  })

  it('a local file is skipped and named', () => {
    const f = makeFixture()
    editRow(f, { origin: 'local', seedDigest: null })
    const before = read(f, FILE)
    bump(f.pkg, '3.1.0', text(edit(SEED_V1, SIZE, SHIPPED_SIZE)), GUARD_V1)

    const run = runSync(f)
    expect(run.code).toBe(0)
    expect(run.log).toContain(`skipped ${FILE}: origin local`)
    expect(read(f, FILE)).toBe(before)
  })
})

describe('sync.matrix: --check', () => {
  it('is green on a current tree', () => {
    const f = makeFixture()
    const run = runSync(f, true)
    expect(run.code).toBe(0)
    expect(run.log).toContain('all managed files current')
  })

  it('exits 1 on pending work and leaves the tree byte-identical, conflict included', () => {
    const f = makeFixture()
    localEdit(f, ejected(text(edit(SEED_V1, SIZE, "  const size = 'sm'"))))
    bump(f.pkg, '3.1.0', text(edit(SEED_V1, SIZE, SHIPPED_SIZE)), GUARD_V1)
    const before = snapshot(f.app)

    const run = runSync(f, true)
    expect(run.code).toBe(1)
    expect(run.log).toContain(`✖ conflict ${FILE}`)
    expect(snapshot(f.app)).toEqual(before)
    expect(row(f)).toMatchObject({ fromVersion: '3.0.0' })
  })

  it('exits 1 when only the guard drifted, and sync restores it', () => {
    const f = makeFixture()
    write(f, GUARD, 'export {}\n')
    const before = snapshot(f.app)
    const run = runSync(f, true)
    expect(run.code).toBe(1)
    expect(run.log).toContain(`restored ${GUARD}`)
    expect(snapshot(f.app)).toEqual(before)

    expect(runSync(f).code).toBe(0)
    expect(read(f, GUARD)).toBe(GUARD_V1)
    expectSettled(f)
  })
})
