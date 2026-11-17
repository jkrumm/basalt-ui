/**
 * Round-4 regression suite: the toolchain reported green while enforcing nothing.
 *
 * Five consumers hit one bug in five shapes — `doctor` counting checks it could not run as passes,
 * `init` scaffolding a guard that scans zero files, seeded configs whose `extends` resolved to
 * nothing, and `tokens:css` output a gate rejected. Every test below pins one of those
 * false-greens shut. The unit under test is always "does the tool TELL you", not "does it work".
 *
 * C2 (the CLI-consolidation wave) deleted the multi-repo/workspace project-DISCOVERY `doctor` and
 * `sync` used to share (`resolveProjectDir` is now BASALT_CWD → cwd, nothing
 * inferred, nothing ascended/descended) and narrowed `doctor` to four checks (manifest exists,
 * oxlint-preset, lefthook wired via `lefthook dump`, ai-major-parity within one package.json). The
 * describe blocks below that tested the deleted relocation/ambiguity/icon/spacing-scale/
 * version-match machinery were removed with it; what remains still holds.
 */
import { execSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { emitTokensCss } from '../tokens/emit'
import { fontsCss, normalizeColorFunctions, tokensCss } from './index.ts'

const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const CLI_VERSION = (
  JSON.parse(readFileSync(resolve(PKG_ROOT, 'package.json'), 'utf8')) as { version: string }
).version

let dir: string

function write(relPath: string, content: string): void {
  const abs = join(dir, relPath)
  mkdirSync(resolve(abs, '..'), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

function read(relPath: string): string {
  return readFileSync(join(dir, relPath), 'utf8')
}

/** Captures both streams — doctor/init pick one or the other by outcome. */
function capture(fn: () => number): { code: number; log: string } {
  const originalLog = console.log
  const originalError = console.error
  let log = ''
  const sink = (...args: unknown[]) => {
    log += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  try {
    return { code: fn(), log }
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-wiring-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('tokens:css — a committable artifact', () => {
  // Restated verbatim on purpose: the guard compares line 1 byte-for-byte, so a reword is a
  // contract change. It is command-NEUTRAL — it used to name `tokens:css`, which told anyone
  // reading a fonts:css file to overwrite it with the palette sheet.
  const GENERATED_FIRST_LINE =
    '/* @generated basalt-ui — do not edit; regenerate with the command on the next line */'

  function emit(flags: string[], out = 'out.css'): string {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    expect(tokensCss([...flags, '--out', out], dir)).toBe(0)
    return read(out)
  }

  it('opens with the exact @generated marker the lint lanes skip on', () => {
    const css = emit([])
    expect(css.split('\n')[0]).toBe(GENERATED_FIRST_LINE)
    expect(css.split('\n')[1]).toContain(`basalt-ui ${CLI_VERSION}`)
  })

  it('ends with a trailing newline and normalizes rgba() argument spacing', () => {
    const css = emit([])
    expect(css.endsWith('}\n')).toBe(true)
    expect(css).not.toMatch(/rgba\(\d+,\d/)
    expect(css).toContain('rgba(0, 0, 0, 0.35)')
  })

  it('emits no trailing-zero alpha — the last thing keeping the sheet out of a linter', () => {
    // prettier rewrites `rgba(28, 25, 23, 0.10)` → `0.1`, so the two light shadow tokens failed
    // `format/prettier` while `--fix` put the file straight into `tokens:css --check` drift. The
    // consumer's eslint-ignore entry for it survived two releases.
    const css = emit([])
    expect(css).not.toMatch(/rgba\([^)]*\d\.\d*0\)/)
    expect(css).toContain('rgba(28, 25, 23, 0.1)')
    expect(normalizeColorFunctions('a: rgba(1, 2, 3, 0.10); b: rgba(1, 2, 3, 1.0);')).toBe(
      'a: rgba(1, 2, 3, 0.1); b: rgba(1, 2, 3, 1);',
    )
  })

  it('changes no token VALUE — the body is emitTokensCss modulo the formatting', () => {
    const body = emit([]).split('\n').slice(2).join('\n')
    const emitted = emitTokensCss({ version: CLI_VERSION })
    expect(body).toBe(normalizeColorFunctions(emitted).split('\n').slice(2).join('\n'))
  })

  it('--check passes on an up-to-date file and fails on drift', () => {
    emit(['--vibrancy', '1'])
    expect(
      capture(() => tokensCss(['--vibrancy', '1', '--out', 'out.css', '--check'], dir)).code,
    ).toBe(0)
    write('out.css', 'nope\n')
    const { code, log } = capture(() =>
      tokensCss(['--vibrancy', '1', '--out', 'out.css', '--check'], dir),
    )
    expect(code).toBe(1)
    expect(log).toContain('differs from what')
  })

  it('--check fails when the file has never been generated', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    const { code, log } = capture(() => tokensCss(['--out', 'missing.css', '--check'], dir))
    expect(code).toBe(1)
    expect(log).toContain('does not exist')
  })

  it('--check without --out is an error, not a silent stdout dump', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    expect(capture(() => tokensCss(['--check'], dir)).code).toBe(1)
  })
})

describe('fonts:css — the typeface half of the token layer', () => {
  it('emits the shipped --basalt-font-* stacks under the generated header', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    expect(fontsCss(['--out', 'fonts.css'], dir)).toBe(0)
    const css = read('fonts.css')
    expect(css.split('\n')[0]).toContain('@generated basalt-ui')
    expect(css).toContain('--basalt-font-sans:')
    expect(css).toContain('--basalt-font-head:')
    expect(css).toContain('--basalt-font-mono:')
    expect(css).toContain('Nunito Sans Variable')
    expect(css).toMatch(/@font-face\s*\{[^}]*'Basalt Head Digits'[^}]*unicode-range: U\+0030-0039/)
    expect(css).toMatch(/--basalt-font-head: 'Basalt Head Digits', 'Hubot Sans Variable'/)
    expect(css.endsWith('}\n')).toBe(true)
  })

  // The header used to hard-code `regenerate with \`bunx basalt-ui tokens:css\`` on every emitted
  // file — following it on a fonts sheet overwrote the typefaces with the palette.
  it('never tells the reader to regenerate a fonts sheet with tokens:css', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    expect(fontsCss(['--out', 'fonts.css'], dir)).toBe(0)
    const [marker, provenance] = read('fonts.css').split('\n')
    expect(marker).not.toContain('tokens:css')
    expect(provenance).toContain('`basalt-ui fonts:css')
  })

  it('has the same --check drift gate as tokens:css', () => {
    write('package.json', JSON.stringify({ name: 'fixture' }))
    fontsCss(['--out', 'fonts.css'], dir)
    expect(capture(() => fontsCss(['--out', 'fonts.css', '--check'], dir)).code).toBe(0)
    write('fonts.css', ':root {}\n')
    expect(capture(() => fontsCss(['--out', 'fonts.css', '--check'], dir)).code).toBe(1)
  })
})

/**
 * The shipped preset broke ITSELF for every non-root consumer at 1.29.0: lefthook runs commands at
 * the repo ROOT and `extends` merges commands WITHOUT a working directory.
 */
describe('the shipped lefthook preset — a monorepo consumer must not have to patch it', () => {
  const preset = readFileSync(resolve(PKG_ROOT, 'configs/lefthook.yml'), 'utf8')

  it('names `root:` as a merging seam and spells the monorepo recipe out', () => {
    expect(preset).toContain('MONOREPO RECIPE')
    expect(preset).toContain("oxlint: { root: 'apps/web/' }")
  })

  it('carries no command of the retired 2.x theme guard', () => {
    expect(preset).not.toContain('check-theme')
  })
})

describe('shipped lefthook preset — staged files that are all ignored', () => {
  const preset = readFileSync(resolve(PKG_ROOT, 'configs/lefthook.yml'), 'utf8')

  it.each(['oxlint', 'oxfmt'])('%s passes when every staged file is ignore-listed', (tool) => {
    const run = new RegExp(`^ {6}run: (bunx ${tool} .*\\{staged_files\\})$`, 'm').exec(preset)?.[1]
    expect(run).toContain('--no-error-on-unmatched-pattern')
  })
})

// Row 179: an agent worktree under `.claude/worktrees/` is a full checkout with its own
// `.oxlintrc.json` + plugin. oxlint 1.87 loads that nested config even when the root's
// `ignorePatterns` names the directory, so only the CLI flag `init` writes keeps `oxlint .` green.
describe('oxlint beside an agent worktree', () => {
  const oxlint = fileURLToPath(new URL('../../../../node_modules/.bin/oxlint', import.meta.url))
  const FLAG = "--ignore-pattern '.claude/worktrees/**'"
  let scratch: string

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'basalt-worktree-lint-'))
    const preset = '{"jsPlugins":["./plug.js"],"rules":{"basalt/x":"error"}}'
    const plugin = "export default {meta:{name:'basalt'},rules:{x:{create(){return {}}}}}"
    for (const base of ['', '.claude/worktrees/wt/']) {
      mkdirSync(join(scratch, base, 'shared'), { recursive: true })
      writeFileSync(join(scratch, base, 'shared/preset.json'), preset)
      writeFileSync(join(scratch, base, 'shared/plug.js'), plugin)
      writeFileSync(join(scratch, base, 'a.ts'), 'export const a = 1\n')
      writeFileSync(
        join(scratch, base, '.oxlintrc.json'),
        '{"extends":["./shared/preset.json"],"ignorePatterns":[".claude/worktrees/**"]}',
      )
    }
  })
  afterEach(() => rmSync(scratch, { recursive: true, force: true }))

  const run = (args: string): string => {
    try {
      return execSync(`${oxlint} ${args} .`, { cwd: scratch, encoding: 'utf8', stdio: 'pipe' })
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string }
      return `${e.stdout ?? ''}${e.stderr ?? ''}`
    }
  }

  it.skipIf(!existsSync(oxlint))(
    'config ignorePatterns alone still dies on the duplicate plugin',
    () => {
      expect(run('')).toContain('already registered')
    },
  )

  it.skipIf(!existsSync(oxlint))('the --ignore-pattern flag init writes lints clean', () => {
    expect(run(FLAG)).not.toContain('already registered')
  })
})
