/** Target repos, scratch copies, visibility policy. Never writes into a target repo. */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import ts from 'typescript'

export type RepoName = 'console' | 'epos' | 'linewatch' | 'argo'
export type Visibility = 'public' | 'private' | 'counts-only'

export interface RepoDef {
  name: RepoName
  root: string
  scanDir: string
  kind: 'tailwind' | 'mantine'
}

const home = homedir()

/** Employer repo: location only from the environment, so no path is tracked. Absent => skipped. */
function epos(): RepoDef[] {
  const root = process.env.EPOS_ROOT
  if (!root) {
    process.stderr.write('[epos] EPOS_ROOT unset: epos skipped\n')
    return []
  }
  return [{ name: 'epos', root, scanDir: process.env.EPOS_SCAN_DIR ?? 'src', kind: 'tailwind' }]
}

export const REPOS: readonly RepoDef[] = [
  {
    name: 'console',
    root: join(home, 'SourceRoot', 'software-factory'),
    scanDir: 'apps/console/src',
    kind: 'tailwind',
  },
  ...epos(),
  {
    name: 'linewatch',
    root: join(home, 'SourceRoot', 'linewatch'),
    scanDir: 'web/src',
    kind: 'mantine',
  },
  {
    name: 'argo',
    root: join(home, 'SourceRoot', 'argo'),
    scanDir: 'apps/dashboard/src',
    kind: 'mantine',
  },
]

export interface SourceFile {
  /** relative to the git root */
  rel: string
  text: string
  tsx: boolean
}

export interface ScannedRepo {
  def: RepoDef
  visibility: Visibility
  head: string | null
  files: SourceFile[]
  tsxFiles: number
  tsxLines: number
}

const EXCLUDED_DIRS = ['/components/ui/', '/test/', '/tests/', '/__tests__/', '/e2e/']

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
    files.push({ rel, text: readFileSync(dest, 'utf8'), tsx: rel.endsWith('.tsx') })
  }
  const tsx = files.filter((f) => f.tsx)
  const lines = tsx.reduce(
    (n, f) => n + f.text.split('\n').length - (f.text.endsWith('\n') ? 1 : 0),
    0,
  )
  return { def, visibility, head, files, tsxFiles: tsx.length, tsxLines: lines }
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
