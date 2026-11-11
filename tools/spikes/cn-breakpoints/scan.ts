/** Target repos, read-only scratch copies, visibility policy. Never writes into a target repo. */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import ts from 'typescript'

export type RepoName = 'console' | 'epos' | 'linewatch' | 'argo'
export type Visibility = 'public' | 'private' | 'counts-only'

export interface RepoDef {
  name: RepoName
  /** the git toplevel */
  root: string
  /** relative to `root` */
  scanDir: string
}

const home = homedir()

/**
 * The employer repo is located by shape, not by a tracked path: a direct child of `~/IuRoot`
 * with a git dir and `ui/src/lib/cn.ts`. `EPOS_ROOT` (git toplevel) and `EPOS_SCAN_DIR` override.
 */
function epos(): RepoDef[] {
  const scanDir = process.env.EPOS_SCAN_DIR ?? 'ui/src'
  const fromEnv = process.env.EPOS_ROOT
  const candidates = fromEnv ? [fromEnv] : childDirs(join(home, 'IuRoot'))
  const root = candidates.find(
    (d) => existsSync(join(d, '.git')) && existsSync(join(d, scanDir, 'lib', 'cn.ts')),
  )
  if (!root) {
    process.stderr.write('[epos] not found: epos skipped\n')
    return []
  }
  return [{ name: 'epos', root, scanDir }]
}

function childDirs(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(dir, e.name))
    .toSorted()
}

export const REPOS: readonly RepoDef[] = [
  {
    name: 'console',
    root: join(home, 'SourceRoot', 'software-factory'),
    scanDir: 'apps/console/src',
  },
  ...epos(),
  { name: 'linewatch', root: join(home, 'SourceRoot', 'linewatch'), scanDir: 'web/src' },
  { name: 'argo', root: join(home, 'SourceRoot', 'argo'), scanDir: 'apps/dashboard/src' },
]

export interface SourceFile {
  /** relative to the git root */
  rel: string
  text: string
  tsx: boolean
  /** a bought primitive's own source: zone S */
  ui: boolean
}

export interface ScannedRepo {
  def: RepoDef
  visibility: Visibility
  head: string | null
  files: SourceFile[]
  lines: number
  tsxLines: number
}

const UI_RE = /\/components\/ui\//
const EXCLUDED_DIRS = ['/test/', '/tests/', '/__tests__/', '/e2e/']

function keep(rel: string): boolean {
  if (!/\.tsx?$/.test(rel)) return false
  if (/\.(test|spec)\./.test(rel) || rel.endsWith('.d.ts') || /\.gen\.tsx?$/.test(rel)) return false
  return !EXCLUDED_DIRS.some((d) => `/${rel}`.includes(d))
}

function git(root: string, args: string[]): string {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
  return r.status === 0 ? r.stdout : ''
}

function resolveVisibility(def: RepoDef): Visibility {
  if (def.name === 'epos') return 'counts-only'
  const url = git(def.root, ['remote', 'get-url', 'origin']).trim()
  const m = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/.exec(url)
  if (!m) return 'private'
  const r = spawnSync('gh', ['repo', 'view', `${m[1]}/${m[2]}`, '--json', 'isPrivate'], {
    encoding: 'utf8',
  })
  if (r.status !== 0) return 'private'
  try {
    return (JSON.parse(r.stdout) as { isPrivate: boolean }).isPrivate ? 'private' : 'public'
  } catch {
    return 'private'
  }
}

const lineCount = (text: string): number => text.split('\n').length - (text.endsWith('\n') ? 1 : 0)

export function scanRepo(def: RepoDef, tmpRoot: string): ScannedRepo {
  const visibility = resolveVisibility(def)
  const head = def.name === 'epos' ? null : git(def.root, ['rev-parse', '--short', 'HEAD']).trim()
  const listed = git(def.root, ['ls-files', '-z', '--', def.scanDir]).split('\0').filter(keep)
  const files: SourceFile[] = []
  for (const rel of listed.toSorted()) {
    const src = join(def.root, rel)
    if (!existsSync(src)) continue
    const dest = join(tmpRoot, def.name, rel)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(src, dest)
    chmodSync(dest, 0o444)
    files.push({
      rel,
      text: readFileSync(dest, 'utf8'),
      tsx: rel.endsWith('.tsx'),
      ui: UI_RE.test(`/${rel}`),
    })
  }
  const lines = files.reduce((n, f) => n + lineCount(f.text), 0)
  const tsxLines = files.filter((f) => f.tsx).reduce((n, f) => n + lineCount(f.text), 0)
  return { def, visibility, head, files, lines, tsxLines }
}

export function parse(file: SourceFile): ts.SourceFile {
  const kind = file.tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(file.rel, file.text, ts.ScriptTarget.Latest, true, kind)
}

export type SiteRef = { file: string; line: number } | { id: string }

/** public: file+line; private: hashed id; counts-only: nothing. */
export function siteRef(
  repo: RepoName,
  visibility: Visibility,
  file: string,
  line: number,
): SiteRef | null {
  if (visibility === 'counts-only') return null
  if (visibility === 'public') return { file, line }
  const id = createHash('sha256').update(`${repo}:${file}:${line}`).digest('hex').slice(0, 10)
  return { id }
}

export const log = (msg: string): void => {
  process.stderr.write(`${msg}\n`)
}
export const round = (n: number, d: number): number => Math.round(n * 10 ** d) / 10 ** d
export const cmp = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0)
