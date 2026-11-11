/**
 * `basalt-ui eject` (docs/v3/ARCHITECTURE.md 4.2, primitives-distribution sections 5-7): take one
 * primitive into the app under the same specifier. Every mode plans first and writes only when the
 * whole plan holds, so any exit 1 leaves the tree as it was.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { noteRelocation, packageRoot, readFrameworkVersion, resolveProjectDir } from '../index'
import { DEFAULT_ROOT } from '../config'
import { findManifestAbove } from '../install-root'
import { MANIFEST_PATH, readManifest, writeManifest } from '../manifest'
import type { Manifest } from '../manifest'
import { ejectHeader, stripHeader, withHeader } from '../merge/header'
import { ejectedGuard, ejectedSource, readSeed, seedNames } from '../merge/seed'
import { tokenize } from '../source-text'
import { isClean, onMergeBase } from './git'
import { EJECT_HELP } from './help'
import {
  BUDGET_PATH,
  basePath,
  ceilingOf,
  countRows,
  raiseBudget,
  readBudget,
  rowKey,
  rowsOfRoot,
  writeBudget,
} from './ledger'
import type { Counts, EjectedRow } from './ledger'
import { addPathsRow, appTsconfig, pathsTarget, removePathsRow } from './tsconfig'

export type EjectOptions = {
  /** The installed package the seeds are read from; defaults to this package. */
  pkgRoot?: string
}

const OPTIONS = {
  reason: { type: 'string' },
  all: { type: 'boolean' },
  adopt: { type: 'string' },
  undo: { type: 'boolean' },
  raise: { type: 'string' },
  app: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const

type Args = {
  names: string[]
  reason: string | undefined
  all: boolean
  adopt: string | undefined
  undo: boolean
  raise: string | undefined
  app: string | undefined
}

class Refusal extends Error {}
const refuse = (why: string): never => {
  throw new Refusal(why)
}

const VITE_CONFIGS = [
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cts',
  'vite.config.cjs',
]

/** One line, non-empty: it lands in a header comment and a JSON row. */
function oneLine(flag: string, value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (trimmed === '' || /[\r\n]/.test(trimmed)) refuse(`--${flag} must be one non-empty line.`)
  return trimmed
}

function parse(flags: readonly string[]): Args | 'help' {
  let parsed
  try {
    parsed = parseArgs({ args: [...flags], options: OPTIONS, strict: true, allowPositionals: true })
  } catch (err) {
    const accepted = Object.keys(OPTIONS).map((k) => `--${k}`)
    return refuse(`${(err as Error).message} Accepted: ${accepted.join(' ')}`)
  }
  const { values, positionals } = parsed
  if (values.help === true) return 'help'
  const args: Args = {
    names: positionals,
    reason: oneLine('reason', values.reason),
    all: values.all === true,
    adopt: values.adopt,
    undo: values.undo === true,
    raise: oneLine('raise', values.raise),
    app: values.app,
  }
  const modes = [args.names.length > 0, args.all, args.adopt !== undefined].filter(Boolean).length
  if (modes !== 1)
    refuse('name one primitive, or pass --all, or --adopt <path>. See `basalt-ui eject --help`.')
  if (args.names.length > 1)
    refuse(`one primitive per run (got ${args.names.join(', ')}); or --all.`)
  if (args.undo) {
    if (args.names.length !== 1) refuse('--undo takes one primitive name.')
    if (args.reason !== undefined || args.raise !== undefined)
      refuse('--undo takes no --reason or --raise.')
    return args
  }
  if (args.reason === undefined)
    refuse('--reason "<why>" is required; it lands in the header and the manifest.')
  if (args.all && args.raise === undefined) {
    refuse(
      '--all needs --raise "<named consumer>": it passes the ejects ceiling, and only a raise may. budget.json is untouched.',
    )
  }
  return args
}

type Context = {
  installRoot: string
  projectDir: string
  manifest: Manifest
  roots: string[]
  pkgRoot: string
  version: string
}

const normalizeRoot = (raw: string): string =>
  raw.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '') || '.'

