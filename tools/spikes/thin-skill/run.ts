// Spike thin-skill (skills-agent-layer section 8 S1): thin-skill A/B on the StatCard exemplar.
//
// The lead spawns one fresh `implementer`-role subagent per cell and one blind `reviewer`-role
// subagent per round; this file is everything around them: it stages a scratch app, writes each
// cell's task, shoots the result, builds the blind review packet, records the verdicts in a ledger
// and prints the counts. It runs no model.
//
//   bun run.ts                         report: one JSON object (exit 0 = harness ran, not hypothesis held)
//   bun run.ts stage                   build the shared scratch package (basalt-ui .d.ts, js, css, docs)
//   bun run.ts prepare <cell>          create the cell's scratch app and TASK.md
//   bun run.ts shot <cell> <round>     build, serve and shoot at 1800x1200 and 390x844
//   bun run.ts packet <cell> <round>   build the blind review packet (opaque id from the seed)
//   bun run.ts record <cell> <round> <review.json>   write the reviewer's verdict into the ledger
//   bun run.ts lookups <cell> <transcript.jsonl>     count `.d.ts` tool calls in a subagent transcript
//   bun run.ts notrun <cell> <reason>  mark a cell `not run: <reason>`
//
// A cell id is `<brief>.<skill|noskill>.<hook|nohook>`, brief one of dashboard, list-detail, settings.
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const PKG_SRC = join(REPO, 'packages', 'basalt-ui')
const TMP = process.env.THIN_SKILL_TMP ?? join(tmpdir(), 'thin-skill')
const SHARED = join(TMP, 'shared')
const CELLS = join(TMP, 'cells')
const REVIEW = join(TMP, 'review')
const LEDGER = join(HERE, 'results', 'cells.json')
const SHOTS = join(HERE, 'shots')

const SEED = 587
const BRIEFS = ['dashboard', 'list-detail', 'settings'] as const
const LOOKUP_FAIL_LINE = 6
const MAX_ROUNDS = 3
const KILL_THRESHOLD = 3
const VIEWPORTS = [
  { name: 'desktop', width: 1800, height: 1200 },
  { name: 'mobile', width: 390, height: 844 },
] as const

type Brief = (typeof BRIEFS)[number]
type Finding = {
  id: string
  class: string
  viewports?: string[]
  where?: string
  evidence?: string
}
type Round = {
  round: number
  opaque: string
  p1: number
  carried: number
  findings: Finding[]
  previous: { id: string; status: 'open' | 'fixed' }[]
}
type Cell = {
  status: 'run' | 'not run'
  reason?: string
  rounds: Round[]
  lookups: number | null
  docReads: number | null
}
type Ledger = { seed: number; cells: Record<string, Cell> }

// ---- cell ids ------------------------------------------------------------------------------

function parseCell(id: string): { brief: Brief; skill: boolean; hook: boolean } {
  const [brief, skill, hook] = id.split('.')
  if (!BRIEFS.includes(brief as Brief) || !['skill', 'noskill'].includes(skill ?? ''))
    fail(`bad cell id ${id}`)
  if (!['hook', 'nohook'].includes(hook ?? '')) fail(`bad cell id ${id}`)
  return { brief: brief as Brief, skill: skill === 'skill', hook: hook === 'hook' }
}

const allCellIds = (): string[] =>
  BRIEFS.flatMap((b) =>
    ['noskill', 'skill'].flatMap((s) => ['nohook', 'hook'].map((h) => `${b}.${s}.${h}`)),
  )

const requiredCellIds = (): string[] =>
  BRIEFS.flatMap((b) => [`${b}.noskill.nohook`, `${b}.skill.nohook`])

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

// ---- ledger --------------------------------------------------------------------------------

function readLedger(): Ledger {
  if (!existsSync(LEDGER)) return { seed: SEED, cells: {} }
  return JSON.parse(readFileSync(LEDGER, 'utf8')) as Ledger
}

function writeLedger(ledger: Ledger): void {
  mkdirSync(dirname(LEDGER), { recursive: true })
  writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`)
}

function cellOf(ledger: Ledger, id: string): Cell {
  ledger.cells[id] ??= { status: 'run', rounds: [], lookups: null, docReads: null }
  return ledger.cells[id]
}

// ---- seeded shuffle: the blind reviewer sees an opaque id, never a cell id --------------------

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function opaqueIds(): Map<string, string> {
  const keys = allCellIds().flatMap((id) =>
    Array.from({ length: MAX_ROUNDS }, (_, i) => `${id}#${i + 1}`),
  )
  const rand = mulberry32(SEED)
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[keys[i], keys[j]] = [keys[j] as string, keys[i] as string]
  }
  return new Map(keys.map((key, index) => [key, `p${String(index + 1).padStart(2, '0')}`]))
}

