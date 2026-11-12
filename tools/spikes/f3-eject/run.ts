// Spike f3-eject (docs/v3/ARCHITECTURE.md section 11 F3): same-bar agent trial, npm default
// versus `eject --all`, counting the ejects an agent makes.
//
// The lead spawns one fresh `implementer`-role subagent per cell and one blind `reviewer`-role
// subagent per round; this file is everything around them: it stages a scratch package that looks
// like an installed basalt-ui, writes each cell's task, shoots the result, builds the blind review
// packet, records the verdicts in a ledger and prints the counts. It runs no model.
//
//   bun run.ts                         report: one JSON object (exit 0 = harness ran, not hypothesis held)
//   bun run.ts stage                   build the shared scratch package (dist, seeds, css, docs, vite plugin, bin)
//   bun run.ts prepare <cell>          create the cell's scratch app and TASK.md (arm eject: runs `eject --all` first)
//   bun run.ts shot <cell> <round>     build with vite, serve and shoot at 1800x1200 and 390x844
//   bun run.ts packet <cell> <round>   build the blind review packet (opaque id from the seed)
//   bun run.ts record <cell> <round> <review.json>   write the reviewer's verdict into the ledger
//   bun run.ts ejects <cell>           read the cell's eject log into the ledger
//   bun run.ts notrun <cell> <reason>  mark a cell `not run: <reason>`
//
// A cell id is `<brief>.<arm>`: brief one of statcards, table; arm `npm` (arm 1, the default
// distribution) or `eject` (arm 2, `eject --all` run in the scratch app before the agent starts).
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const PKG_SRC = join(REPO, 'packages', 'basalt-ui')
const TMP = process.env.F3_EJECT_TMP ?? join(tmpdir(), 'f3-eject')
const SHARED = join(TMP, 'shared')
const CELLS = join(TMP, 'cells')
const REVIEW = join(TMP, 'review')
const LEDGER = join(HERE, 'results', 'cells.json')
const SHOTS = join(HERE, 'shots')
const LOG = '.f3-ejects.jsonl'

const SEED = 841
const BRIEFS = ['statcards', 'table'] as const
const ARMS = ['npm', 'eject'] as const
const MAX_ROUNDS = 3
const REFUTE_GAP = 3
const REFUTE_EJECTS = 3
const VIEWPORTS = [
  { name: 'desktop', width: 1800, height: 1200 },
  { name: 'mobile', width: 390, height: 844 },
] as const

type Brief = (typeof BRIEFS)[number]
type Arm = (typeof ARMS)[number]
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
type Ejects = { invocations: number; succeeded: number; primitives: string[] }
type Cell = {
  status: 'run' | 'not run'
  reason?: string
  rounds: Round[]
  ejects: Ejects | null
}
type Ledger = { seed: number; cells: Record<string, Cell> }

// ---- cell ids ------------------------------------------------------------------------------

function parseCell(id: string): { brief: Brief; arm: Arm } {
  const [brief, arm] = id.split('.')
  if (!BRIEFS.includes(brief as Brief) || !ARMS.includes(arm as Arm)) fail(`bad cell id ${id}`)
  return { brief: brief as Brief, arm: arm as Arm }
}

const allCellIds = (): string[] => BRIEFS.flatMap((b) => ARMS.map((a) => `${b}.${a}`))

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
  ledger.cells[id] ??= { status: 'run', rounds: [], ejects: null }
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

// ---- helpers -------------------------------------------------------------------------------------