function locate(projectDir: string): { installRoot: string; manifest: Manifest } {
  const installRoot = readManifest(projectDir) === null ? findManifestAbove(projectDir) : projectDir
  if (installRoot === null) {
    return refuse(
      `no ${MANIFEST_PATH} at ${projectDir} or above; run \`basalt-ui init --profile parts\` first.`,
    )
  }
  const read = readManifest(installRoot)
  if (read === null || 'error' in read) return refuse(read?.error ?? `${MANIFEST_PATH} vanished`)
  return { installRoot, manifest: read.manifest }
}

function pickRoot(ctx: Context, app: string | undefined): string {
  if (app !== undefined) {
    const wanted = normalizeRoot(app)
    const hit = ctx.roots.find((r) => normalizeRoot(r) === wanted)
    return hit ?? refuse(`--app ${app} is not a declared root. Roots: ${ctx.roots.join(', ')}`)
  }
  if (ctx.roots.length > 1) {
    return refuse(
      `the manifest declares ${ctx.roots.length} roots; pass --app <root>. Roots: ${ctx.roots.join(', ')}`,
    )
  }
  return ctx.roots[0] as string
}

/** `<root>/components/ui`, relative to the install root. */
const uiDir = (root: string): string => (root === '.' ? 'components/ui' : `${root}/components/ui`)
const guardOf = (tsxPath: string): string => tsxPath.replace(/\.tsx$/, '.guard.ts')

/** The first dir from the root up to the install root holding a file `match` accepts. */
function walkUp(ctx: Context, root: string, match: (dir: string) => boolean): string | null {
  let dir = resolve(ctx.installRoot, root)
  for (;;) {
    if (match(dir)) return dir
    if (dir === ctx.installRoot || !dir.startsWith(ctx.installRoot)) return null
    dir = dirname(dir)
  }
}

/** The app hosting `root`: the nearest vite.config, which must call basalt() from basalt-ui/vite. */
function appDirWithBasalt(ctx: Context, root: string): string {
  const dir = walkUp(ctx, root, (d) => VITE_CONFIGS.some((f) => existsSync(join(d, f))))
  if (dir === null) {
    return refuse(
      `no vite.config at or above ${root}: eject needs basalt() from basalt-ui/vite to alias the file.`,
    )
  }
  const file = VITE_CONFIGS.find((f) => existsSync(join(dir, f))) as string
  const text = readFileSync(join(dir, file), 'utf8')
  const { code } = tokenize(text)
  if (!/['"]basalt-ui\/vite['"]/.test(text) || !/\bbasalt\s*\(/.test(code)) {
    refuse(
      `${relative(ctx.installRoot, join(dir, file)) || file} has no basalt() from basalt-ui/vite; add it to plugins first, or the alias has no host.`,
    )
  }
  return dir
}

/** The tsconfig the paths row goes in, for undo: the nearest one at or above the root. */
function tsconfigFor(ctx: Context, root: string, appDir: string | null): string | null {
  if (appDir !== null) return appTsconfig(appDir)
  const dir = walkUp(ctx, root, (d) => appTsconfig(d) !== null)
  return dir === null ? null : appTsconfig(dir)
}

/** A text change to make; `null` content deletes. Paths are absolute. */
type Write = { path: string; content: string | null }

type Plan = {
  writes: Write[]
  manifest: Manifest
  budget?: Record<string, unknown>
  report: string[]
}

function apply(ctx: Context, plan: Plan): void {
  for (const { path, content } of plan.writes) {
    if (content === null) {
      if (existsSync(path)) unlinkSync(path)
      prune(ctx.installRoot, dirname(path))
    } else {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, content)
    }
  }
  if (plan.budget !== undefined) writeBudget(ctx.installRoot, plan.budget)
  writeManifest(ctx.installRoot, plan.manifest)
  for (const line of plan.report) console.log(line)
}

