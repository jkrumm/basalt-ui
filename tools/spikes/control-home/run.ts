/**
 * Spike control-home (docs/v3/concepts/guardrails.md section 13 S3; controls-url-state.md section 9).
 * Throwaway harness, no tests.
 *
 * Question: after a shutterflow and an argo port, how many controls still sit outside every home,
 * and how many of those need a waiver? Above 5 per app the homes are redesigned, not the rule.
 *
 * Prints ONE JSON object on stdout and always exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr. Reads scratch copies in the OS temp dir only; never writes into a target
 * repo. Shutterflow is private: its sites are reported as hashed ids and counts.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import HOMES from './homes.json' with { type: 'json' }
import { hashId, scanDirs, scanFile, scratchCopy } from './scan'
import type { Site } from './scan'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')
const pkgSrc = join(repoRoot, 'packages', 'basalt-ui', 'src')
const log = (msg: string): void => {
  process.stderr.write(`${msg}\n`)
}
const cmp = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0)

const CEILING = 5

interface Target {
  name: 'argo' | 'shutterflow'
  root: string
  dirs: string[]
  visibility: 'public' | 'private'
}

const TARGETS: Target[] = [
  {
    name: 'argo',
    root: join(homedir(), 'SourceRoot', 'argo'),
    dirs: ['apps/dashboard/src'],
    visibility: 'public',
  },
  {
    name: 'shutterflow',
    root: join(homedir(), 'SourceRoot', 'shutterflow'),
    dirs: ['apps/desktop/src', 'apps/gallery/src'],
    visibility: 'private',
  },
]

const homeTable = HOMES.components as Record<string, Record<string, string>>

function homeFor(app: string, site: Site): string {
  if (site.verdict === 'fits a home')
    return site.source === 'form' ? 'FormField' : 'handle-bound composite'
  const key = app === 'argo' ? site.component : hashId(`c:${site.component}`)
  return homeTable[app]?.[key] ?? 'unassigned'
}

function measure(target: Target, scratch: string) {
  const dirs = scratchCopy(target.root, target.dirs, join(scratch, target.name))
  const r = scanDirs(dirs, join(scratch, target.name))
  const waivers = r.residue.filter((s) => s.verdict === 'waiver')
  const byHome: Record<string, number> = {}
  for (const s of r.residue) {
    const h = homeFor(target.name, s)
    byHome[h] = (byHome[h] ?? 0) + (s.verdict === 'waiver' ? 1 : 0)
  }
  const bySource: Record<string, number> = {}
  for (const s of r.residue) bySource[s.source] = (bySource[s.source] ?? 0) + 1
  const sites = r.residue
    .map((s) => ({
      ...(target.visibility === 'public'
        ? { file: s.file, line: s.line, component: s.component }
        : { id: hashId(`${s.file}:${s.line}`), fileId: hashId(s.file) }),
      tag: s.tag,
      primitive: s.primitive,
      source: s.source,
      verdict: s.verdict,
      home: homeFor(target.name, s),
    }))
    .toSorted((a, b) => cmp(JSON.stringify(a), JSON.stringify(b)))
  const unassigned = waivers.filter((s) => homeFor(target.name, s) === 'unassigned').length
  return {
    files: r.files,
    controls: r.controls,
    inHome: r.inHome,
    residue: r.residue.length,
    fitsHome: r.residue.length - waivers.length,
    waivers: waivers.length,
    waiverFiles: new Set(waivers.map((s) => s.file)).size,
    waiverComponents: new Set(waivers.map((s) => `${s.file}#${s.component}`)).size,
    bySource,
    waiversByHome: Object.fromEntries(Object.entries(byHome).toSorted(([a], [b]) => cmp(a, b))),
    unassigned,
    sites,
  }
}

function fixtureOutcome(name: string): 'flagged' | 'clean' {
  const r = scanFile(join(here, 'fixtures', name), here)
  return r.residue.length > 0 ? 'flagged' : 'clean'
}

const lineOf = (d: ts.Diagnostic): number =>
  d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0

/** Compiles the fourth fixture against the package src; `type-error` iff exactly the marked line fails. */
function globalInCard(): { outcome: string; diagnostics: string[] } {
  const tmp = mkdtempSync(join(tmpdir(), 'ch-fixture-'))
  try {
    const src = readFileSync(
      join(here, 'fixtures', 'global-in-card.fixture.txt'),
      'utf8',
    ).replaceAll('@SRC', pkgSrc)
    const file = join(tmp, 'global-in-card.ts')
    const lines = src.split('\n')
    const marked = lines.findIndex((l) => l.includes('EXPECT-ERROR')) + 1
    ts.sys.writeFile(file, src)
    const nm = join(here, 'node_modules')
    const program = ts.createProgram([file], {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      types: [],
      allowImportingTsExtensions: true,
      pathsBasePath: here,
      paths: { '*': [`${nm}/@types/*`, `${nm}/*`] },
    })
    const all = ts.getPreEmitDiagnostics(program)
    const own = all.filter(
      (d) => d.file?.fileName === file && d.category === ts.DiagnosticCategory.Error,
    )
    const diagnostics = own.map((d) => `L${lineOf(d)} TS${d.code}`)
    const onMarked = own.filter((d) => lineOf(d) === marked)
    const elsewhere = own.filter((d) => lineOf(d) !== marked)
    const outcome =
      onMarked.length > 0 && elsewhere.length === 0
        ? 'type-error'
        : own.length === 0
          ? 'clean'
          : 'harness-error'
    return { outcome, diagnostics }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function main(): void {
  const scratch = mkdtempSync(join(tmpdir(), 'control-home-'))
  try {
    const apps: Record<string, ReturnType<typeof measure>> = {}
    for (const t of TARGETS) {
      log(`[${t.name}] scanning scratch copy`)
      apps[t.name] = measure(t, scratch)
    }
    const argo = apps.argo
    const shutterflow = apps.shutterflow
    if (!argo || !shutterflow) throw new Error('missing target')
    const card = globalInCard()
    const fixtures = {
      bodyChildren: fixtureOutcome('body-children.fixture.txt'),
      filterSlotCustomUseState: fixtureOutcome('filter-slot-custom-state.fixture.txt'),
      handleBoundComposite: fixtureOutcome('handle-bound-composite.fixture.txt'),
      globalSpecInCardSlot: card.outcome,
    }
    const verdict =
      argo.waivers > CEILING || shutterflow.waivers > CEILING ? 'S3: REFUTED' : 'S3: PASS'
    const out = {
      spike: 'control-home',
      ceiling: CEILING,
      targets: Object.fromEntries(
        TARGETS.map((t) => [
          t.name,
          {
            visibility: t.visibility,
            dirs: t.dirs,
            ...(t.visibility === 'public' ? { head: headOf(t.root) } : {}),
          },
        ]),
      ),
      argo: { ...argo, residue: argo.residue, waivers: argo.waivers },
      shutterflow: { ...shutterflow, residue: shutterflow.residue, waivers: shutterflow.waivers },
      fixtures,
      fixtureDetail: { globalSpecInCardSlot: card.diagnostics },
      verdict,
    }
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

function headOf(root: string): string {
  try {
    const head = readFileSync(join(root, '.git', 'HEAD'), 'utf8').trim()
    if (!head.startsWith('ref: ')) return head.slice(0, 8)
    const ref = readFileSync(join(root, '.git', head.slice(5)), 'utf8').trim()
    return ref.slice(0, 8)
  } catch {
    return 'unknown'
  }
}

main()
