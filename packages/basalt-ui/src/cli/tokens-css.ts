/**
 * `tokens:css` / `fonts:css` — split out of `src/cli/index.ts` (C2) so the dispatcher file holds
 * routing only. Imports its shared plumbing (`readFrameworkVersion`, `packageRoot`, `readSource`,
 * `readIfExists`) back from `./index`, this package's shared CLI helpers.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import { GENERATED_HEADER_LINE } from '../guard'
import { VIBRANCY_RANGE_V3 } from '../tokens/derive'
import type { DeriveV3Config, NeutralV3 } from '../tokens/derive'
import { emitTokensCss } from '../tokens/emit'
import { emitJsonText } from '../tokens/emit-json'
import { packageRoot, readFrameworkVersion, readIfExists, readSource } from './index'
import { emitExtra, loadExtra } from './tokens-css-extra'

/** Read the value that follows a `--flag` in an argv slice; `undefined` when absent or terminal. */
function flagValue(flags: string[], name: string): string | undefined {
  const i = flags.indexOf(name)
  if (i === -1) return undefined
  const value = flags[i + 1]
  return value === undefined || value.startsWith('--') ? undefined : value
}

/**
 * The generated-file header: the canonical marker line (imported from the guard, which owns it),
 * then the version + invocation that produced the file.
 *
 * Both lines are load-bearing, not decoration — `checkSource` only exempts a stylesheet whose line
 * 1 is the marker verbatim AND whose line 2 parses as this provenance line. Reword either half and
 * basalt starts reporting its own output again (116 findings in rollhook's token sheet).
 */
function generatedHeader(version: string, command: string, flags: string[]): string {
  const shown = flags.filter((f) => f !== '--check')
  const invocation = shown.length === 0 ? command : `${command} ${shown.join(' ')}`
  return `${GENERATED_HEADER_LINE}\n/* basalt-ui ${version} — \`basalt-ui ${invocation}\` */\n`
}

/**
 * Space- and number-normalize the argument list of a legacy color function so the emitted file
 * survives a repo's formatter (`rgba(255,255,255,0.6)` and `rgba(255, 255, 255, 0.6)` are the same
 * colour; `0.10` becomes `0.1`). FORMATTING ONLY: token values are untouched, and only a bare decimal
 * literal is touched (never a `%`, a `var()` or a unit). Exported for tests.
 */
export function normalizeColorFunctions(css: string): string {
  return css.replace(/\b(rgba?|hsla?)\(([^()]*)\)/g, (_match, fn: string, args: string) => {
    const parts = args.split(',').map((part) => normalizeCssNumber(part.trim()))
    return `${fn}(${parts.join(', ')})`
  })
}

/** `0.10` → `0.1`, `1.0` → `1`; anything that is not a bare decimal literal is returned verbatim. */
function normalizeCssNumber(arg: string): string {
  if (!/^\d+\.\d+$/.test(arg)) return arg
  return arg.replace(/\.?0+$/, '')
}

/**
 * Write (or drift-check) a generated stylesheet. `--check` makes no writes and exits 1 when the
 * file on disk differs from what would be emitted — the CI gate for a committed `tokens:css`
 * artifact, mirroring `sync --check`. Without `--out` the content goes to stdout unchanged.
 */
