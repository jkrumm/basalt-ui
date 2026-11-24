#!/usr/bin/env bun
/**
 * A page that already passed at the same content is not run again: the memory behind `make quality-matrix-fast` and
 * `make astro-matrix-fast`. A lead runs `make check-fast` after every change it authors (the operating contract), and
 * most of those runs change nothing a matrix page imports: a ledger, a doc, a test, a gate script fixed after a later step
 * of the same run failed. The matrix is deterministic over what a page renders, so a page whose content fingerprint
 * equals one that passed has nothing new to prove here.
 *
 * A page's fingerprint is the hash of the content of every file it reaches (the import graph of
 * scripts/matrix-select.ts, shell and barrels included), of the matrix's own code and manifests (the salt: a change there
 * moves every page), and, for an Astro part, of its family's other parts (the family page measures them together). A
 * pass is recorded only when the whole step exited 0, so a failed run records nothing. Fingerprints live in the git common
 * dir (`basalt-green/<matrix>`), shared by the worktrees of the checkout: equal content is equal content.
 *
 * What it is not: CI's. `make quality-matrix`, `make astro-matrix` and `make check` never read it, CI has no such
 * file, and `make merge-guard` still demands the whole matrix green on the head. It fails open: any error prints every
 * page back, and the step runs as before.
 *
 * Usage: `bun scripts/green-cache.ts plan <quality|astro> <page,page>` prints the pages still to run (comma list, empty
 * when all passed at this content) and why on stderr; `record <quality|astro> <page,page>` records them as passed.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  ASTRO_HARNESS,
  ASTRO_RECORD,
  BUILD_SHAPE,
  MANIFEST,
  QUALITY_HARNESS,
  astroModel,
  qualityModel,
} from './matrix-select'

export type Matrix = 'quality' | 'astro'

export interface FingerprintInput {
  /** page -> every repo-relative file its render reaches */
  pages: ReadonlyMap<string, ReadonlySet<string>>
  /** files whose change moves every page: the matrix's own code, manifests, the record */
  salt: readonly string[]
  /** pages measured together with a page (an Astro part's family): their files count too */
  siblings?: (page: string) => readonly string[]
  /** a file's text, or null for a file that is gone */
  read: (file: string) => string | null
}

const sha = (text: string): string => createHash('sha1').update(text).digest('hex')

/** One fingerprint per page: equal exactly when every file the page reaches, the salt and its siblings' files are equal. */
export function fingerprints({
  pages,
  salt,
  siblings,
  read,
}: FingerprintInput): Map<string, string> {
  const memo = new Map<string, string>()
  const hashOf = (file: string): string => {
    const hit = memo.get(file)
    if (hit !== undefined) return hit
    const text = read(file)
    const h = text === null ? 'gone' : sha(text)
    memo.set(file, h)
    return h
  }
  const digest = (files: Iterable<string>): string =>
    sha(
      [...files]
        .toSorted()
        .map((f) => f + ' ' + hashOf(f))
        .join('\n'),
    )
  const saltDigest = digest(salt)
  const out = new Map<string, string>()
  for (const [page, files] of pages) {
    const reach = new Set(files)
    for (const sibling of siblings?.(page) ?? [])
      for (const f of pages.get(sibling) ?? []) reach.add(f)
    out.set(page, sha(page + ' ' + saltDigest + ' ' + digest(reach)))
  }
  return out
}

/** The pages whose fingerprint is not recorded as passed. Pages the model does not know always run. */
export function pending(
  pages: readonly string[],
  fp: ReadonlyMap<string, string>,
  green: ReadonlySet<string>,
): string[] {
  return pages.filter((page) => {
    const f = fp.get(page)
    return f === undefined || !green.has(f)
  })
}

// ── the store ─────────────────────────────────────────────────────────────────────────────────────

/** Past this many lines a record rewrites itself to the newest half: a fingerprint is 41 bytes, a day adds a few hundred. */
export const MAX_LINES = 20_000

export function readGreen(file: string): Set<string> {
  if (!existsSync(file)) return new Set()
  return new Set(readFileSync(file, 'utf8').split('\n').filter(Boolean))
}