/** Removes `dir` and its parents up to (not including) the install root while they are empty. */
function prune(stop: string, dir: string): void {
  let current = dir
  while (
    current.startsWith(`${stop}/`) &&
    existsSync(current) &&
    readdirSync(current).length === 0
  ) {
    rmdirSync(current)
    current = dirname(current)
  }
}

function ceilingReport(
  root: string,
  counts: Counts,
  budget: Record<string, unknown> | null,
): string[] {
  const lines = [
    `ejects in ${root}: ${counts.ejects} of ${ceilingOf(budget, 'ejects')}, adopted: ${counts.adopted} of ${ceilingOf(budget, 'adopted')} (${BUDGET_PATH}).`,
  ]
  if (
    counts.ejects > ceilingOf(budget, 'ejects') ||
    counts.adopted > ceilingOf(budget, 'adopted')
  ) {
    lines.push(
      'Over the ceiling: counted until 3.0.0, an error after. `--raise "<named consumer>"` records a raise.',
    )
  }
  return lines
}

function currentBudget(ctx: Context): Record<string, unknown> | null {
  const read = readBudget(ctx.installRoot)
  if (read === null) return null
  return 'error' in read ? refuse(read.error) : read.data
}

function tsconfigEdit(
  ctx: Context,
  appDir: string,
  entries: { name: string; file: string }[],
): Write {
  const path =
    appTsconfig(appDir) ??
    refuse(`no tsconfig.app.json or tsconfig.json in ${appDir}; eject needs one for the paths row.`)
  let text = readFileSync(path, 'utf8')
  for (const { name, file } of entries) {
    const edit = addPathsRow(text, `basalt-ui/ui/${name}`, pathsTarget(path, text, file))
    if ('error' in edit) refuse(`${relative(ctx.installRoot, path)}: ${edit.error}`)
    else text = edit.text
  }
  return { path, content: text }
}

function planEject(ctx: Context, args: Args): Plan {
  const root = pickRoot(ctx, args.app)
  const reason = args.reason as string
  const { rows, bad } = rowsOfRoot(ctx.manifest, root)
  if (bad.length > 0) refuse(`malformed manifest.ejected rows: ${bad.join(', ')}`)
  const shipped = seedNames(ctx.pkgRoot)
  const names = args.all ? shipped.filter((n) => !rows.has(n)) : args.names
  if (names.length === 0) refuse(`every shipped primitive is already ejected in ${root}.`)
  const appDir = appDirWithBasalt(ctx, root)

  const writes: Write[] = []
  const ejected = { ...ctx.manifest.ejected }
  const paths: { name: string; file: string }[] = []
  for (const name of names) {
    const seed =
      readSeed(ctx.pkgRoot, name) ??
      refuse(`'${name}' is not a shipped primitive. Shipped: ${shipped.join(', ')}`)
    if (rows.has(name))
      refuse(
        `${name} is already ejected in ${root} (${rows.get(name)?.path}); \`--undo\` it first.`,
      )
    const rel = `${uiDir(root)}/${name}.tsx`
    const file = join(ctx.installRoot, rel)
    for (const target of [file, ...(seed.guard === null ? [] : [guardOf(file)])]) {
      if (existsSync(target))
        refuse(`${relative(ctx.installRoot, target)} exists; take it with \`--adopt ${rel}\`.`)
    }
    const source = ejectedSource(seed.seed)
    if ('error' in source) return refuse(`the ${name} seed ${source.error}.`)
    writes.push({
      path: file,
      content: withHeader(ejectHeader(name, ctx.version, reason), source.text),
    })
    if (seed.guard !== null) {
      const guard = ejectedGuard(seed.guard, name)
      if ('error' in guard) return refuse(`the ${name} guard ${guard.error}.`)
      writes.push({ path: guardOf(file), content: guard.text })
    }
    writes.push({ path: join(ctx.installRoot, basePath(root, name)), content: source.text })
    paths.push({ name, file })
    const row: EjectedRow = {
      path: rel,
      fromVersion: ctx.version,
      seedDigest: seed.digest,
      reason,
      origin: 'seed',
    }
    ejected[rowKey(root, name)] = row
  }
  writes.push(tsconfigEdit(ctx, appDir, paths))

  const counts = countRows(rowsOfRoot({ ...ctx.manifest, ejected }, root).rows)
  const budget = currentBudget(ctx)
  const raised =
    args.raise === undefined ? undefined : raiseBudget(budget, 'ejects', counts.ejects, args.raise)
  return {
    writes,
    manifest: { ...ctx.manifest, ejected },
    ...(raised === undefined ? {} : { budget: raised }),
    report: [
      ...names.map(
        (n) => `basalt-ui eject: ${n} -> ${uiDir(root)}/${n}.tsx (base ${basePath(root, n)}).`,
      ),
      ...ceilingReport(root, counts, raised ?? budget),
    ],
  }
}