// ---- stage: the shared scratch package -------------------------------------------------------

const STAGED_ENTRIES = [
  'src/cards/index.ts',
  'src/ui/card.tsx',
  'src/ui/badge.tsx',
  'src/ui/button.tsx',
  'src/ui/input.tsx',
  'src/ui/field.tsx',
  'src/ui/table.tsx',
]
const STAGED_DOCS = ['stat-card', 'card', 'badge', 'button', 'input', 'field', 'table']
const LINKED_DEPS = [
  'react',
  'react-dom',
  '@base-ui',
  '@fontsource-variable',
  '@types',
  'class-variance-authority',
  'clsx',
  'tailwindcss',
  '@tailwindcss',
  'typescript',
  'lightningcss',
  'jiti',
  '.bin',
]

function run(cmd: string, args: string[], cwd: string): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' })
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}` }
}

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  )

function stage(): void {
  const nm = join(HERE, 'node_modules')
  if (!existsSync(nm)) fail('run `bun install` in tools/spikes/thin-skill first')
  rmSync(SHARED, { recursive: true, force: true })
  mkdirSync(join(SHARED, 'node_modules'), { recursive: true })
  for (const name of readdirSync(nm)) {
    if (!LINKED_DEPS.includes(name) && !name.startsWith('@tailwindcss')) continue
    symlinkSync(join(nm, name), join(SHARED, 'node_modules', name))
  }

  // Declarations and JavaScript: tsc over a copy of the three source folders, so module resolution finds the harness deps.
  const build = join(HERE, '.build', 'pkg-src')
  rmSync(build, { recursive: true, force: true })
  for (const dir of ['core', 'ui', 'cards']) {
    cpSync(join(PKG_SRC, 'src', dir), join(build, 'src', dir), {
      recursive: true,
      filter: (path) => !/\.(test|guard|type-guard)\.tsx?$/.test(path) && !path.endsWith('.json'),
    })
  }
  rmSync(join(HERE, '.build', 'node_modules'), { force: true })
  symlinkSync(nm, join(HERE, '.build', 'node_modules'), 'dir')
  const dist = join(SHARED, 'node_modules', 'basalt-ui', 'dist')
  const tsc = run(
    join(nm, '.bin', 'tsc'),
    [
      ...STAGED_ENTRIES,
      '--ignoreConfig',
      '--declaration',
      '--outDir',
      dist,
      '--rootDir',
      'src',
      '--jsx',
      'react-jsx',
      '--module',
      'esnext',
      '--moduleResolution',
      'bundler',
      '--target',
      'es2022',
      '--lib',
      'es2023,dom,dom.iterable',
      '--strict',
      '--skipLibCheck',
      '--listEmittedFiles',
    ],
    build,
  )
  if (!tsc.ok) fail(`declaration emit failed:\n${tsc.out}`)

  const emitted = walk(dist).filter((f) => f.endsWith('.js')).length

  const pkg = join(SHARED, 'node_modules', 'basalt-ui')
  mkdirSync(join(pkg, 'css'), { recursive: true })
  for (const css of ['tailwind', 'tokens', 'fonts']) {
    cpSync(join(PKG_SRC, 'src', 'css', `${css}.css`), join(pkg, 'css', `${css}.css`))
  }
  mkdirSync(join(pkg, 'docs'), { recursive: true })
  for (const doc of STAGED_DOCS)
    cpSync(join(PKG_SRC, 'docs', `${doc}.md`), join(pkg, 'docs', `${doc}.md`))
  writeFileSync(
    join(pkg, 'package.json'),
    `${JSON.stringify(
      {
        name: 'basalt-ui',
        version: '3.0.0-spike',
        type: 'module',
        exports: {
          './cards': { types: './dist/cards/index.d.ts', import: './dist/cards/index.js' },
          './ui/*': { types: './dist/ui/*.d.ts', import: './dist/ui/*.js' },
          './tailwind.css': './css/tailwind.css',
          './tokens.css': './css/tokens.css',
        },
        peerDependencies: { '@base-ui/react': '~1.9.0', react: '^19' },
      },
      null,
      2,
    )}\n`,
  )
  cpSync(join(HERE, 'build.ts'), join(SHARED, 'build.ts'))
  cpSync(join(HERE, 'hook-stub'), join(SHARED, 'hook-stub'), { recursive: true })
  console.log(
    JSON.stringify({
      staged: SHARED,
      jsFiles: emitted,
      dts: walk(dist).filter((f) => f.endsWith('.d.ts')).length,
    }),
  )
}

// ---- prepare: one scratch app per cell ---------------------------------------------------------

function taskText(id: string, dir: string): string {
  const { brief, skill, hook } = parseCell(id)
  const briefText = readFileSync(join(HERE, 'briefs', `${brief}.md`), 'utf8')
  const lines = [
    '# Task',
    '',
    `You build one page in the scratch app in \`${dir}\`. Work only inside that directory: read and write nothing outside it. Do not start a dev server, do not take screenshots, do not browse the web and do not use the Skill tool.`,
    '',
    'The app is React 19 with Tailwind 4. The UI library `basalt-ui` is installed in `node_modules/basalt-ui`. Put the page in `src/App.tsx` (named export `App`, already mounted by `src/main.tsx`); add more files under `src/` if you want. Do not edit `src/app.css`, `src/main.tsx` or anything outside `src/`.',
    '',
    'Two commands must pass when you finish: `bun run build` and `bun run typecheck`.',
    '',
    ...(skill
      ? [
          'Before you write any code, read `.claude/skills/basalt-design/SKILL.md` and `.claude/skills/basalt-design/anti-defaults.md` in this directory, and follow them.',
          '',
        ]
      : []),
    ...(hook
      ? [
          `This project has an edit hook. After every edit or write of a \`.ts\` or \`.tsx\` file under \`src/\`, run \`bun ${join(SHARED, 'hook-stub', 'post-tool-use.ts')} <that file>\` from this directory. Exit code 2 means it reports findings on stderr: fix them before you move on.`,
          '',
        ]
      : []),
    'You may later be sent a list of defects found in your page; fix each at its source, then make the two commands pass again.',
    '',
    'When you are done, reply with the single word `done` and one line on what you built.',
    '',
    '---',
    '',
    briefText,
  ]
  return `${lines.join('\n')}\n`
}

