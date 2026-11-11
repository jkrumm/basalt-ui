// Spike thin-skill-s7 (skills-agent-layer section 8 S7): activation outside trial conditions.
//
// Four cells, one brief (fixture/BRIEF.md):
//   a  a session started at the workspace root of the fixture
//   b  a session started in apps/dashboard
//   c  an `implementer` without the Agent tool (the lead can run only this one)
//   d  a fresh session asked to design a page with no src file read
// This file stages the fixture, prints the exact owner repro, scans a transcript and records the
// per-cell result in results/cells.json. It runs no model and never calls `claude -p`.
//
//   bun run.ts                          report: one JSON object (exit 0 = harness ran, not hypothesis held)
//   bun run.ts stage                    build the fixture in the OS temp dir, print its path
//   bun run.ts repro                    print the exact owner repro per cell
//   bun run.ts scan <cell> <transcript.jsonl>   count skill and reviewer activations and the table sentinels
//   bun run.ts record <cell> <skill> <reviewer> [table] [note...]   yes|no for each; table only for d
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const DRAFT_SKILL = join(REPO, 'tools', 'spikes', 'thin-skill', 'skill')
const TMP = process.env.THIN_SKILL_S7_TMP ?? join(tmpdir(), 'thin-skill-s7')
const WS = join(TMP, 'workspace')
const LEDGER = join(HERE, 'results', 'cells.json')

const CELLS = ['a', 'b', 'c', 'd'] as const
type Cell = (typeof CELLS)[number]
type Val = 'yes' | 'no' | 'not run'
type Row = { skill: Val; reviewer: Val; table?: Val; note?: string }
type Ledger = Record<Cell, Row>

// One distinctive token per row of the question-to-form table in fixture/AGENTS.md.
const SENTINELS = ['TREND-LINE', 'PARTS-BAR', 'RANK-BARS', 'EXACT-TABLE', 'LIMIT-METER']
const SKILL_NAME = 'basalt-design'

const REPRO: Record<Cell, string> = {
  a: `cd ${WS} && claude   # paste fixture/BRIEF.md as the first message; then /exit`,
  b: `cd ${WS}/apps/dashboard && claude   # paste fixture/BRIEF.md as the first message; then /exit`,
  c: `lead only: spawn an \`implementer\` (no Agent tool) with cwd ${WS} and BRIEF.md as the task`,
  d: `cd ${WS} && claude   # fresh session; read no file under apps/; message: "Design the Engineering overview page" (BRIEF.md text); then /exit`,
}

function readLedger(): Ledger {
  const empty = Object.fromEntries(
    CELLS.map((c) => [
      c,
      { skill: 'not run', reviewer: 'not run', ...(c === 'd' ? { table: 'not run' } : {}) },
    ]),
  ) as Ledger
  if (!existsSync(LEDGER)) return empty
  return { ...empty, ...(JSON.parse(readFileSync(LEDGER, 'utf8')) as Partial<Ledger>) }
}

function verdict(l: Ledger): { s7: string; pending: Cell[] } {
  const pending = CELLS.filter((c) => l[c].skill === 'not run')
  const refuted =
    (['a', 'b', 'c'] as const).some((c) => l[c].skill === 'no' || l[c].reviewer === 'no') ||
    l.d.table === 'no'
  if (refuted) return { s7: 'S7: REFUTED', pending }
  if (pending.length === 0) return { s7: 'S7: PASS', pending }
  return { s7: `S7: pending (needs owner run: ${pending.join(', ')})`, pending }
}

function report(): void {
  const l = readLedger()
  const { s7 } = verdict(l)
  const cells = Object.fromEntries(CELLS.map((c) => [c, l[c].skill]))
  console.log(
    JSON.stringify({
      s7,
      cells,
      reviewer: Object.fromEntries(CELLS.map((c) => [c, l[c].reviewer])),
      table: l.d.table ?? 'not run',
    }),
  )
}

function stage(): void {
  rmSync(WS, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  cpSync(join(HERE, 'fixture'), WS, { recursive: true })
  const skills = join(WS, '.claude', 'skills', SKILL_NAME)
  mkdirSync(skills, { recursive: true })
  cpSync(DRAFT_SKILL, skills, { recursive: true })
  mkdirSync(join(WS, 'docs', 'design'), { recursive: true })
  for (const args of [
    ['init', '-q'],
    ['add', '-A'],
    ['-c', 'user.name=s7', '-c', 'user.email=s7@example.com', 'commit', '-q', '-m', 'fixture'],
  ]) {
    const r = spawnSync('git', args, { cwd: WS, encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${r.stderr}`)
  }
  console.log(WS)
}

function repro(): void {
  for (const c of CELLS) console.log(`(${c}) ${REPRO[c]}`)
}

function scan(cell: Cell, path: string): void {
  const text = readFileSync(path, 'utf8')
  const lines = text.split('\n')
  const skillCalls = lines.filter((x) => /"name":"Skill"/.test(x) && x.includes(SKILL_NAME)).length
  const skillFileReads = lines.filter((x) => x.includes(`skills/${SKILL_NAME}/SKILL.md`)).length
  const reviewerCalls = lines.filter(
    (x) => /"name":"(Agent|Task)"/.test(x) && x.includes('reviewer'),
  ).length
  const handoff = /reviewer not run/i.test(text)
  const table = SENTINELS.filter((s) => text.includes(s))
  const srcReads = lines.filter(
    (x) => /"name":"Read"/.test(x) && /apps\/[^"]*\/src\//.test(x),
  ).length
  console.log(
    JSON.stringify({
      cell,
      skillCalls,
      skillFileReads,
      reviewerCalls,
      handoff,
      tableSentinels: table,
      srcReads,
    }),
  )
}

function record(cell: Cell, skill: string, reviewer: string, rest: string[]): void {
  const ok = (v: string): v is Val => v === 'yes' || v === 'no' || v === 'not run'
  if (!CELLS.includes(cell) || !ok(skill) || !ok(reviewer))
    throw new Error('usage: record <a|b|c|d> <yes|no> <yes|no> [table] [note]')
  const l = readLedger()
  const row: Row = { skill, reviewer }
  if (cell === 'd') {
    const [table, ...note] = rest
    if (!table || !ok(table)) throw new Error('cell d needs a table value')
    row.table = table
    if (note.length) row.note = note.join(' ')
  } else if (rest.length) row.note = rest.join(' ')
  l[cell] = row
  mkdirSync(dirname(LEDGER), { recursive: true })
  writeFileSync(LEDGER, `${JSON.stringify(l, null, 2)}\n`)
  report()
}

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'stage') stage()
else if (cmd === 'repro') repro()
else if (cmd === 'scan') scan(args[0] as Cell, args[1] ?? '')
else if (cmd === 'record') record(args[0] as Cell, args[1] ?? '', args[2] ?? '', args.slice(3))
else report()