function planAdopt(ctx: Context, args: Args): Plan {
  const reason = args.reason as string
  const file = resolve(ctx.projectDir, args.adopt as string)
  const rel = relative(ctx.installRoot, file).replaceAll('\\', '/')
  const root = ctx.roots.find((r) => dirname(rel) === uiDir(normalizeRoot(r)))
  if (root === undefined || !rel.endsWith('.tsx')) {
    return refuse(
      `${args.adopt} is not a <root>/components/ui/<name>.tsx file of a declared root (${ctx.roots.map((r) => uiDir(r)).join(', ')}); only those can be adopted.`,
    )
  }
  if (args.app !== undefined && normalizeRoot(args.app) !== normalizeRoot(root)) {
    refuse(`${args.adopt} sits in root ${root}, not --app ${args.app}.`)
  }
  if (!existsSync(file) || !statSync(file).isFile()) refuse(`${rel} does not exist.`)
  const name = basename(rel, '.tsx')
  const key = rowKey(root, name)
  if (ctx.manifest.ejected[key] !== undefined)
    refuse(`${name} is already in manifest.ejected (${key}).`)

  const seed = readSeed(ctx.pkgRoot, name)
  const onBase = onMergeBase(ctx.installRoot, file)
  if (seed === null && args.raise === undefined) {
    refuse(
      `no shipped primitive is named ${name}: ${rel} is new local code and needs --raise "<named consumer>" (origin "local").`,
    )
  }
  if (seed !== null && !onBase && args.raise === undefined) {
    refuse(
      `${rel} is not on the merge base (git): a file created on this branch needs --raise "<named consumer>".`,
    )
  }
  const origin = seed === null ? 'local' : 'adopted'
  const body = stripHeader(readFileSync(file, 'utf8')).body
  const writes: Write[] = [
    { path: file, content: withHeader(ejectHeader(name, ctx.version, reason), body) },
  ]
  if (seed !== null) {
    const appDir = appDirWithBasalt(ctx, root)
    const source = ejectedSource(seed.seed)
    if ('error' in source) return refuse(`the ${name} seed ${source.error}.`)
    writes.push({ path: join(ctx.installRoot, basePath(root, name)), content: source.text })
    if (seed.guard !== null) {
      if (existsSync(guardOf(file)))
        refuse(`${guardOf(rel)} exists; the shipped guard would overwrite it.`)
      const guard = ejectedGuard(seed.guard, name)
      if ('error' in guard) return refuse(`the ${name} guard ${guard.error}.`)
      writes.push({ path: guardOf(file), content: guard.text })
    }
    writes.push(tsconfigEdit(ctx, appDir, [{ name, file }]))
  }
  const row: EjectedRow = {
    path: rel,
    fromVersion: ctx.version,
    seedDigest: seed?.digest ?? null,
    reason,
    origin,
  }
  const ejected = { ...ctx.manifest.ejected, [key]: row }
  const counts = countRows(rowsOfRoot({ ...ctx.manifest, ejected }, root).rows)
  const budget = currentBudget(ctx)
  const field = origin === 'adopted' ? 'adopted' : 'ejects'
  const raised =
    args.raise === undefined ? undefined : raiseBudget(budget, field, counts[field], args.raise)
  return {
    writes,
    manifest: { ...ctx.manifest, ejected },
    ...(raised === undefined ? {} : { budget: raised }),
    report: [
      `basalt-ui eject: adopted ${rel} as origin "${origin}"${origin === 'local' ? ' (no base, no guard, no merge)' : ` (base ${basePath(root, name)} = seed)`}.`,
      ...ceilingReport(root, counts, raised ?? budget),
    ],
  }
}

