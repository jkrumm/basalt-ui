/**
 * Round-4 regression suite: the toolchain reported green while enforcing nothing.
 *
 * Five consumers hit one bug in five shapes — `doctor` counting checks it could not run as passes,
 * `init` scaffolding a guard that scans zero files, seeded configs whose `extends` resolved to
 * nothing, and `tokens:css` output basalt's own guard rejected. Every test below pins one of those
 * false-greens shut. The unit under test is always "does the tool TELL you", not "does it work".
 *
 * C2 (the CLI-consolidation wave) deleted the multi-repo/workspace project-DISCOVERY `doctor` and
 * `check-theme`/`sync` used to share (`resolveProjectDir` is now BASALT_CWD → cwd, nothing
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
import { checkTheme, fontsCss, normalizeColorFunctions, tokensCss } from './index.ts'

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

/** Captures both streams — doctor/init/check-theme pick one or the other by outcome. */
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

describe('--tokens-only and --framework are alternatives, not a precedence question', () => {
  it('check-theme rejects both together', () => {
    write('package.json', JSON.stringify({ name: 'app', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    const { code, log } = capture(() => checkTheme(dir, ['--tokens-only', '--framework']))
    expect(code).toBe(1)
    expect(log).toContain('alternatives')
  })
})

describe('check-theme — the markup scan reaches the app shell', () => {
  it('scans index.html and public/*.webmanifest beside a root, not just inside it', () => {
    // The exact argo shape: roots point at `apps/dashboard/src`, the raw hex lives one level up in
    // index.html and in public/site.webmanifest. Widening the extension filter alone missed both.
    write('package.json', JSON.stringify({ name: 'app', basalt: { roots: ['apps/web/src'] } }))
    write('apps/web/src/app.tsx', 'export const App = () => null\n')
    write('apps/web/index.html', '<meta name="theme-color" content="#EDEFF2" />\n')
    write('apps/web/public/site.webmanifest', '{ "theme_color": "#242424" }\n')
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('apps/web/index.html')
    expect(log).toContain('apps/web/public/site.webmanifest')
    expect(code).toBe(1)
  })

  it('leaves a sibling docs/ full of throwaway HTML alone', () => {
    write('package.json', JSON.stringify({ name: 'app', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    write('docs/poc.html', '<div style="color: #ff0000">x</div>\n')
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).not.toContain('docs/poc.html')
    expect(code).toBe(0)
  })

  it('never blanket-scans .json, but scans one named in basalt.include', () => {
    write('package.json', JSON.stringify({ name: 'app', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    write('src/fixtures/data.json', '{ "note": "#ff0000 in a test fixture" }\n')
    expect(capture(() => checkTheme(dir)).code).toBe(0)

    write(
      'package.json',
      JSON.stringify({ name: 'app', basalt: { roots: ['src'], include: ['app/manifest.json'] } }),
    )
    write('app/manifest.json', '{ "theme_color": "#EDEFF2" }\n')
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('app/manifest.json')
    expect(log).not.toContain('data.json')
    expect(code).toBe(1)
  })
})

describe('check-theme — tokens-only profile', () => {
  function mantineFreeApp(): void {
    write(
      'package.json',
      JSON.stringify({ name: 'site', basalt: { roots: ['src'], profile: 'tokens-only' } }),
    )
    write('src/form.tsx', "export const F = () => <input />\nexport const C = '#ff0000'\n")
  }

  it('drops the Mantine-coupled kinds while the color kinds keep firing', () => {
    mantineFreeApp()
    const { log } = capture(() => checkTheme(dir))
    expect(log).toContain('tokens-only profile')
    expect(log).not.toContain('raw-form-control')
    expect(log).toContain('raw-hex')
  })

  it('--framework forces the full kind set back on', () => {
    mantineFreeApp()
    const { log } = capture(() => checkTheme(dir, ['--framework']))
    expect(log).not.toContain('tokens-only profile')
    expect(log).toContain('raw-form-control')
  })

  it('is never INFERRED — an undeclared Mantine-free repo keeps every kind live', () => {
    // Silencing 17 kinds off the mere absence of @mantine/core is this round's own failure mode:
    // a repo holding Mantine in a workspace package would switch off half its guard silently.
    write('package.json', JSON.stringify({ name: 'app', basalt: { roots: ['src'] } }))
    write('src/form.tsx', 'export const F = () => <input />\n')
    const { log } = capture(() => checkTheme(dir))
    expect(log).not.toContain('tokens-only profile')
    expect(log).toContain('raw-form-control')
  })
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

  it('opens with the exact @generated marker the theme guard skips on', () => {
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

describe('the @generated marker, end to end — emit, then scan', () => {
  /** A tokens-only consumer whose only CSS is the sheet `tokens:css` writes into its own src/. */
  function siteWithEmittedTokens(flags: string[] = []): void {
    write(
      'package.json',
      JSON.stringify({ name: 'site', basalt: { roots: ['src'], profile: 'tokens-only' } }),
    )
    write('src/app.tsx', 'export const App = () => null\n')
    expect(tokensCss([...flags, '--out', 'src/tokens.css'], dir)).toBe(0)
  }

  it('the sheet tokens:css just wrote scans to zero findings — 116 was the round-4 bug', () => {
    siteWithEmittedTokens()
    // Sanity: it really is full of the raw hex the guard would otherwise report.
    expect(read('src/tokens.css').match(/#[0-9a-f]{6}/gi)?.length ?? 0).toBeGreaterThan(50)
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).not.toContain('src/tokens.css')
    expect(code).toBe(0)
  })

  it('holds for every emission shape, not just the default', () => {
    for (const flags of [
      [],
      ['--vibrancy', '1'],
      ['--accent', '#0f8a7e'],
      ['--selector', ":root[data-tenant='teal']", '--accent', '#0f8a7e'],
    ]) {
      rmSync(join(dir, 'src'), { recursive: true, force: true })
      siteWithEmittedTokens(flags)
      expect(capture(() => checkTheme(dir)).code).toBe(0)
    }
  })

  it('a HAND-FORGED marker on ordinary source suppresses nothing', () => {
    siteWithEmittedTokens()
    const header = read('src/tokens.css').split('\n').slice(0, 2).join('\n')
    // Exactly what an agent (or anyone) could do: copy the two header lines onto a real file.
    write('src/forged.css', `${header}\n.btn { color: #ff0000; }\n`)
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('src/forged.css')
    expect(log).toContain('raw-hex')
    expect(code).toBe(1)
  })

  it('a STRIPPED marker makes the emitted sheet ordinary source again', () => {
    siteWithEmittedTokens()
    const stripped = read('src/tokens.css').split('\n').slice(2).join('\n')
    write('src/tokens.css', stripped)
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('src/tokens.css')
    expect(code).toBe(1)
  })

  it('appending a real rule to the emitted sheet un-exempts it', () => {
    siteWithEmittedTokens()
    write('src/tokens.css', `${read('src/tokens.css')}.btn { color: #ff0000; }\n`)
    const { code, log } = capture(() => checkTheme(dir))
    expect(log).toContain('src/tokens.css')
    expect(code).toBe(1)
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

  it('emits a stylesheet check-theme accepts end to end', () => {
    write('package.json', JSON.stringify({ name: 'site', basalt: { roots: ['src'] } }))
    write('src/app.tsx', 'export const App = () => null\n')
    expect(fontsCss(['--out', 'src/fonts.css'], dir)).toBe(0)
    expect(capture(() => checkTheme(dir)).code).toBe(0)
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
 * The shipped preset broke ITSELF for every non-root consumer at 1.29.0. Lefthook runs commands at
 * the repo ROOT and `extends` merges commands WITHOUT a working directory, so after the resolver
 * change (BASALT_CWD, else cwd, nothing inferred) `check-theme` reported `0 files scanned` — a hard
 * failure — in any repo whose app is not at the root, and the default bin `bunx --no-install
 * basalt-ui` resolved to nothing there under bun's isolated linker. image-share hand-patched
 * `env: { BASALT_BIN, BASALT_CWD }` into it to commit at all.
 */
describe('the shipped lefthook preset — a monorepo consumer must not have to patch it', () => {
  const preset = readFileSync(resolve(PKG_ROOT, 'configs/lefthook.yml'), 'utf8')

  it('derives the bin from BASALT_CWD instead of bunx', () => {
    expect(preset).toContain(
      'run: ${BASALT_BIN:-${BASALT_CWD:+$BASALT_CWD/}node_modules/.bin/basalt-ui} check-theme',
    )
    expect(preset).not.toContain('bunx --no-install basalt-ui} check-theme')
  })

  it('names `root:` as a merging seam and spells the monorepo recipe out', () => {
    expect(preset).toContain('MONOREPO RECIPE')
    expect(preset).toContain("check-theme: { root: 'apps/web/' }")
  })

  // The preset claimed `check-theme` "now relocates to the single workspace package carrying a
  // basalt config" — true until 1.29.0 deleted every inference, and a lie in the shipped file for
  // three minors after.
  it('no longer claims the CLI relocates itself', () => {
    expect(preset).not.toContain('relocates to the single workspace package')
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

  it('the shipped preset ignores the worktree directory', () => {
    const preset = JSON.parse(
      readFileSync(resolve(import.meta.dir, '../../configs/oxlint.json'), 'utf8'),
    )
    expect(preset.ignorePatterns).toContain('.claude/worktrees/**')
  })
})
