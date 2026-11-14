/**
 * The three scanners `lint` runs per declared root (guardrails section 8): oxlint with the consumer
 * config, stylelint with `.stylelintrc.basalt.json`, and `checkTokens` with the app's own names. One
 * `Finding` shape comes out, so the verb, the hook and `--stats` never read a tool's raw output.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

import { checkTokens } from '../../lint/check-tokens'
import { readManifest } from '../manifest'
import type { Manifest, Profile } from '../manifest'
import { findManifestAbove } from '../install-root'
import { readPackageJson } from '../source-text'
import { filesUnder, rootsOf } from '../doctor/types'

export type Finding = { file: string; line: number; id: string; message: string }

export type Project = {
  /** The install root: the directory holding `.basalt/manifest.json` (or the cwd without one). */
  root: string
  manifest: Manifest | null
  /** Declared roots with their profile, relative to `root`. */
  roots: [string, Profile][]
}

export const JS_FILE = /\.[cm]?[jt]sx?$/
export const STYLE_FILE = /\.(?:css|astro|mdx|html)$/
const TOKEN_FILE = /\.(?:css|tsx|astro|mdx)$/
export const LINTABLE = /\.(?:[cm]?[jt]sx?|css|astro|mdx|html)$/

export const STYLELINT_CONFIG = '.stylelintrc.basalt.json'

/** The install a run belongs to: a manifest here or above, else the directory itself (legacy config). */
export function loadProject(dir: string): Project | { error: string } {
  const root = readManifest(dir) === null ? (findManifestAbove(dir) ?? dir) : dir
  const read = readManifest(root)
  if (read !== null && 'error' in read) return { error: read.error }
  if (read !== null) return { root, manifest: read.manifest, roots: rootsOf(read.manifest) }
  // No manifest: the 2.x `basalt.roots` key, else `src`, scanned as an app.
  const roots = readPackageJson<{ basalt?: { roots?: string[] } }>(root)?.basalt?.roots
  const declared = roots !== undefined && roots.length > 0 ? roots : ['src']
  return {
    root,
    manifest: null,
    roots: declared.map((r): [string, Profile] => [
      r.replace(/^\.\//, '').replace(/\/+$/, ''),
      'app',
    ]),
  }
}

/** The first `node_modules/.bin/<name>` found from each declared root (and the install root) upward. */
export function findBin(project: Project, name: string): string | null {
  const starts = [...project.roots.map(([r]) => resolve(project.root, r)), project.root]
  for (const start of starts) {
    for (let at = start; ; at = dirname(at)) {
      const path = resolve(at, 'node_modules/.bin', name)
      if (existsSync(path)) return path
      if (at === project.root || dirname(at) === at) break
    }
  }
  return null
}

/** Generated token sheets: they carry the names, so no scanner reads them as source. */
function generated(project: Project): Set<string> {
  return new Set(project.manifest?.tokens.map((t) => t.out) ?? [])
}

/** Every lintable file under the declared roots, relative to the install root, sorted. */
export function rootFiles(project: Project): string[] {
  const skip = generated(project)
  const seen = new Set<string>()
  for (const [root] of project.roots) {
    for (const file of filesUnder(project.root, root, LINTABLE)) if (!skip.has(file)) seen.add(file)
  }
  return [...seen].toSorted()
}

/** True when `rel` (install-relative) sits under a declared root. */
export function inRoots(project: Project, rel: string): boolean {
  return project.roots.some(([r]) => r === '.' || rel === r || rel.startsWith(`${r}/`))
}

/** The profile of the declared root that holds `rel`; `tokens` roots run no oxlint. */
function profileOf(project: Project, rel: string): Profile {
  const hit = project.roots
    .filter(([r]) => r === '.' || rel === r || rel.startsWith(`${r}/`))
    .toSorted(([a], [b]) => b.length - a.length)[0]
  return hit?.[1] ?? 'app'
}

type Run = { status: number | null; stdout: string; stderr: string }

/** Argument lists stay under the OS limit: a scan of thousands of files runs in batches. */
const BATCH = 200
const batches = <T>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / BATCH) }, (_, i) =>
    items.slice(i * BATCH, (i + 1) * BATCH),
  )

