/**
 * `tokens:css` / `fonts:css` — split out of `src/cli/index.ts` (C2) so the dispatcher file holds
 * routing only. Imports its shared plumbing (`readFrameworkVersion`, `packageRoot`, `readSource`,
 * `readIfExists`) back from `./index`, this package's shared CLI helpers.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import { GENERATED_HEADER_LINE } from '../guard'
import { buildPaletteCss } from '../tokens'
import { packageRoot, readFrameworkVersion, readIfExists, readSource } from './index'

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
 * survives a normal repo's formatter.
 *
 * This is FORMATTING ONLY and deliberately the CLI's single deviation from "print exactly what
 * `buildPaletteCss` returned": `rgba(255,255,255,0.6)` and `rgba(255, 255, 255, 0.6)` are the same
 * colour, the shipped palette emits the first form on the dark side and the second on the light
 * side, and a consumer committing the output ate a lint-ignore entry for the difference. The token
 * VALUES are untouched — nothing here can change what basalt's tokens are.
 *
 * Trailing zeros go the same way and for the same reason: prettier rewrites `0.10` → `0.1`, so the
 * two `rgba(28, 25, 23, 0.10)` alphas in the light shadow tokens were the whole reason the one
 * framework-free consumer still could not lint its committed sheet — `--fix` and `tokens:css
 * --check` disagreed forever, and the lint-ignore entry survived two releases. Only a bare decimal
 * literal is touched (never a `%`, a `var()` or a unit), and `0.10`/`0.1` are the same number.
 *
 * Exported for tests, so the expectation can be computed rather than restated.
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

/** A scheme-class emission uses this sentinel attribute, then rewrites it to a class selector. */
const SCHEME_CLASS_SENTINEL = 'data-basalt-scheme-class'

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

/**
 * tokens:css — emit the `--vx-*` stylesheet, optionally retargeted.
 *
 * The escape hatch from installing anything: a static site runs this once (`bunx basalt-ui
 * tokens:css --selector-attribute data-theme --out src/tokens.css`) and consumes basalt's token
 * system as plain CSS, with no package in its dependency tree at all. `basalt-ui/tokens.css` is the
 * same artifact for a consumer that does install; this command exists for the ones that shouldn't
 * have to just to change a selector.
 *
 * It parses flags and calls `buildPaletteCss` for the token VALUES — the CLI and the API must not
 * be able to disagree about what basalt's tokens are. What it adds is strictly file framing for an
 * artifact a consumer COMMITS: the `@generated` header (the guard's skip marker), a trailing
 * newline, and `rgba()` argument spacing. All three were reported by the one framework-free
 * consumer as the reasons the output could not simply be committed.
 */