function run(cmd: string, args: string[], cwd: string): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' })
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}` }
}

const walk = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      )
    : []

// ---- stage: the shared scratch package -------------------------------------------------------------
//
// What a consumer sees after `bun add basalt-ui`: compiled `dist/**` (js + d.ts) of the core, ui and
// cards sources, the seeds and guards under `src/ui` (the tarball ships `src/`), the three CSS sheets,
// the generated docs, `basalt-ui/vite` (the real v3 `basalt()` bundled from src/vite) and a
// `basalt-ui` bin that runs the real `eject`, logging every invocation.

const LINKED_DEPS = [
  'react',
  'react-dom',
  '@base-ui',
  '@types',
  'class-variance-authority',
  'clsx',
  'tailwindcss',
  '@tailwindcss',
  'typescript',
  'vite',
  '@vitejs',
  '@tanstack',
  '@fontsource-variable',
  'oxlint',
]

const BIN = `#!/usr/bin/env bun
// basalt-ui bin of the f3-eject scratch package: \`eject\` only, every call logged.
import { appendFileSync, existsSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { eject } from '../dist/cli-eject.js'

const [verb, ...flags] = process.argv.slice(2)
if (verb !== 'eject') {
  console.error('basalt-ui: this scratch install ships \`eject\` only. Try \`basalt-ui eject --help\`.')
  process.exit(1)
}
const pkgRoot = realpathSync(join(dirname(new URL(import.meta.url).pathname), '..'))
const code = eject(flags, process.cwd(), { pkgRoot })
let dir = process.cwd()
while (!existsSync(join(dir, '.basalt', 'manifest.json')) && dirname(dir) !== dir) dir = dirname(dir)
if (existsSync(join(dir, '.basalt', 'manifest.json'))) {
  const line = { at: new Date().toISOString(), argv: flags, code }
  appendFileSync(join(dir, '${LOG}'), JSON.stringify(line) + '\\n')
}
process.exit(code)
`

function stage(): void {
  const nm = join(HERE, 'node_modules')
  if (!existsSync(nm)) fail('run `bun install` in tools/spikes/f3-eject first')
  rmSync(SHARED, { recursive: true, force: true })
  const sharedNm = join(SHARED, 'node_modules')
  mkdirSync(sharedNm, { recursive: true })
  for (const name of readdirSync(nm)) {
    if (!LINKED_DEPS.includes(name)) continue
    symlinkSync(join(nm, name), join(sharedNm, name))
  }

  // Declarations and JavaScript: tsc over a copy of the source folders, so module resolution finds the harness deps.
  const build = join(TMP, 'build', 'pkg-src')
  rmSync(build, { recursive: true, force: true })
  for (const dir of ['core', 'ui', 'cards', 'tokens', 'common']) {
    cpSync(join(PKG_SRC, 'src', dir), join(build, 'src', dir), {
      recursive: true,
      filter: (path) =>
        !/\.(test|guard|type-guard|type-test|contract)\.tsx?$/.test(path) &&
        !/guard-completeness/.test(path) &&
        !path.endsWith('.json'),
    })
  }
  writeFileSync(
    join(build, 'src', 'index.ts'),
    "export { cn } from './core/cn'\nexport type { ClassValue } from './core/cn'\n",
  )
  rmSync(join(TMP, 'build', 'node_modules'), { force: true })
  symlinkSync(nm, join(TMP, 'build', 'node_modules'), 'dir')
  const pkg = join(sharedNm, 'basalt-ui')
  const dist = join(pkg, 'dist')
  const uiEntries = readdirSync(join(build, 'src', 'ui'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `src/ui/${f}`)
  const tsc = run(
    join(nm, '.bin', 'tsc'),
    [
      'src/index.ts',
      'src/cards/index.ts',
      ...uiEntries,
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
      '--types',
      'node',
      '--strict',
      '--skipLibCheck',
    ],
    build,
  )
  if (!tsc.ok) fail(`declaration emit failed:\n${tsc.out}`)

  // Composites and siblings reach a primitive by its published specifier, so an ejected file is
  // followed (ARCHITECTURE 4.1: "npm composites follow"). The source imports them relatively.
  let rewritten = 0
  for (const file of walk(dist).filter((f) => /\.(js|d\.ts)$/.test(f))) {
    const rel = relative(dist, file)
    const text = readFileSync(file, 'utf8')
    const next = rel.startsWith('ui/')
      ? text.replace(/(from\s+['"])\.\/([a-z0-9-]+)(['"])/g, (m, a, name, c) =>
          existsSync(join(build, 'src', 'ui', `${name}.tsx`)) ? `${a}basalt-ui/ui/${name}${c}` : m,
        )
      : text.replace(/(from\s+['"])\.\.\/ui\/([a-z0-9-]+)(['"])/g, '$1basalt-ui/ui/$2$3')
    if (next !== text) {
      writeFileSync(file, next)
      rewritten++
    }
  }

  // The seeds and guards (what `eject` copies), the cn module they import, and the css.
  mkdirSync(join(pkg, 'src', 'ui'), { recursive: true })
  mkdirSync(join(pkg, 'src', 'core'), { recursive: true })
  for (const f of readdirSync(join(PKG_SRC, 'src', 'ui'))) {
    if (/\.(test|type-guard|contract)\.tsx?$/.test(f) || f === 'guard-completeness.ts') continue
    if (!/\.(tsx|guard\.ts)$/.test(f)) continue
    // Master's eject refuses 14 seeds because their `../core/*` and `../tokens` imports have no published
    // specifier (finding, docs/v3/spikes/f3-eject.md). The stand-in for the missing publish-time
    // rewrite: the staged seed names them as `basalt-ui/core/*` and `basalt-ui/tokens`, which the
    // staged package exports. The rewrite is the same for both arms.
    const seed = readFileSync(join(PKG_SRC, 'src', 'ui', f), 'utf8')
      .replace(/(from\s+['"])\.\.\/core\/(?!cn['"])([\w/-]+)(['"])/g, '$1basalt-ui/core/$2$3')
      .replace(/(from\s+['"])\.\.\/tokens(['"])/g, '$1basalt-ui/tokens$2')
    writeFileSync(join(pkg, 'src', 'ui', f), seed)
  }
  for (const f of ['cn.ts', 'cn-theme.ts']) {
    cpSync(join(PKG_SRC, 'src', 'core', f), join(pkg, 'src', 'core', f))
  }
  mkdirSync(join(pkg, 'css'), { recursive: true })
  for (const css of ['tailwind', 'tokens', 'fonts']) {
    cpSync(join(PKG_SRC, 'src', 'css', `${css}.css`), join(pkg, 'css', `${css}.css`))
  }

  // Generated docs: one per shipped primitive and composite, plus the two verbs an app reads.
  mkdirSync(join(pkg, 'docs'), { recursive: true })
  const wanted = new Set(['eject', 'vite'])
  for (const f of readdirSync(join(PKG_SRC, 'src', 'ui')))
    if (f.endsWith('.tsx') && !f.endsWith('.test.tsx')) wanted.add(f.slice(0, -4))
  for (const name of [
    'stat-card',
    'stat-cell',
    'stat-group',
    'data-panel',
    'event-list',
    'bar-list',
  ])
    wanted.add(name)
  let docs = 0
  for (const name of wanted) {
    const src = join(PKG_SRC, 'docs', `${name}.md`)
    if (!existsSync(src)) continue
    cpSync(src, join(pkg, 'docs', `${name}.md`))
    docs++
  }

  // The real `basalt()` and the real `eject`, bundled from this checkout.
  const vite = run(
    'bun',
    [
      'build',
      join(PKG_SRC, 'src', 'vite', 'index.ts'),
      '--target',
      'node',
      '--external',
      'vite',
      '--outfile',
      join(dist, 'vite.js'),
    ],
    HERE,
  )
  if (!vite.ok) fail(`vite plugin bundle failed:\n${vite.out}`)
  const ejectBundle = run(
    'bun',
    [
      'build',
      join(PKG_SRC, 'src', 'cli', 'eject', 'index.ts'),
      '--target',
      'bun',
      '--external',
      'vite',
      '--external',
      'typescript',
      '--outfile',
      join(dist, 'cli-eject.js'),
    ],
    HERE,
  )
  if (!ejectBundle.ok) fail(`eject bundle failed:\n${ejectBundle.out}`)

  cpSync(join(HERE, 'hook-stub'), join(SHARED, 'hook-stub'), { recursive: true })
  mkdirSync(join(pkg, 'bin'), { recursive: true })
  writeFileSync(join(pkg, 'bin', 'basalt-ui.mjs'), BIN)
  chmodSync(join(pkg, 'bin', 'basalt-ui.mjs'), 0o755)
  const bins = join(sharedNm, '.bin')
  mkdirSync(bins, { recursive: true })
  for (const name of readdirSync(join(nm, '.bin'))) {
    symlinkSync(realpathSync(join(nm, '.bin', name)), join(bins, name))
  }
  symlinkSync(join(pkg, 'bin', 'basalt-ui.mjs'), join(bins, 'basalt-ui'))

  writeFileSync(
    join(pkg, 'package.json'),
    `${JSON.stringify(
      {
        name: 'basalt-ui',
        version: '3.0.0-spike',
        type: 'module',
        bin: { 'basalt-ui': './bin/basalt-ui.mjs' },
        exports: {
          '.': { types: './dist/index.d.ts', import: './dist/index.js' },
          './cards': { types: './dist/cards/index.d.ts', import: './dist/cards/index.js' },
          './core/*': { types: './dist/core/*.d.ts', import: './dist/core/*.js' },
          './tokens': { types: './dist/tokens/index.d.ts', import: './dist/tokens/index.js' },
          './ui/*': { types: './dist/ui/*.d.ts', import: './dist/ui/*.js' },
          './vite': { import: './dist/vite.js' },
          './tailwind.css': './css/tailwind.css',
          './tokens.css': './css/tokens.css',
          './fonts.css': './css/fonts.css',
        },
        peerDependencies: { '@base-ui/react': '~1.9.0', react: '^19' },
      },
      null,
      2,
    )}\n`,
  )
  console.log(
    JSON.stringify({
      staged: SHARED,
      jsFiles: walk(dist).filter((f) => f.endsWith('.js')).length,
      dts: walk(dist).filter((f) => f.endsWith('.d.ts')).length,
      rewrittenFiles: rewritten,
      seeds: readdirSync(join(pkg, 'src', 'ui')).filter((f) => f.endsWith('.tsx')).length,
      docs,
    }),
  )
}

// ---- prepare: one scratch app per cell ---------------------------------------------------------------

const NOTES_COMMON = [
  '- The UI library is `basalt-ui`, installed in `node_modules/basalt-ui`. Its primitives are `basalt-ui/ui/<name>` (card, badge, button, input, table, …); its composites are `basalt-ui/cards` (StatCard, StatGroup, StatCell, …).',
  '- Generated docs: `node_modules/basalt-ui/docs/<name>.md` (use when, never when, props, an example). Primitive source: `node_modules/basalt-ui/src/ui/<name>.tsx`. Types: `node_modules/basalt-ui/dist/**/*.d.ts`.',
  "- Style with the theme's utility classes only: no raw colours, no arbitrary values (`w-[312px]`), no inline `style` for colour, size or spacing, no palette classes such as `bg-blue-500`.",
]
const NOTES_ARM: Record<Arm, string[]> = {
  npm: [
    '- Primitives come from npm. If a primitive cannot do what the brief needs through its own props, `basalt-ui eject <name> --reason "<why>"` copies its source into `src/components/ui/<name>.tsx` under the same import specifier, and you may then edit that file. Prefer the primitive\'s own props; eject only when you must.',
  ],
  eject: [
    '- Every primitive is already a file of yours in `src/components/ui/<name>.tsx` (the import specifier `basalt-ui/ui/<name>` resolves to it). Edit those files when the brief needs it; composites in `basalt-ui/cards` use them.',
  ],
}

function taskText(id: string, dir: string): string {
  const { brief, arm } = parseCell(id)
  const briefText = readFileSync(join(HERE, 'briefs', `${brief}.md`), 'utf8')
  const lines = [
    '# Task',
    '',
    `You build one page in the scratch app in \`${dir}\`. Work only inside that directory: read and write nothing outside it. Do not start a dev server, do not take screenshots, do not browse the web and do not use the Skill tool.`,
    '',
    'The app is React 19 with Tailwind 4 and Vite. Put the page in `src/App.tsx` (named export `App`, already mounted by `src/main.tsx`); add more files under `src/` if you want. Do not edit `src/app.css`, `src/main.tsx`, `vite.config.ts` or anything outside `src/`.',
    '',
    'Project notes:',
    ...NOTES_COMMON,
    ...NOTES_ARM[arm],
    '',
    'Two commands must pass when you finish: `bun run build` and `bun run typecheck`.',
    '',
    `This project has an edit hook. After every edit or write of a \`.ts\` or \`.tsx\` file under \`src/\` (not under \`src/components/ui/\`), run \`bun ${join(SHARED, 'hook-stub', 'post-tool-use.ts')} <that file>\` from this directory. Exit code 2 means it reports findings on stderr: fix them before you move on.`,
    '',
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