function emitGeneratedCss(content: string, flags: string[], cwd: string, command: string): number {
  const out = flagValue(flags, '--out')
  const check = flags.includes('--check')
  if (out === undefined) {
    if (check) {
      console.error(
        `${command}: --check needs --out <path> — there is nothing to compare stdout to.`,
      )
      return 1
    }
    process.stdout.write(content)
    return 0
  }
  const target = isAbsolute(out) ? out : resolve(cwd, out)
  const shown = relative(cwd, target) || target
  if (check) {
    const onDisk = readIfExists(target)
    if (onDisk === null) {
      console.error(
        `✖ ${command} --check: ${shown} does not exist — run without --check to write it.`,
      )
      return 1
    }
    if (onDisk === content) {
      console.log(`✓ ${command} --check: ${shown} is up to date.`)
      return 0
    }
    const diskLines = onDisk.split('\n')
    const wantLines = content.split('\n')
    console.error(
      `✖ ${command} --check: ${shown} differs from what \`basalt-ui ${command}\` emits today ` +
        `(on disk ${diskLines.length} lines, emitted ${wantLines.length}) — re-run the same ` +
        'command without --check and commit the result. A basalt-ui release moves the ' +
        '`@generated` header line, so this is byte-exact — expect a no-op commit on every upgrade ' +
        'that ships a committed generated sheet.',
    )
    return 1
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
  console.log(`wrote ${content.split('\n').length} lines → ${shown}`)
  return 0
}

/** The 2.x flags the v3 command no longer has: each one exits 1 and names `--selector`, its successor. */
const REMOVED_FLAGS = [
  '--only',
  '--selector-attribute',
  '--selector-class',
  '--light-class',
  '--dark-value',
  '--light-value',
  '--default-scheme',
  '--media-fallback',
] as const

const VALUE_FLAGS = [
  '--accent',
  '--neutral',
  '--vibrancy',
  '--selector',
  '--extra',
  '--format',
  '--out',
] as const
const BOOLEAN_FLAGS = ['--check'] as const

const NEUTRALS: readonly NeutralV3[] = ['zinc', 'neutral', 'stone', 'slate']

/** The first reason the flag list is not a legal invocation, or null. */
function flagError(flags: readonly string[]): string | null {
  for (const flag of flags) {
    if (!flag.startsWith('--')) continue
    if ((REMOVED_FLAGS as readonly string[]).includes(flag)) {
      return (
        `${flag} is gone: v3 has one scheme contract (data-theme, with the OS fallback always emitted). ` +
        'Scope a sheet with --selector ":root[<attr>]" (a tenant sheet of the differing roles) instead.'
      )
    }
    if (
      !(VALUE_FLAGS as readonly string[]).includes(flag) &&
      !(BOOLEAN_FLAGS as readonly string[]).includes(flag)
    ) {
      return `unrecognized flag '${flag}'. Accepted: ${[...VALUE_FLAGS, ...BOOLEAN_FLAGS].join(' ')}`
    }
  }
  for (const flag of VALUE_FLAGS) {
    if (flags.includes(flag) && flagValue([...flags], flag) === undefined) {
      return `${flag} needs a value`
    }
  }
  return null
}

/** `--accent`, `--neutral`, `--vibrancy` as a derive config, or the reason they are not one. */
function readConfig(flags: string[]): { config: Partial<DeriveV3Config> } | { error: string } {
  const config: Partial<DeriveV3Config> = {}
  const accent = flagValue(flags, '--accent')
  if (accent !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(accent))
      return { error: `--accent must be a #rrggbb hex (got '${accent}')` }
    config.accent = accent.toLowerCase()
  }
  const neutral = flagValue(flags, '--neutral')
  if (neutral !== undefined) {
    if (!NEUTRALS.includes(neutral as NeutralV3)) {
      return { error: `--neutral must be one of ${NEUTRALS.join(', ')} (got '${neutral}')` }
    }
    config.neutral = neutral as NeutralV3
  }
  const vibrancy = flagValue(flags, '--vibrancy')
  if (vibrancy !== undefined) {
    const level = Number(vibrancy)
    const { min, max } = VIBRANCY_RANGE_V3
    if (!Number.isInteger(level) || level < min || level > max) {
      return { error: `--vibrancy must be an integer ${min}..${max} (got '${vibrancy}')` }
    }
    config.vibrancy = level
  }
  return { config }
}

/** `tokens:css <flags minus --check>`: the invocation line 2 of the header (and `$provenance`) records. */
function invocationOf(flags: string[]): string {
  const shown = flags.filter((f) => f !== '--check')
  return shown.length === 0 ? 'basalt-ui tokens:css' : `basalt-ui tokens:css ${shown.join(' ')}`
}

/** `--extra`: the app sheet to `--out` and its `.d.ts` beside it, both gated by `--check`. */
function extraOutput(flags: string[], cwd: string, version: string): number {
  const file = flagValue(flags, '--extra') as string
  const out = flagValue(flags, '--out')
  if (out === undefined) {
    console.error(
      'tokens:css --extra needs --out <path>: the sheet and its .d.ts are two files, so there is no stdout form.',
    )
    return 1
  }
  const clash = ['--accent', '--neutral', '--vibrancy', '--selector', '--format'].find((f) =>
    flags.includes(f),
  )
  if (clash !== undefined) {
    console.error(
      `tokens:css --extra emits the app-owned sheet only; ${clash} belongs to the basalt-ui sheet — run it without --extra.`,
    )
    return 1
  }
  const abs = isAbsolute(file) ? file : resolve(cwd, file)
  const loaded = loadExtra(abs)
  if (!loaded.ok) {
    console.error(`tokens:css --extra: ${loaded.error}`)
    return 1
  }
  const header = generatedHeader(version, 'tokens:css', flags)
  const result = emitExtra(loaded.data, file, header)
  if (!result.ok) {
    console.error(`✖ tokens:css --extra: ${result.error}`)
    return 1
  }
  const check = flags.includes('--check') ? ['--check'] : []
  const css = emitGeneratedCss(result.css, flags, cwd, 'tokens:css')
  // Both files are always reported: a drifted .d.ts must not hide behind a clean sheet.
  const dts = emitGeneratedCss(result.dts, ['--out', `${out}.d.ts`, ...check], cwd, 'tokens:css')
  return css === 0 && dts === 0 ? 0 : 1
}