export function tokensCss(flags: string[], cwd: string = process.cwd()): number {
  const attribute = flagValue(flags, '--selector-attribute')
  const schemeClass = flagValue(flags, '--selector-class')
  const lightClass = flagValue(flags, '--light-class')
  const darkValue = flagValue(flags, '--dark-value')
  const lightValue = flagValue(flags, '--light-value')
  const defaultScheme = flagValue(flags, '--default-scheme')

  const only = flagValue(flags, '--only')

  if (defaultScheme !== undefined && !['dark', 'light', 'none'].includes(defaultScheme)) {
    console.error(
      `tokens:css: --default-scheme must be dark, light or none (got '${defaultScheme}')`,
    )
    return 1
  }
  if (only !== undefined && !['core', 'all'].includes(only)) {
    console.error(`tokens:css: --only must be core or all (got '${only}')`)
    return 1
  }
  if (schemeClass !== undefined && attribute !== undefined) {
    console.error(
      'tokens:css: --selector-class and --selector-attribute are alternatives — pass one.',
    )
    return 1
  }
  if (schemeClass !== undefined && /[^\w-]/.test(schemeClass)) {
    console.error(
      `tokens:css: --selector-class must be a plain CSS class name (got '${schemeClass}')`,
    )
    return 1
  }
  if (lightClass !== undefined && /[^\w-]/.test(lightClass)) {
    console.error(`tokens:css: --light-class must be a plain CSS class name (got '${lightClass}')`)
    return 1
  }

  // A class selector is Tailwind's universal dark convention (`<html class="dark">`) and was
  // reachable before only by parking dark on the bare `:root` via --default-scheme. `buildPaletteCss`
  // emits attribute selectors, so the class form is produced by emitting against a sentinel
  // attribute this CLI chose itself and rewriting exactly those selectors — a rewrite of strings
  // the command generated deterministically, never of a token value.
  const resolvedDarkValue = schemeClass !== undefined ? schemeClass : darkValue
  const resolvedLightValue = schemeClass !== undefined ? (lightClass ?? 'light') : lightValue
  const resolvedAttribute = schemeClass !== undefined ? SCHEME_CLASS_SENTINEL : attribute

  const scheme = {
    ...(resolvedAttribute === undefined ? {} : { attribute: resolvedAttribute }),
    ...(resolvedDarkValue === undefined ? {} : { darkValue: resolvedDarkValue }),
    ...(resolvedLightValue === undefined ? {} : { lightValue: resolvedLightValue }),
  }

  let css = buildPaletteCss({
    ...(Object.keys(scheme).length === 0 ? {} : { scheme }),
    ...(defaultScheme === undefined
      ? {}
      : { defaultScheme: defaultScheme as 'dark' | 'light' | 'none' }),
    ...(flags.includes('--media-fallback') ? { mediaFallback: true } : {}),
    ...(only === undefined ? {} : { only: only as 'core' | 'all' }),
    // The tokens-only consumer is exactly the one who writes these names by hand, so they are also
    // the one who wants the deprecated camelCase aliases gone — and this command is their only
    // entry point. Without the flag the CLI and the API could disagree about what basalt's tokens
    // are, which is the one thing this command is documented never to allow.
    ...(flags.includes('--no-legacy-aliases') ? { legacyAliases: false } : {}),
  })

  if (schemeClass !== undefined) {
    css = css.replace(
      new RegExp(`\\[${SCHEME_CLASS_SENTINEL}='([\\w-]+)'\\]`, 'g'),
      (_match, value: string) => `.${value}`,
    )
  }

  const version = readFrameworkVersion(packageRoot())
  const content = `${generatedHeader(version, 'tokens:css', flags)}${normalizeColorFunctions(css)}\n`
  return emitGeneratedCss(content, flags, cwd, 'tokens:css')
}

/** Every `--basalt-font-*` declaration in the shipped stylesheet, in source order. */
function readShippedFontDecls(pkgRoot: string): { name: string; value: string }[] {
  const css = readSource(pkgRoot, 'dist/styles.css') ?? readSource(pkgRoot, 'src/styles.css')
  if (css === null) return []
  const decls: { name: string; value: string }[] = []
  for (const match of css.matchAll(/(--basalt-font[\w-]*)\s*:\s*([^;]+);/g)) {
    decls.push({
      name: match[1] as string,
      value: (match[2] as string).replace(/\s+/g, ' ').trim(),
    })
  }
  return decls
}

/**
 * fonts:css — emit the shipped `--basalt-font-*` stacks as plain CSS.
 *
 * The typeface half of the framework-free route, which had no supported path at all: `tokens.css`
 * emits no font vars, `styles.css` is the one place the defaults live and a framework-free consumer
 * is told not to import it, and `buildFontsCss` returns `''` unless the caller already knows the
 * stacks. The one non-Mantine consumer lost its font identity entirely and hardcoded the stacks —
 * which the theme guard then flagged as `raw-font-family`.
 *
 * The declarations are READ from the shipped stylesheet rather than restated here, so this command
 * and `basalt-ui/styles.css` can never name different typefaces. Note the fonts themselves are
 * `@fontsource-variable/*` packages: without them the stacks fall through to their own system
 * fallbacks, which is the intended framework-free behaviour.
 */
export function fontsCss(flags: string[], cwd: string = process.cwd()): number {
  const pkgRoot = packageRoot()
  const decls = readShippedFontDecls(pkgRoot)
  if (decls.length === 0) {
    console.error(
      'fonts:css: could not read the shipped font stacks from styles.css — this is a packaging ' +
        'bug in basalt-ui, not a config error.',
    )
    return 1
  }
  const body = `:root {\n${decls.map((d) => `  ${d.name}: ${d.value};`).join('\n')}\n}\n`
  const header = generatedHeader(readFrameworkVersion(pkgRoot), 'fonts:css', flags)
  return emitGeneratedCss(`${header}${body}`, flags, cwd, 'fonts:css')
}
