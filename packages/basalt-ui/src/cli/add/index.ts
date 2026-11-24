/**
 * `basalt-ui add` (docs/v3/BENCHMARK-ACCORDEE-BLUEPRINT.md section 6): copy a shipped block into the
 * app, write its merge base and record one `origin: 'block'` row in the ledger, so `sync` can merge
 * the block's later changes three ways. It plans first and writes only when every target is absent:
 * add never overwrites (primitives-distribution section 8, `add --overwrite` lost four of four edits).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { noteRelocation, packageRoot, readFrameworkVersion, resolveProjectDir } from '../index'
import { DEFAULT_ROOT } from '../config'
import { locateInstall, pickDeclaredRoot } from '../install-root'
import { writeManifest } from '../manifest'
import { addCommand } from '../package-manager'
import type { Manifest } from '../manifest'
import { blockBasePath, blockKey } from '../eject/ledger'
import type { BlockRow } from '../eject/ledger'
import { hasDependency } from '../source-text'
import { blockNames, readBlock } from './catalog'
import type { Block } from './catalog'
import { ADD_HELP } from './help'

export type AddOptions = {
  /** The installed package the blocks are read from; defaults to this package. */
  pkgRoot?: string
}

const OPTIONS = {
  list: { type: 'boolean' },
  dir: { type: 'string' },
  app: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const

class Refusal extends Error {}
const refuse = (why: string): never => {
  throw new Refusal(why)
}

type Args = { names: string[]; list: boolean; dir: string | undefined; app: string | undefined }

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
  const args = { names: positionals, list: values.list === true, dir: values.dir, app: values.app }
  if (args.list) {
    if (args.names.length > 0 || args.dir !== undefined || args.app !== undefined)
      refuse('--list takes no block name, --dir or --app.')
    return args
  }
  if (args.names.length === 0) refuse('name a block, or pass --list. See `basalt-ui add --help`.')
  if (args.dir !== undefined && args.names.length > 1)
    refuse(`--dir takes one block (got ${args.names.join(', ')}).`)
  return args
}

/** `--list`: one line per block, the name padded so the archetypes line up. */
function list(pkgRoot: string): string[] {
  const blocks = blockNames(pkgRoot).map((name) => readBlock(pkgRoot, name))
  const ok = blocks.filter((b): b is Block => b !== null && !('error' in b))
  const width = Math.max(0, ...ok.map((b) => b.name.length))
  const lines = ok.map((b) => `${b.name.padEnd(width)}  ${b.archetype}: ${b.summary}`)
  for (const b of blocks) if (b !== null && 'error' in b) lines.push(`✖ ${b.error}`)
  return lines.length > 0 ? lines : ['this basalt-ui ships no blocks.']
}

type Ctx = { installRoot: string; projectDir: string; manifest: Manifest; pkgRoot: string }

/** A block's directory relative to the install root: `--dir`, else `<root>/blocks/<name>`. */
function targetDir(ctx: Ctx, root: string, name: string, dir: string | undefined): string {
  if (dir === undefined) return root === '.' ? `blocks/${name}` : `${root}/blocks/${name}`
  const rel = relative(ctx.installRoot, resolve(ctx.projectDir, dir)).replaceAll('\\', '/')
  if (rel === '' || rel.startsWith('..'))
    refuse(`--dir ${dir} must name a directory inside the install at ${ctx.installRoot}.`)
  return rel
}

/** Specifiers a block imports that are not basalt-ui and that package.json does not declare. */
function missingPeers(projectDir: string, block: Block): string[] {
  const pkgs = block.imports
    .filter((spec) => spec !== 'basalt-ui' && !spec.startsWith('basalt-ui/'))
    .map((spec) =>
      spec
        .split('/')
        .slice(0, spec.startsWith('@') ? 2 : 1)
        .join('/'),
    )
  return [...new Set(pkgs)].filter((pkg) => !hasDependency(projectDir, pkg))
}

type Write = { path: string; content: string }

function plan(ctx: Ctx, args: Args, version: string) {
  const declared = Object.keys(ctx.manifest.roots)
  const picked = pickDeclaredRoot(declared.length > 0 ? declared : [DEFAULT_ROOT], args.app)
  const root = typeof picked === 'string' ? picked : refuse(picked.error)
  const shipped = blockNames(ctx.pkgRoot)
  const writes: Write[] = []
  const ejected = { ...ctx.manifest.ejected }
  const report: string[] = []
  const taken: string[] = []
  for (const name of args.names) {
    const block = readBlock(ctx.pkgRoot, name)
    if (block === null)
      refuse(`'${name}' is not a shipped block. Shipped: ${shipped.join(', ') || 'none'}`)
    else if ('error' in block) refuse(block.error)
    else {
      const key = blockKey(root, name)
      const row = ejected[key]
      if (row !== undefined)
        refuse(
          `${name} is already added in ${root} (${String(row['path'])}); sync merges its upstream changes.`,
        )
      const dir = targetDir(ctx, root, name, args.dir)
      for (const file of block.files) {
        const path = `${dir}/${file}`
        if (existsSync(join(ctx.installRoot, path))) taken.push(path)
        writes.push({ path, content: block.sources.get(file) ?? '' })
        writes.push({
          path: blockBasePath(root, name, file),
          content: block.sources.get(file) ?? '',
        })
      }
      ejected[key] = {
        origin: 'block',
        path: dir,
        files: block.files,
        fromVersion: version,
        seedDigest: block.digest,
      } satisfies BlockRow
      report.push(
        `basalt-ui add: ${name} -> ${dir}/ (${block.files.join(', ')}); base .basalt/base/…/blocks/${name}/.`,
        ...block.ports.map((port) => `  port  ${port}`),
      )
      const peers = missingPeers(ctx.projectDir, block)
      if (peers.length > 0)
        report.push(
          `  peers ${peers.join(' ')}: not in package.json; install them (${addCommand(ctx.projectDir, peers, false).join(' ')}).`,
        )
    }
  }
  if (taken.length > 0) {
    refuse(
      `${taken.join(', ')} already exist${taken.length === 1 ? 's' : ''}; add never overwrites. Move ${taken.length === 1 ? 'it' : 'them'} away or pass --dir. Nothing was written.`,
    )
  }
  return { writes, manifest: { ...ctx.manifest, ejected }, report }
}

export function add(
  flags: readonly string[],
  invocationCwd: string = process.cwd(),
  opts: AddOptions = {},
): number {
  try {
    const args = parse(flags)
    if (args === 'help') {
      console.log(ADD_HELP)
      return 0
    }
    const pkgRoot = opts.pkgRoot ?? packageRoot()
    if (args.list) {
      for (const line of list(pkgRoot)) console.log(line)
      return 0
    }
    const project = resolveProjectDir(invocationCwd)
    noteRelocation('add', project)
    const found = locateInstall(project.dir, 'app')
    if ('error' in found) return refuse(found.error)
    const { installRoot, manifest } = found
    const ctx: Ctx = { installRoot, projectDir: project.dir, manifest, pkgRoot }
    const next = plan(ctx, args, readFrameworkVersion(pkgRoot))
    for (const { path, content } of next.writes) {
      const abs = join(installRoot, path)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, content)
    }
    writeManifest(installRoot, next.manifest)
    for (const line of next.report) console.log(line)
    return 0
  } catch (error) {
    if (!(error instanceof Refusal)) throw error
    console.error(`✖ basalt-ui add: ${error.message}`)
    return 1
  }
}