function git(dir: string, ...args: string[]): void {
  const r = spawnSync(
    'git',
    ['-c', 'user.name=spike', '-c', 'user.email=spike@example.com', ...args],
    { cwd: dir, encoding: 'utf8' },
  )
  if (r.status !== 0) fail(`git ${args.join(' ')}: ${r.stderr}`)
}

function prepare(id: string): void {
  const { brief, arm } = parseCell(id)
  if (!existsSync(join(SHARED, 'node_modules', 'basalt-ui'))) fail('run `bun run.ts stage` first')
  const dir = join(CELLS, id)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  cpSync(join(HERE, 'template'), dir, { recursive: true })
  symlinkSync(join(SHARED, 'node_modules'), join(dir, 'node_modules'), 'dir')
  cpSync(join(HERE, 'briefs', `${brief}.md`), join(dir, 'BRIEF.md'))
  writeFileSync(join(dir, '.gitignore'), `node_modules\ndist\n${LOG}\n.base\n`)
  git(dir, 'init', '-q', '-b', 'main')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'template')

  let harnessEjects = 0
  if (arm === 'eject') {
    const bin = join(SHARED, 'node_modules', 'basalt-ui', 'bin', 'basalt-ui.mjs')
    const out = run(
      bin,
      [
        'eject',
        '--all',
        '--reason',
        'managed copy of every primitive',
        '--raise',
        'f3-eject trial arm 2',
      ],
      dir,
    )
    if (!out.ok) fail(`eject --all failed:\n${out.out}`)
    harnessEjects = readdirSync(join(dir, 'src', 'components', 'ui')).filter((f) =>
      f.endsWith('.tsx'),
    ).length
    // The harness's own call is not the agent's: the log restarts empty.
    rmSync(join(dir, LOG), { force: true })
    git(dir, 'add', '-A')
    git(dir, 'commit', '-q', '-m', 'eject --all')
  }
  cpSync(join(dir, 'src'), join(dir, '.base', 'src'), { recursive: true })
  writeFileSync(join(dir, 'TASK.md'), taskText(id, dir))
  const ledger = readLedger()
  cellOf(ledger, id)
  writeLedger(ledger)
  console.log(
    JSON.stringify({
      cell: id,
      dir,
      task: join(dir, 'TASK.md'),
      harnessEjectedFiles: harnessEjects,
    }),
  )
}