function prepare(id: string): void {
  const { brief, skill } = parseCell(id)
  if (!existsSync(join(SHARED, 'node_modules', 'basalt-ui'))) fail('run `bun run.ts stage` first')
  const dir = join(CELLS, id)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  cpSync(join(HERE, 'template'), dir, { recursive: true })
  cpSync(join(HERE, 'template', 'src'), join(dir, '.base', 'src'), { recursive: true })
  const pkgPath = join(dir, 'package.json')
  writeFileSync(pkgPath, readFileSync(pkgPath, 'utf8').replaceAll('__SHARED__', SHARED))
  symlinkSync(join(SHARED, 'node_modules'), join(dir, 'node_modules'), 'dir')
  cpSync(join(HERE, 'briefs', `${brief}.md`), join(dir, 'BRIEF.md'))
  if (skill) {
    const target = join(dir, '.claude', 'skills', 'basalt-design')
    mkdirSync(target, { recursive: true })
    cpSync(join(HERE, 'skill', 'SKILL.md'), join(target, 'SKILL.md'))
    cpSync(join(HERE, 'skill', 'anti-defaults.md'), join(target, 'anti-defaults.md'))
  }
  writeFileSync(join(dir, 'TASK.md'), taskText(id, dir))
  const ledger = readLedger()
  cellOf(ledger, id)
  writeLedger(ledger)
  console.log(JSON.stringify({ cell: id, dir, task: join(dir, 'TASK.md') }))
}

// ---- shot: build, serve, shoot --------------------------------------------------------------------

async function shot(id: string, round: number): Promise<void> {
  parseCell(id)
  const dir = join(CELLS, id)
  if (!existsSync(dir)) fail(`no scratch app for ${id}: run prepare`)
  const built = run('bun', [join(SHARED, 'build.ts'), '.'], dir)
  if (!built.ok) fail(`build failed for ${id}:\n${built.out}`)
  const dist = join(dir, 'dist')
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const path = new URL(req.url).pathname
      if (path === '/favicon.ico') return new Response(null, { status: 204 })
      const file = Bun.file(join(dist, path === '/' ? 'index.html' : path))
      return file.size > 0 ? new Response(file) : new Response('not found', { status: 404 })
    },
  })
  const out = join(SHOTS, id, `r${round}`)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome' })
  const result: Record<string, unknown> = { cell: id, round }
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
      page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
      await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: join(out, `${vp.name}.png`), fullPage: true })
      result[vp.name] = {
        errors,
        scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
        scrollHeight: await page.evaluate(() => document.documentElement.scrollHeight),
      }
      await context.close()
    }
  } finally {
    await browser.close()
    server.stop(true)
  }
  console.log(JSON.stringify(result))
}