/**
 * tokens:css — emit the `--vx-*` stylesheet (or, with `--format json`, the resolved hex per opaque
 * role) for an app that installs nothing: `bunx basalt-ui tokens:css --accent #0f8a7e --out
 * src/tokens.css`. The values come from the v3 emitters (`emitTokensCss`, `emitJsonText`), so the
 * CLI and the API cannot disagree; the CLI adds file framing only: the provenance header already
 * written by the emitter, and `rgba()` spacing a formatter would otherwise rewrite.
 *
 * - `--accent --neutral --vibrancy` retune the identity; a config that fails a gate exits 1 with
 *   the gate, the scheme and the ratio.
 * - `--selector ":root[<attr>]"` emits a tenant sheet: only the roles that differ from the default.
 * - `--extra <file>` emits the app-owned tokens instead (see `./tokens-css-extra`).
 * - `--check` writes nothing and exits 1 on any byte of drift in what `--out` names.
 */
export function tokensCss(argv: string[], cwd: string = process.cwd()): number {
  // `--vibrancy=-2`: the `=` form is the only way a negative number gets past `parseArgs`.
  const flags = argv.flatMap((a) =>
    /^--[a-z-]+=/.test(a) ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a],
  )
  const bad = flagError(flags)
  if (bad !== null) {
    console.error(`tokens:css: ${bad}`)
    return 1
  }
  const version = readFrameworkVersion(packageRoot())
  if (flags.includes('--extra')) return extraOutput(flags, cwd, version)

  const format = flagValue(flags, '--format') ?? 'css'
  if (format !== 'css' && format !== 'json') {
    console.error(`tokens:css: --format must be css or json (got '${format}')`)
    return 1
  }
  const read = readConfig(flags)
  if ('error' in read) {
    console.error(`tokens:css: ${read.error}`)
    return 1
  }
  const selector = flagValue(flags, '--selector')
  if (selector !== undefined && format === 'json') {
    console.error('tokens:css: --selector scopes a stylesheet; the JSON has no selectors.')
    return 1
  }

  const options = {
    version,
    command: invocationOf(flags),
    ...(Object.keys(read.config).length === 0 ? {} : { config: read.config }),
    ...(selector === undefined ? {} : { selector }),
  }
  let content: string
  try {
    content =
      format === 'json' ? emitJsonText(options) : normalizeColorFunctions(emitTokensCss(options))
  } catch (err) {
    console.error(`✖ tokens:css: ${err instanceof Error ? err.message : String(err)}`)
    return 1
  }
  return emitGeneratedCss(content, flags, cwd, 'tokens:css')
}

/** Every `--basalt-font-*` declaration in the shipped stylesheet, in source order. */
function readShippedFontDecls(pkgRoot: string): {
  face: string
  decls: { name: string; value: string }[]
} {
  const css = readSource(pkgRoot, 'dist/styles.css') ?? readSource(pkgRoot, 'src/styles.css') ?? ''
  const face = css.match(/@font-face\s*\{[^}]*'Basalt Head Digits'[^}]*\}\n*/)?.[0] ?? ''
  const decls = [...css.matchAll(/(--basalt-font[\w-]*)\s*:\s*([^;]+);/g)].map((m) => ({
    name: m[1] as string,
    value: (m[2] as string).replace(/\s+/g, ' ').trim(),
  }))
  return { face: face && `${face.trim()}\n\n`, decls }
}

/**
 * fonts:css — emit the shipped `--basalt-font-*` stacks as plain CSS.
 *
 * The typeface half of the framework-free route, which had no supported path at all: `tokens.css`
 * emits no font vars, `styles.css` is the one place the defaults live and a framework-free consumer
 * is told not to import it, and `buildFontsCss` returns `''` unless the caller already knows the
 * stacks. The one non-Mantine consumer lost its font identity entirely and hardcoded the stacks.
 * The declarations (and the `Basalt Head Digits` face the head stack leads with) are READ from the
 * shipped stylesheet, so this command and `basalt-ui/styles.css` can never name different
 * typefaces. The fonts are `@fontsource-variable/*` packages (the face's `url()` is a bare package
 * specifier for a bundler); without them the stacks fall back to system fonts.
 */
export function fontsCss(flags: string[], cwd: string = process.cwd()): number {
  const pkgRoot = packageRoot()
  const { face, decls } = readShippedFontDecls(pkgRoot)
  if (decls.length === 0) {
    console.error(
      'fonts:css: could not read the shipped font stacks from styles.css — this is a packaging ' +
        'bug in basalt-ui, not a config error.',
    )
    return 1
  }
  const body = `${face}:root {\n${decls.map((d) => `  ${d.name}: ${d.value};`).join('\n')}\n}\n`
  const header = generatedHeader(readFrameworkVersion(pkgRoot), 'fonts:css', flags)
  return emitGeneratedCss(`${header}${body}`, flags, cwd, 'fonts:css')
}