export function recordGreen(file: string, fingerprintList: readonly string[]): void {
  const known = readGreen(file)
  const fresh = [...new Set(fingerprintList)].filter((f) => !known.has(f))
  if (fresh.length === 0) return
  if (known.size + fresh.length > MAX_LINES) {
    const keep = [...known].slice(-Math.floor(MAX_LINES / 2))
    writeFileSync(file, [...keep, ...fresh].join('\n') + '\n')
    return
  }
  appendFileSync(file, fresh.join('\n') + '\n')
}

// ── the real tree ─────────────────────────────────────────────────────────────────────────────────

function git(args: string[]): string | null {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 })
  return r.status === 0 ? r.stdout : null
}

const under = (file: string, paths: readonly string[]): boolean =>
  paths.some((path) => file === path || file.startsWith(path + '/'))

/** Tracked and untracked files, the way a build sees the tree. */
function treeFiles(): string[] {
  const listed = [
    ...(git(['ls-files']) ?? '').split('\n'),
    ...(git(['ls-files', '--others', '--exclude-standard']) ?? '').split('\n'),
  ]
  return [...new Set(listed.filter(Boolean))].filter((file) => existsSync(file))
}

/** What moves every page of a matrix besides the files the graph reaches. */
function saltOf(matrix: Matrix, files: readonly string[]): string[] {
  const manifests = files.filter((f) => MANIFEST.test(f) || f.endsWith('tsup.config.ts'))
  const dirs: string[] =
    matrix === 'quality'
      ? [...QUALITY_HARNESS, 'apps/playground/public']
      : [...ASTRO_HARNESS, 'packages/basalt-ui/tests/support', 'apps/playground-astro/public']
  const harness = files.filter((f) => under(f, dirs))
  const extra = matrix === 'astro' ? [ASTRO_RECORD, ...BUILD_SHAPE] : []
  return [...new Set([...manifests, ...harness, ...extra.filter((f) => existsSync(f))])]
}

interface Context {
  fp: Map<string, string>
  store: string
}

function context(matrix: Matrix): Context {
  const root = git(['rev-parse', '--show-toplevel'])?.trim()
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'])?.trim()
  if (!root || !common) throw new Error('not a git checkout')
  process.chdir(root)
  const files = treeFiles()
  const read = (file: string): string | null =>
    existsSync(file) && statSync(file).isFile() ? readFileSync(file, 'utf8') : null
  const model = matrix === 'quality' ? qualityModel(root) : astroModel(root)
  const families = matrix === 'astro' ? (model as ReturnType<typeof astroModel>).families : null
  const familyOf = new Map<string, string[]>()
  for (const ids of families?.values() ?? []) for (const id of ids) familyOf.set(id, ids)
  const salt = [
    ...saltOf(matrix, files),
    ...(matrix === 'quality' ? [...model.harness] : [...model.shared]),
  ]
  const fp = fingerprints({
    pages: model.pages,
    salt,
    siblings: (page) => familyOf.get(page) ?? [],
    read,
  })
  const dir = join(common, 'basalt-green')
  mkdirSync(dir, { recursive: true })
  return { fp, store: join(dir, matrix) }
}

const list = (arg: string | undefined): string[] => (arg ?? '').split(',').filter(Boolean)

if (import.meta.main) {
  const [verb, matrix, pagesArg] = process.argv.slice(2)
  const pages = list(pagesArg)
  if ((verb !== 'plan' && verb !== 'record') || (matrix !== 'quality' && matrix !== 'astro')) {
    console.error('usage: green-cache.ts plan|record <quality|astro> <page,page>')
    process.exit(2)
  }
  try {
    const { fp, store } = context(matrix)
    if (verb === 'plan') {
      const todo = pending(pages, fp, readGreen(store))
      console.error(
        `green-cache: ${matrix}: ${pages.length - todo.length} of ${pages.length} pages passed at this content, ${todo.length} to run`,
      )
      console.log(todo.join(','))
    } else {
      recordGreen(
        store,
        pages.flatMap((page) => fp.get(page) ?? []),
      )
    }
  } catch (error) {
    console.error(
      'green-cache: failing open: ' + (error instanceof Error ? error.message : String(error)),
    )
    if (verb === 'plan') console.log(pages.join(','))
  }
}