// ---- packet: the blind reviewer's directory -------------------------------------------------------------

function packet(id: string, round: number): void {
  parseCell(id)
  const dir = join(CELLS, id)
  const opaque = opaqueIds().get(`${id}#${round}`)
  if (!opaque) fail(`round ${round} is out of range`)
  const target = join(REVIEW, opaque)
  rmSync(target, { recursive: true, force: true })
  mkdirSync(join(target, 'shots'), { recursive: true })
  cpSync(join(HERE, 'rubric.md'), join(target, 'rubric.md'))
  cpSync(join(dir, 'BRIEF.md'), join(target, 'brief.md'))
  for (const vp of VIEWPORTS) {
    cpSync(join(SHOTS, id, `r${round}`, `${vp.name}.png`), join(target, 'shots', `${vp.name}.png`))
  }
  const diff = spawnSync('git', ['diff', '--no-index', '--no-color', '.base/src', 'src'], {
    cwd: dir,
    encoding: 'utf8',
  })
  writeFileSync(join(target, 'diff.patch'), diff.stdout)
  const lint = spawnSync(
    join(HERE, 'node_modules', '.bin', 'oxlint'),
    [
      '-c',
      join(HERE, 'hook-stub', 'oxlintrc.json'),
      '--format',
      'unix',
      '--disable-nested-config',
      join(dir, 'src'),
    ],
    { encoding: 'utf8' },
  )
  const findings = lint.stdout
    .split('\n')
    .filter((line) => /: .+\[(Error|Warning)/.test(line))
    .map((line) => line.replace(`${dir}/`, ''))
  writeFileSync(
    join(target, 'lint.txt'),
    findings.length === 0 ? 'clean\n' : `${findings.join('\n')}\n`,
  )
  if (round > 1) {
    const previous = readLedger().cells[id]?.rounds.find((r) => r.round === round - 1)
    if (!previous) fail(`round ${round - 1} of ${id} is not recorded`)
    const open = [
      ...previous.findings.map((f) => ({
        id: f.id,
        class: f.class,
        where: f.where,
        evidence: f.evidence,
      })),
      ...previous.previous
        .filter((p) => p.status === 'open')
        .map((p) => ({ id: p.id, carriedFrom: round - 2 })),
    ]
    writeFileSync(join(target, 'previous.json'), `${JSON.stringify(open, null, 2)}\n`)
  }
  console.log(JSON.stringify({ packet: target, opaque, lintFindings: findings.length }))
}

// ---- record / lookups / notrun ----------------------------------------------------------------------------

function record(id: string, round: number, file: string): void {
  parseCell(id)
  const raw = readFileSync(file, 'utf8')
  const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as {
    findings?: Finding[]
    previous?: { id: string; status: 'open' | 'fixed' }[]
  }
  const findings = json.findings ?? []
  const previous = json.previous ?? []
  const ledger = readLedger()
  const cell = cellOf(ledger, id)
  const opaque = opaqueIds().get(`${id}#${round}`) ?? ''
  const entry: Round = {
    round,
    opaque,
    p1: findings.length,
    carried: previous.filter((p) => p.status === 'open').length,
    findings,
    previous,
  }
  cell.rounds = [...cell.rounds.filter((r) => r.round !== round), entry].toSorted(
    (a, b) => a.round - b.round,
  )
  writeLedger(ledger)
  console.log(JSON.stringify({ cell: id, round, p1: entry.p1, carried: entry.carried }))
}

function strings(value: unknown, into: string[]): void {
  if (typeof value === 'string') into.push(value)
  else if (Array.isArray(value)) for (const v of value) strings(v, into)
  else if (value && typeof value === 'object')
    for (const v of Object.values(value)) strings(v, into)
}

function toolCalls(transcript: string): string[][] {
  const calls: string[][] = []
  for (const line of transcript.split('\n')) {
    if (!line.trim()) continue
    let event: { message?: { content?: unknown } }
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    const content = event.message?.content
    if (!Array.isArray(content)) continue
    for (const block of content as { type?: string; input?: unknown }[]) {
      if (block.type !== 'tool_use') continue
      const into: string[] = []
      strings(block.input, into)
      calls.push(into)
    }
  }
  return calls
}

function lookups(id: string, file: string): void {
  parseCell(id)
  const calls = toolCalls(readFileSync(file, 'utf8'))
  const dts = calls.filter((strs) => strs.some((s) => /\.d\.ts(?![\w.-])/.test(s))).length
  const docs = calls.filter((strs) =>
    strs.some((s) => /basalt-ui\/docs\/[\w-]+\.md/.test(s)),
  ).length
  const ledger = readLedger()
  const cell = cellOf(ledger, id)
  cell.lookups = dts
  cell.docReads = docs
  writeLedger(ledger)
  console.log(JSON.stringify({ cell: id, toolCalls: calls.length, lookups: dts, docReads: docs }))
}

function notRun(id: string, reason: string): void {
  parseCell(id)
  const ledger = readLedger()
  const cell = cellOf(ledger, id)
  cell.status = 'not run'
  cell.reason = reason
  writeLedger(ledger)
  console.log(JSON.stringify({ cell: id, status: `not run: ${reason}` }))
}

// ---- report ------------------------------------------------------------------------------------------------

function report(): void {
  const ledger = readLedger()
  const complete = (id: string): boolean => {
    const cell = ledger.cells[id]
    return cell?.status === 'run' && cell.rounds.length > 0
  }
  const total = (id: string): number =>
    (ledger.cells[id]?.rounds ?? []).reduce((sum, r) => sum + r.p1 + r.carried, 0)

  const cells: Record<string, unknown> = {}
  for (const id of allCellIds()) {
    const cell = ledger.cells[id]
    if (!cell || cell.status === 'not run' || cell.rounds.length === 0) {
      cells[id] = `not run: ${cell?.reason ?? 'no result recorded'}`
      continue
    }
    cells[id] = {
      p1: cell.rounds.reduce((s, r) => s + r.p1, 0),
      carried: cell.rounds.reduce((s, r) => s + r.carried, 0),
      p1AndCarried: total(id),
      round1P1: cell.rounds[0]?.p1 ?? null,
      rounds: cell.rounds.length,
      lookups: cell.lookups ?? `not run: no transcript counted`,
      docReads: cell.docReads,
    }
  }

  const missing = requiredCellIds().filter((id) => !complete(id))
  const perBrief = Object.fromEntries(
    BRIEFS.map((b) => [
      b,
      complete(`${b}.noskill.nohook`) && complete(`${b}.skill.nohook`)
        ? total(`${b}.noskill.nohook`) - total(`${b}.skill.nohook`)
        : null,
    ]),
  )
  const removed =
    missing.length === 0 ? Object.values(perBrief).reduce<number>((s, v) => s + (v ?? 0), 0) : null
  const kill = removed === null ? 'pending' : removed < KILL_THRESHOLD ? 'yes' : 'no'
  const killLine =
    kill === 'pending' ? `Kill: pending (not run: ${missing.join(', ')})` : `Kill: ${kill}`

  const counted = allCellIds()
    .map((id) => ledger.cells[id])
    .filter(
      (c): c is Cell => c?.status === 'run' && c.rounds.length > 0 && typeof c.lookups === 'number',
    )
  const meanLookups =
    counted.length === 0 ? null : counted.reduce((s, c) => s + (c.lookups ?? 0), 0) / counted.length

  console.log(
    JSON.stringify(
      {
        spike: 'thin-skill',
        seed: ledger.seed,
        kill,
        killLine,
        killDetail: { threshold: KILL_THRESHOLD, removedByHookOffPair: removed, perBrief, missing },
        cells,
        lookups: {
          failLine: LOOKUP_FAIL_LINE,
          countedCells: counted.length,
          mean: meanLookups,
          atOrAboveFailLine: meanLookups === null ? null : meanLookups >= LOOKUP_FAIL_LINE,
        },
        owner: 'pending',
      },
      null,
      2,
    ),
  )
}

// ---- main ----------------------------------------------------------------------------------------------------

const [command, a, b] = Bun.argv.slice(2)
switch (command) {
  case undefined:
    report()
    break
  case 'stage':
    stage()
    break
  case 'prepare':
    prepare(a ?? fail('prepare <cell>'))
    break
  case 'shot':
    await shot(a ?? fail('shot <cell> <round>'), Number(b ?? fail('shot <cell> <round>')))
    break
  case 'packet':
    packet(a ?? fail('packet <cell> <round>'), Number(b ?? fail('packet <cell> <round>')))
    break
  case 'record':
    record(
      a ?? fail('record <cell> <round> <file>'),
      Number(b ?? fail('record ...')),
      Bun.argv[5] ?? fail('record ...'),
    )
    break
  case 'lookups':
    lookups(a ?? fail('lookups <cell> <file>'), b ?? fail('lookups <cell> <file>'))
    break
  case 'notrun':
    notRun(a ?? fail('notrun <cell> <reason>'), b ?? fail('notrun <cell> <reason>'))
    break
  default:
    fail(`unknown command ${command}`)
}