// ---- shot: build, serve, shoot --------------------------------------------------------------------

async function shot(id: string, round: number): Promise<void> {
  parseCell(id)
  const dir = join(CELLS, id)
  if (!existsSync(dir)) fail(`no scratch app for ${id}: run prepare`)
  const built = run(join(SHARED, 'node_modules', '.bin', 'vite'), ['build'], dir)
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

/** A file under `src/` the agent did not author: an ejected seed still byte-identical to its merge base. */
function pristineEject(dir: string, rel: string): boolean {
  if (!/^src\/components\/ui\/[a-z0-9-]+\.(tsx|guard\.ts)$/.test(rel)) return false
  const base = join(dir, '.basalt', 'base', 'src', rel.slice('src/components/ui/'.length))
  const text = readFileSync(join(dir, rel), 'utf8')
  if (text.startsWith('// basalt:ejected ')) {
    return existsSync(base) && text.slice(text.indexOf('\n') + 1) === readFileSync(base, 'utf8')
  }
  return rel.endsWith('.guard.ts')
}

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

  // The diff is the agent's change: ejected files it never touched stay out of it (and out of the lint).
  const view = join(TMP, 'view', id)
  rmSync(view, { recursive: true, force: true })
  cpSync(join(dir, 'src'), join(view, 'src'), { recursive: true })
  for (const file of walk(join(dir, 'src'))) {
    const rel = relative(dir, file)
    const base = join(dir, '.base', rel)
    if (!existsSync(base) && pristineEject(dir, rel)) rmSync(join(view, rel))
  }
  cpSync(join(dir, '.base', 'src'), join(view, '.base', 'src'), { recursive: true })
  const diff = spawnSync('git', ['diff', '--no-index', '--no-color', '.base/src', 'src'], {
    cwd: view,
    encoding: 'utf8',
  })
  writeFileSync(join(target, 'diff.patch'), diff.stdout)

  const changed = walk(join(view, 'src')).filter((file) => {
    const rel = relative(view, file)
    if (!/\.(ts|tsx)$/.test(rel) || rel.startsWith('src/components/ui/')) return false
    const base = join(view, '.base', rel)
    return !existsSync(base) || readFileSync(base, 'utf8') !== readFileSync(file, 'utf8')
  })
  const findings =
    changed.length === 0
      ? []
      : spawnSync(
          join(HERE, 'node_modules', '.bin', 'oxlint'),
          [
            '-c',
            join(HERE, 'hook-stub', 'oxlintrc.json'),
            '--format',
            'unix',
            '--disable-nested-config',
            ...changed,
          ],
          { encoding: 'utf8' },
        )
          .stdout.split('\n')
          .filter((line) => /: .+\[(Error|Warning)/.test(line))
          .map((line) => line.replace(`${view}/`, ''))
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

// ---- record / ejects / notrun -------------------------------------------------------------------------------

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

/** The agent's `basalt-ui eject` invocations, from the bin's log; harness calls are not in it. */
function ejects(id: string): void {
  parseCell(id)
  const log = join(CELLS, id, LOG)
  const lines = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : []
  // Reading the help is not an eject.
  const calls = lines
    .map((l) => JSON.parse(l) as { argv: string[]; code: number })
    .filter((c) => !c.argv.includes('--help') && !c.argv.includes('-h'))
  const primitives = calls
    .filter((c) => c.code === 0)
    .flatMap((c) => {
      const name = c.argv.find((a, i) => !a.startsWith('--') && !c.argv[i - 1]?.startsWith('--'))
      return c.argv.includes('--all') ? ['(all)'] : name ? [name] : []
    })
  const entry: Ejects = {
    invocations: calls.length,
    succeeded: calls.filter((c) => c.code === 0).length,
    primitives,
  }
  const ledger = readLedger()
  cellOf(ledger, id).ejects = entry
  writeLedger(ledger)
  console.log(JSON.stringify({ cell: id, ...entry }))
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
    return cell?.status === 'run' && cell.rounds.length > 0 && cell.ejects !== null
  }
  const total = (id: string): number =>
    (ledger.cells[id]?.rounds ?? []).reduce((sum, r) => sum + r.p1 + r.carried, 0)

  const arm = (a: Arm) => {
    const per = (f: (id: string) => number | string) =>
      Object.fromEntries(
        BRIEFS.map((b) => {
          const id = `${b}.${a}`
          return [
            b,
            complete(id) ? f(id) : `not run: ${ledger.cells[id]?.reason ?? 'no result recorded'}`,
          ]
        }),
      )
    return {
      p1PlusCarried: per(total),
      ejects: per((id) => ledger.cells[id]?.ejects?.invocations ?? 0),
      ejectedPrimitives: per((id) => ledger.cells[id]?.ejects?.primitives.join(',') ?? ''),
      rounds: per((id) => ledger.cells[id]?.rounds.length ?? 0),
    }
  }
  const arm1 = arm('npm')
  const arm2 = arm('eject')

  const missing = allCellIds().filter((id) => !complete(id))
  const sum = (a: Arm): number => BRIEFS.reduce((s, b) => s + total(`${b}.${a}`), 0)
  const gap = missing.length === 0 ? sum('npm') - sum('eject') : null
  const mostEjects =
    missing.length === 0
      ? Math.max(...BRIEFS.map((b) => ledger.cells[`${b}.npm`]?.ejects?.invocations ?? 0))
      : null
  const refuted =
    gap !== null && mostEjects !== null && (gap >= REFUTE_GAP || mostEjects > REFUTE_EJECTS)
  const verdict = refuted ? 'refuted' : 'pending'

  console.log(
    JSON.stringify(
      {
        spike: 'f3-eject',
        seed: ledger.seed,
        arm1,
        arm2,
        verdict,
        verdictDetail: {
          rule: `refuted when arm 1 sums ${REFUTE_GAP}+ P1-plus-carried above arm 2, or arm 1 ejects exceed ${REFUTE_EJECTS} in one app; partial (reported as pending) when G1 holds and G2 is open`,
          gapArm1MinusArm2: gap,
          mostArm1Ejects: mostEjects,
          missing,
        },
        g2: 'pending G2',
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
  case 'ejects':
    ejects(a ?? fail('ejects <cell>'))
    break
  case 'notrun':
    notRun(a ?? fail('notrun <cell> <reason>'), b ?? fail('notrun <cell> <reason>'))
    break
  default:
    fail(`unknown command ${command}`)
}
