/**
 * check-playground-lint: the two scanners of `basalt-ui lint` that the playground's oxlint step
 * does not run, over `apps/playground/src` and `apps/expression/src` as `app` roots: the `--basalt-*` token check
 * (`basalt/unknown-token`) and the stylelint preset. oxlint stays with `lint:playground` and
 * `check-recipes-lint`. A recipe or a demo that names a token the package does not ship paints
 * nothing, and no other gate sees it.
 *
 * The scanners are the engine's own (`src/cli/lint/engine.ts`), called with the playground as the
 * project, so the verdict is the one a consumer's `basalt-ui lint` gives. The token outputs its
 * `.basalt/manifest.json` declares are generated sheets, never linted.
 *
 * Usage: bun packages/basalt-ui/scripts/check-playground-lint.ts [<project dir>]   (default: apps/playground and apps/expression)
 * Exit 0 clean; 1 with one `<file>:<line> <id>: <message>` line per finding.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

import { rootFiles, runCheckTokens, STYLE_FILE } from '../src/cli/lint/engine'
import type { Finding, Project } from '../src/cli/lint/engine'
import { renderStylelintConfig } from '../src/lint/stylelint/render'

const PACKAGE = resolve(import.meta.dirname, '..')
const APPS = resolve(PACKAGE, '..', '..', 'apps')
/** The repo's two `init --profile app` installs: the playground and the expression app. */
const DEFAULT_ROOTS = [join(APPS, 'playground'), join(APPS, 'expression')]
/** The `tokens:css` outputs of the install: `init` and `sync` write them, `doctor` check 10 pins them. */
const generatedSheets = (root: string): Set<string> => {
  const path = join(root, '.basalt/manifest.json')
  if (!existsSync(path)) return new Set()
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as { tokens?: { out: string }[] }
  return new Set((manifest.tokens ?? []).map((t) => t.out))
}

type StylelintResult = {
  source: string
  warnings: { line: number; rule: string; text: string }[]
  parseErrors?: { line?: number; text: string }[]
}

/** stylelint is a devDependency of the package; bun may install it there or hoist it to the root. */
function stylelintBin(): string {
  const found = [PACKAGE, resolve(PACKAGE, '..', '..')]
    .map((dir) => join(dir, 'node_modules', '.bin', 'stylelint'))
    .find((path) => existsSync(path))
  if (found === undefined) throw new Error('stylelint does not resolve: run `bun install`')
  return found
}

/** stylelint from the package's own install, with the rendered preset, over `files` of the project. */
function runStylelint(project: Project, files: readonly string[]): Finding[] {
  if (files.length === 0) return []
  const dir = mkdtempSync(join(tmpdir(), 'check-playground-lint-'))
  try {
    const config = join(dir, '.stylelintrc.basalt.json')
    writeFileSync(config, renderStylelintConfig())
    const run = spawnSync(stylelintBin(), ['--config', config, '--formatter', 'json', ...files], {
      cwd: project.root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    if (run.error !== undefined) throw run.error
    const text = run.stdout.trim() === '' ? run.stderr : run.stdout
    if (text.trim() === '') return []
    let results: StylelintResult[]
    try {
      results = JSON.parse(text) as StylelintResult[]
    } catch {
      throw new Error(`stylelint printed no JSON: ${text.trim().slice(0, 200)}`)
    }
    return results.flatMap((r) => [
      ...r.warnings.map((w) => ({
        file: relative(project.root, r.source),
        line: w.line,
        id: `stylelint/${w.rule}`,
        message: w.text,
      })),
      ...(r.parseErrors ?? []).map((e) => ({
        file: relative(project.root, r.source),
        line: e.line ?? 1,
        id: 'stylelint/parse-error',
        message: e.text,
      })),
    ])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function checkPlaygroundLint(root: string): Finding[] {
  const project: Project = { root, manifest: null, roots: [['src', 'app']] }
  const generated = generatedSheets(root)
  const files = rootFiles(project).filter((f) => !generated.has(f))
  return [
    ...runCheckTokens(project, files),
    ...runStylelint(
      project,
      files.filter((f) => STYLE_FILE.test(f)),
    ),
  ].toSorted((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}

if (import.meta.main) {
  const roots = process.argv[2] === undefined ? DEFAULT_ROOTS : [resolve(process.argv[2])]
  let failed = false
  for (const root of roots) {
    for (const f of checkPlaygroundLint(root)) {
      failed = true
      console.log(`${join(relative(process.cwd(), root), f.file)}:${f.line} ${f.id}: ${f.message}`)
    }
  }
  process.exit(failed ? 1 : 0)
}
