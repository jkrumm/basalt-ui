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
 *
 * Asserted against the tool's REAL capability (`oxfmt --check` over a scratch file of each type)
 * rather than a copy of the list, so a future oxfmt that learns a new language fails this test
 * instead of quietly under-covering.
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

describe('shipped lefthook preset', () => {
  it('runs check-theme on EVERY commit — it scans basalt.roots, not the staged files', () => {
    // A glob would gate the guard on which extensions a commit happens to touch. It reads none of
    // them, so the only correct answer is "no glob".
    expect(globOf('check-theme')).toBeUndefined()
    expect(preset).toContain('run: bunx basalt-ui check-theme')
  })

  it('formats every file type oxfmt actually handles', () => {
    const covered = extensionsOf('oxfmt')
    expect(covered).toContain('css')
    const handled = oxfmtHandledExtensions()
    for (const extension of Object.keys(PROBES)) {
      if (handled.has(extension)) expect(covered).toContain(extension)
    }
  })

  it('keeps oxlint on JS only — it has nothing to say about CSS', () => {
    expect(extensionsOf('oxlint')).toEqual(['ts', 'tsx', 'js', 'jsx'])
  })
})