function spawn(bin: string, args: string[], cwd: string): Run {
  const run = spawnSync(bin, args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (run.error !== undefined) throw new Error(`${bin} could not run: ${run.error.message}`)
  return { status: run.status, stdout: run.stdout, stderr: run.stderr }
}

const posix = (path: string): string => path.replaceAll('\\', '/')

/** oxlint reports `basalt(colour-literal)`; the dialect everywhere else is `basalt/colour-literal`. */
function normalizeId(code: string | undefined): string {
  if (code === undefined) return 'oxlint/unused-directive'
  const paren = /^([\w@-]+)\(([\w-]+)\)$/.exec(code)
  return paren === null ? code : `${paren[1]}/${paren[2]}`
}

const MANAGED = /^(?:basalt|shadcn)\//

type OxlintDiagnostic = {
  message?: string
  code?: string
  severity?: string
  help?: string
  filename?: string
  labels?: { span?: { line?: number } }[]
}

/** oxlint over `files` (or directories) from the install root; errors, managed ids and dead directives. */
export function runOxlint(project: Project, targets: readonly string[]): Finding[] {
  if (targets.length === 0) return []
  const bin = findBin(project, 'oxlint')
  if (bin === null) throw new Error('oxlint does not resolve from here: run `bun install`')
  const ignore = existsSync(resolve(project.root, '.oxlintignore'))
    ? ['--ignore-path', '.oxlintignore']
    : []
  const diagnostics = batches(targets).flatMap((batch) => {
    const run = spawn(
      bin,
      ['--format', 'json', '--report-unused-disable-directives', ...ignore, ...batch],
      project.root,
    )
    if (/No files found/.test(`${run.stdout}${run.stderr}`)) return []
    try {
      return (JSON.parse(run.stdout) as { diagnostics?: OxlintDiagnostic[] }).diagnostics ?? []
    } catch {
      throw new Error(`oxlint printed no JSON: ${(run.stderr || run.stdout).trim().slice(0, 200)}`)
    }
  })
  return diagnostics.flatMap((d) => {
    const id = normalizeId(d.code)
    if (d.severity !== 'error' && !MANAGED.test(id) && d.code !== undefined) return []
    const help = d.help === undefined ? '' : ` ${d.help}`
    return [
      {
        file: posix(d.filename ?? ''),
        line: d.labels?.[0]?.span?.line ?? 1,
        id,
        message: `${d.message ?? ''}${help}`.trim(),
      },
    ]
  })
}

type StylelintResult = {
  source: string
  warnings: { line: number; rule: string; text: string }[]
  parseErrors?: { line?: number; text: string }[]
}

/** stylelint with the generated preset over `files`; its JSON arrives on stderr (stdout in some builds). */
export function runStylelint(project: Project, files: readonly string[]): Finding[] {
  if (files.length === 0 || !existsSync(resolve(project.root, STYLELINT_CONFIG))) return []
  const bin = findBin(project, 'stylelint')
  if (bin === null) throw new Error('stylelint does not resolve from here: run `bun install`')
  const results = batches(files).flatMap((batch): StylelintResult[] => {
    const run = spawn(
      bin,
      ['--config', STYLELINT_CONFIG, '--formatter', 'json', ...batch],
      project.root,
    )
    const text = run.stdout.trim() === '' ? run.stderr : run.stdout
    if (text.trim() === '') return []
    try {
      return JSON.parse(text) as StylelintResult[]
    } catch {
      throw new Error(`stylelint printed no JSON: ${text.trim().slice(0, 200)}`)
    }
  })
  return results.flatMap((r) => [
    ...r.warnings.map((w) => ({
      file: posix(relative(project.root, r.source)),
      line: w.line,
      id: `stylelint/${w.rule}`,
      message: w.text.replace(new RegExp(`\\s*\\(${w.rule}\\)$`), ''),
    })),
    ...(r.parseErrors ?? []).map((e) => ({
      file: posix(relative(project.root, r.source)),
      line: e.line ?? 1,
      id: 'stylelint/parse-error',
      message: e.text,
    })),
  ])
}

/** The `--vx-*` names the app's own `--extra` outputs define, read from the generated sheets. */
export function extraNames(project: Project): string[] {
  const names = new Set<string>()
  for (const row of project.manifest?.tokens ?? []) {
    if (!row.flags.includes('--extra')) continue
    try {
      const css = readFileSync(resolve(project.root, row.out), 'utf8')
      for (const [name] of css.matchAll(/--vx-[a-z0-9]+(?:-[a-z0-9]+)*/gi)) names.add(name)
    } catch {
      // a missing sheet defines nothing; `doctor` check 10 reports it
    }
  }
  return [...names]
}

/** `checkTokens` over the files of the token-scanned kinds, as findings. */
export function runCheckTokens(project: Project, files: readonly string[]): Finding[] {
  const scoped = files.filter((f) => TOKEN_FILE.test(f))
  if (scoped.length === 0) return []
  const result = checkTokens({
    files: scoped.map((f) => resolve(project.root, f)),
    extraNames: extraNames(project),
  })
  return result.findings.map((f) => ({
    file: posix(relative(project.root, f.file)),
    line: f.line,
    id: 'basalt/unknown-token',
    message: `${f.name} is not a token. Use a name from basalt-ui/tokens, or declare it in the --extra file.`,
  }))
}

/** All three scanners over install-relative `files`; oxlint skips a root declared at `tokens`. */
export function scan(project: Project, files: readonly string[]): Finding[] {
  const js = files.filter((f) => JS_FILE.test(f) && profileOf(project, f) !== 'tokens')
  return [
    ...runOxlint(project, js),
    ...runStylelint(
      project,
      files.filter((f) => STYLE_FILE.test(f)),
    ),
    ...runCheckTokens(project, files),
  ].toSorted((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}

/** Directories no scan enters, whichever way the file is named (the walk of `doctor` skips the same). */
const SKIPPED = new Set(['node_modules', 'dist', '.git', '.basalt', '.claude', 'coverage'])

/** A lintable file under a declared root that is not vendored, managed or a generated token sheet. */
export function isScanned(project: Project, rel: string): boolean {
  return (
    LINTABLE.test(rel) &&
    inRoots(project, rel) &&
    !rel.split('/').some((segment) => SKIPPED.has(segment)) &&
    !generated(project).has(rel)
  )
}

const git = (project: Project, args: string[]): Run | null => {
  try {
    return spawn('git', ['-C', project.root, ...args], project.root)
  } catch {
    return null
  }
}

/** Files changed against HEAD (or the index and tree when there is no commit) plus untracked ones. */
export function changedFiles(project: Project): string[] {
  const names = (args: string[]): string[] | null => {
    const run = git(project, args)
    return run === null || run.status !== 0 ? null : run.stdout.split('\n').filter((l) => l !== '')
  }
  // No commit yet: the tree and the index stand in for HEAD. Git failing outright is an error,
  // never an empty list: a check that cannot see what changed must not read as clean.
  const untracked = names(['ls-files', '--others', '--exclude-standard'])
  const unstaged = names(['diff', '--name-only', '--relative'])
  const tracked =
    names(['diff', '--name-only', '--relative', 'HEAD']) ??
    (unstaged === null
      ? null
      : [...unstaged, ...(names(['diff', '--name-only', '--relative', '--cached']) ?? [])])
  if (untracked === null || tracked === null) {
    throw new Error(
      'git could not list the changed files (not a repository, or git failed): run lint without --changed',
    )
  }
  return [...new Set([...tracked, ...untracked])]
    .filter((f) => isScanned(project, f) && existsSync(resolve(project.root, f)))
    .toSorted()
}

/** Git's default remote branch, else `origin/main` or `origin/master`, else `HEAD`: the ratchet never reads nothing. */
export function defaultBaseRef(project: Project): string {
  const head = git(project, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
  if (head?.status === 0 && head.stdout.trim() !== '') return head.stdout.trim()
  for (const ref of ['origin/main', 'origin/master']) {
    if (git(project, ['rev-parse', '--verify', '--quiet', ref])?.status === 0) return ref
  }
  return 'HEAD'
}
