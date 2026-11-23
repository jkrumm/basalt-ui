/**
 * check-playground-lint: the two scanners of `basalt-ui lint` that the playground's oxlint step
 * does not run, over `apps/playground/src` as an `app` root: the `--basalt-*` token check
 * (`basalt/unknown-token`) and the stylelint preset. oxlint stays with `lint:playground` and
 * `check-recipes-lint`. A recipe or a demo that names a token the package does not ship paints
 * nothing, and no other gate sees it.
 *
 * The scanners are the engine's own (`src/cli/lint/engine.ts`), called with the playground as the
 * project, so the verdict is the one a consumer's `basalt-ui lint` gives. The playground carries no
 * `.basalt` manifest and defines no `--extra` names.
 *
 * Usage: bun packages/basalt-ui/scripts/check-playground-lint.ts [<project dir>]   (default: apps/playground)
 * Exit 0 clean; 1 with one `<file>:<line> <id>: <message>` line per finding.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

import { rootFiles, runCheckTokens, STYLE_FILE } from '../src/cli/lint/engine'
import type { Finding, Project } from '../src/cli/lint/engine'
import { renderStylelintConfig } from '../src/lint/stylelint/render'

const PACKAGE = resolve(import.meta.dirname, '..')
const PLAYGROUND = resolve(PACKAGE, '..', '..', 'apps', 'playground')
const GENERATED_SHEETS = new Set(['src/accents.css'])

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

export function checkPlaygroundLint(root: string = PLAYGROUND): Finding[] {
  const project: Project = { root, manifest: null, roots: [['src', 'app']] }
  // The playground has no manifest; its one generated sheet (`tokens:css --accents`) is skipped as a
  // consumer's `tokens` output in `.basalt/manifest.json` is.
  const files = rootFiles(project).filter((f) => !GENERATED_SHEETS.has(f))
  return [
    ...runCheckTokens(project, files),
    ...runStylelint(
      project,
      files.filter((f) => STYLE_FILE.test(f)),
    ),
  ].toSorted((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}

if (import.meta.main) {
  const root = process.argv[2] === undefined ? PLAYGROUND : resolve(process.argv[2])
  const findings = checkPlaygroundLint(root)
  for (const f of findings)
    console.log(`${join(relative(process.cwd(), root), f.file)}:${f.line} ${f.id}: ${f.message}`)
  process.exit(findings.length === 0 ? 0 : 1)
}
