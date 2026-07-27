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

/** Does oxfmt actually handle this extension? Deliberately unformatted input, so a handled file
 *  reports a diff and an unhandled one is silently skipped. */
function oxfmtHandles(extension: string): boolean {
  const probe = PROBES[extension]
  expect(probe).toBeDefined()
  const file = join(dir, `probe.${extension}`)
  writeFileSync(file, probe ?? '')
  const out = Bun.spawnSync(['bunx', 'oxfmt', '--check', file], { cwd: dir })
  return `${out.stdout}${out.stderr}`.includes(`probe.${extension}`)
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
    for (const extension of Object.keys(PROBES)) {
      if (oxfmtHandles(extension)) expect(covered).toContain(extension)
    }
  })

  it('keeps oxlint on JS only — it has nothing to say about CSS', () => {
    expect(extensionsOf('oxlint')).toEqual(['ts', 'tsx', 'js', 'jsx'])
  })
})