function planUndo(ctx: Context, args: Args): Plan {
  const root = pickRoot(ctx, args.app)
  const name = args.names[0] as string
  const key = rowKey(root, name)
  const raw = ctx.manifest.ejected[key] ?? refuse(`${name} is not ejected in ${root}.`)
  const { rows } = rowsOfRoot(ctx.manifest, root)
  const row =
    rows.get(name) ?? refuse(`manifest.ejected["${key}"] is malformed: ${JSON.stringify(raw)}`)
  const clean = isClean(ctx.installRoot)
  if (clean === null) refuse('--undo needs git to prove the tree is committed; no repository here.')
  if (clean === false)
    refuse('uncommitted changes under the install; commit or stash them, then --undo.')

  const file = join(ctx.installRoot, row.path)
  const writes: Write[] = []
  if (row.origin === 'seed') writes.push({ path: file, content: null })
  else if (existsSync(file))
    writes.push({ path: file, content: stripHeader(readFileSync(file, 'utf8')).body })
  if (row.origin !== 'local') {
    writes.push({ path: guardOf(file), content: null })
    writes.push({ path: join(ctx.installRoot, basePath(root, name)), content: null })
    const appDir = walkUp(ctx, root, (d) => VITE_CONFIGS.some((f) => existsSync(join(d, f))))
    const tsconfig = tsconfigFor(ctx, root, appDir)
    if (tsconfig !== null) {
      const edit = removePathsRow(readFileSync(tsconfig, 'utf8'), `basalt-ui/ui/${name}`)
      if ('error' in edit) refuse(`${relative(ctx.installRoot, tsconfig)}: ${edit.error}`)
      else writes.push({ path: tsconfig, content: edit.text })
    }
  }
  const ejected = { ...ctx.manifest.ejected }
  delete ejected[key]
  return {
    writes,
    manifest: { ...ctx.manifest, ejected },
    report: [
      `basalt-ui eject --undo: ${name} in ${root} reverted (${row.origin}); ${BUDGET_PATH} unchanged.`,
    ],
  }
}

export function eject(
  flags: readonly string[],
  invocationCwd: string = process.cwd(),
  opts: EjectOptions = {},
): number {
  try {
    const args = parse(flags)
    if (args === 'help') {
      console.log(EJECT_HELP)
      return 0
    }
    const project = resolveProjectDir(invocationCwd)
    noteRelocation('eject', project)
    const { installRoot, manifest } = locate(project.dir)
    const pkgRoot = opts.pkgRoot ?? packageRoot()
    const declared = Object.keys(manifest.roots)
    const ctx: Context = {
      installRoot,
      projectDir: project.dir,
      manifest,
      roots: declared.length > 0 ? declared : [DEFAULT_ROOT],
      pkgRoot,
      version: readFrameworkVersion(pkgRoot),
    }
    const plan = args.undo
      ? planUndo(ctx, args)
      : args.adopt !== undefined
        ? planAdopt(ctx, args)
        : planEject(ctx, args)
    apply(ctx, plan)
    return 0
  } catch (error) {
    if (!(error instanceof Refusal)) throw error
    console.error(`✖ basalt-ui eject: ${error.message}`)
    return 1
  }
}
