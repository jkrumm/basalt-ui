/**
 * The shipped lefthook preset's globs — the reach of the consumer's pre-commit gate.
 *
 * A glob here is not cosmetic: it decides whether a check RUNS for a given commit. Both bugs this
 * file pins were found by a consumer, not by us, and both had the same shape — a file type the tool
 * genuinely handles was missing from its glob, so the hook passed and CI failed on the same commit.
 *
 *  • `oxfmt` formats CSS, but its glob stopped at `yaml`. A commit staging only `.module.css` files
 *    was formatted by nobody until CI said no.
 *  • `check-theme` carried `glob: '*.{ts,tsx}'` while scanning `basalt.roots` rather than
 *    `{staged_files}`. A CSS-only commit skipped the guard entirely — including, for a while, the
 *    CSS rules the guard had just gained.
 *  • the fix for the first one over-reached: `json,md,yml,yaml` put every staged repo-root
 *    document through oxfmt, which pads markdown table separators — so the preset blocked commits
 *    on a consumer's CLAUDE.md over a house style basalt has no opinion about, in files their own
 *    `format` script does not own. And because an `extends` target WINS on a colliding key, the
 *    consumer could not narrow the glob. Source extensions only, now pinned in both directions.
 *
 * The source half is asserted against the tool's REAL capability (`oxfmt --check` over a scratch
 * file of each type) rather than a copy of the list, so a future oxfmt that learns a new source
 * language fails this test instead of quietly under-covering.
 *
 * Run: bun test packages/basalt-ui/tests/lefthook-preset.test.ts
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'bun:test'

const preset = readFileSync(join(import.meta.dir, '..', 'configs', 'lefthook.yml'), 'utf8')

/** The `glob:` line belonging to a named command, or `undefined` when it declares none. */
function globOf(command: string): string | undefined {
  const block = new RegExp(`^ {4}${command}:\\n((?: {6}.*\\n|\\n)*)`, 'm').exec(preset)?.[1]
  expect(block).toBeDefined()
  return /^ {6}glob: '(.+)'$/m.exec(block ?? '')?.[1]
}

/** Extensions inside a `*.{a,b,c}` glob. */
function extensionsOf(command: string): string[] {
  const glob = globOf(command)
  expect(glob).toBeDefined()
  return (/\{(.+)\}/.exec(glob ?? '')?.[1] ?? '').split(',')
}

const dir = mkdtempSync(resolve(tmpdir(), 'basalt-lefthook-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

/**
 * Deliberately unformatted probe content, PER LANGUAGE. One shared JS-shaped literal does not
 * work: `const  a  =  1` is already canonical YAML (a plain scalar), so oxfmt reports no diff for
 * probe.yml, `oxfmtHandles('yml')` answers false, and the coverage assertion below is skipped for
 * a type oxfmt genuinely formats — the silent under-coverage this file exists to catch.
 */
const PROBES: Record<string, string> = {
  ts: 'const  a  =  1\n',
  tsx: 'const  a  =  1\n',
  js: 'const  a  =  1\n',
  jsx: 'const  a  =  1\n',
  css: '.a {\n  color: red   ;\n}\n',
  json: '{"a":   1,  "b": 2}\n',
  md: '#  Title\n\n\n\ntext\n',
  yml: 'a:      1\nb:\n    - x\n',
  yaml: 'a:      1\nb:\n    - x\n',
}

/**
 * Which of the PROBES extensions oxfmt actually handles, decided by ONE `oxfmt --check` invocation
 * over all probe files rather than one spawn per extension — spawning `bunx oxfmt` nine times sat
 * on the boundary of Bun's 5000ms default test timeout by construction and flaked the gate. A
 * single invocation still proves the same thing per extension (a handled file reports a diff and
 * carries its own filename in the output; an unhandled one is silently skipped), so batching does
 * not weaken the assertion.
 */
function oxfmtHandledExtensions(): Set<string> {
  const files = Object.entries(PROBES).map(([extension, content]) => {
    const file = join(dir, `probe.${extension}`)
    writeFileSync(file, content)
    return file
  })
  const out = Bun.spawnSync(['bunx', 'oxfmt', '--check', ...files], { cwd: dir })
  const output = `${out.stdout}${out.stderr}`
  return new Set(Object.keys(PROBES).filter((extension) => output.includes(`probe.${extension}`)))
}

/** Extensions the preset formats. Everything else oxfmt handles is deliberately the consumer's. */
const SOURCE_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'css']

describe('shipped lefthook preset', () => {
  it('runs check-theme on EVERY commit — it scans basalt.roots, not the staged files', () => {
    // A glob would gate the guard on which extensions a commit happens to touch. It reads none of
    // them, so the only correct answer is "no glob".
    expect(globOf('check-theme')).toBeUndefined()
  })

  it('runs check-theme through an overridable BASALT_BIN, never a bare bunx fetch', () => {
    // `run:` is the one thing a consumer CANNOT override (an extends target wins on a colliding
    // key), so the seam has to be inside the command: `env:` merges, and the default refuses to
    // silently install a second copy of basalt from npm.
    expect(preset).toContain('run: ${BASALT_BIN:-bunx --no-install basalt-ui} check-theme')
  })

  it('formats every SOURCE file type oxfmt handles, and nothing else', () => {
    const covered = extensionsOf('oxfmt')
    expect(covered).toContain('css')
    const handled = oxfmtHandledExtensions()
    for (const extension of SOURCE_EXTENSIONS) {
      if (handled.has(extension)) expect(covered).toContain(extension)
    }
    // The other half of the contract: a document type oxfmt handles is still NOT the preset's
    // business, because the consumer cannot narrow this glob when it disagrees with their house
    // style. Regressing this re-breaks every repo whose markdown basalt does not own.
    for (const extension of Object.keys(PROBES)) {
      if (!SOURCE_EXTENSIONS.includes(extension)) expect(covered).not.toContain(extension)
    }
  })

  it('does not fail a commit whose staged files are all ignored', () => {
    // oxfmt exits 2 on "Expected at least one target file. All matched files may have been
    // excluded by ignore rules" — a docs-only commit in any repo carrying a .prettierignore.
    expect(preset).toContain('--no-error-on-unmatched-pattern')
  })

  it('keeps oxlint on JS only — it has nothing to say about CSS', () => {
    expect(extensionsOf('oxlint')).toEqual(['ts', 'tsx', 'js', 'jsx'])
  })
})
