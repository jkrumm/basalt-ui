/**
 * `USAGE` + the per-command flag schema — split out of `src/cli/index.ts` (C2) so the dispatcher
 * file holds routing only.
 *
 * Every flag each subcommand accepts, as a `node:util` `parseArgs` options schema — one per
 * command, replacing a hand-rolled flag table + a value-flag lookahead set + a manual scan.
 *
 * An unrecognized flag used to be SILENTLY IGNORED and the command exited 0: `check-theme
 * --audit-allow` scanned normally and reported success, `doctor --json` printed the human report.
 * That is the same fail-open shape `--version` had, and it is worse on a CLI agents drive
 * programmatically, where a typo'd gate reads as a passing gate.
 */
import { parseArgs } from 'node:util'

export const COMMAND_OPTIONS: Record<string, Record<string, { type: 'string' | 'boolean' }>> = {
  init: {
    'with-router': { type: 'boolean' },
    'with-query': { type: 'boolean' },
    'merge-lint': { type: 'boolean' },
  },
  sync: {
    force: { type: 'boolean' },
    check: { type: 'boolean' },
    'tokens-only': { type: 'boolean' },
    framework: { type: 'boolean' },
  },
  'check-theme': {
    'audit-allows': { type: 'boolean' },
    'tokens-only': { type: 'boolean' },
    framework: { type: 'boolean' },
  },
  doctor: { 'tokens-only': { type: 'boolean' }, framework: { type: 'boolean' } },
  'guard-hook': {},
  'tokens:css': {
    out: { type: 'string' },
    check: { type: 'boolean' },
    'selector-attribute': { type: 'string' },
    'selector-class': { type: 'string' },
    'light-class': { type: 'string' },
    'dark-value': { type: 'string' },
    'light-value': { type: 'string' },
    'default-scheme': { type: 'string' },
    'media-fallback': { type: 'boolean' },
    only: { type: 'string' },
    'no-legacy-aliases': { type: 'boolean' },
  },
  'fonts:css': { out: { type: 'string' }, check: { type: 'boolean' } },
}

/** The first flag `cmd` does not accept, or null. Unknown commands return null — the dispatcher's
 * default branch already names those. */
export function unknownFlag(cmd: string, flags: readonly string[]): string | null {
  const options = COMMAND_OPTIONS[cmd]
  if (options === undefined) return null
  try {
    parseArgs({ args: [...flags], options, strict: true, allowPositionals: false })
    return null
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const match = /'(-{1,2}[^']+)'/.exec(message)
    return match?.[1] ?? flags.find((f) => f.startsWith('-')) ?? flags[0] ?? null
  }
}

/** The one usage string — printed by `basalt help` / `--help` / `-h` AND the unknown-command fallback. */
export const USAGE =
  'Usage: basalt-ui <--version | init [--with-router] [--with-query] [--merge-lint] |\n' +
  '                  sync [--force] [--check] [--tokens-only|--framework] |\n' +
  '                  check-theme [--audit-allows] |\n' +
  '                  doctor [--tokens-only|--framework] | guard-hook | tokens:css | fonts:css | help>\n\n' +
  'check-theme [--tokens-only|--framework] [--audit-allows]\n' +
  '  --audit-allows reports instead of scanning: every `theme-allow` annotation and every\n' +
  '  `basalt.exemptRules` entry, with what each one still suppresses — proved by re-running the\n' +
  '  guard with that one waiver neutralized, not by reading its text. Exits 1 on a waiver that\n' +
  '  suppresses nothing (dead), which is what makes it usable as a CI gate.\n\n' +
  'tokens:css [--out <path>] [--check] [--selector-attribute <attr> | --selector-class <class>]\n' +
  '           [--light-class <class>] [--dark-value <v>] [--light-value <v>]\n' +
  '           [--default-scheme <dark|light|none>] [--media-fallback] [--only <core|all>]\n' +
  '           [--no-legacy-aliases]\n' +
  '  Emit the --vx-* stylesheet (stdout unless --out). Defaults reproduce basalt-ui/tokens.css.\n' +
  '  --selector-class emits `:root.dark` instead of an attribute selector (the Tailwind convention).\n' +
  '  --check writes nothing and exits 1 when --out differs from what would be emitted (a CI gate).\n' +
  '  --no-legacy-aliases drops the deprecated camelCase spellings (--vx-accentFill and friends),\n' +
  '  which are emitted by default as aliases of the canonical kebab-case names.\n\n' +
  'fonts:css [--out <path>] [--check]\n' +
  '  Emit the shipped --basalt-font-* stacks as plain CSS — the typeface half of the token layer,\n' +
  '  otherwise reachable only by importing styles.css.\n\n' +
  'doctor [--tokens-only|--framework]\n' +
  '  Checks THIS project only: the manifest exists, the oxlint preset is wired, the pre-commit\n' +
  '  hook runs check-theme (via `lefthook dump`), and the ai package major is consistent within\n' +
  '  this package.json. Profile is DECLARED, same as check-theme — never inferred.\n\n' +
  'sync [--force] [--check] [--tokens-only|--framework]\n' +
  '  Refreshes an EXISTING install; it never creates one (that is init). A tokens-only consumer\n' +
  '  has no scaffold to reconcile, so sync reports n/a and exits 0 there — as doctor does.\n\n' +
  'check-theme / doctor / sync all resolve their project the same way: BASALT_CWD, else the\n' +
  'invocation cwd — nothing inferred, nothing ascended or descended into.\n' +
  '--tokens-only and --framework are alternatives; passing both is an error.\n\n' +
  'Every subcommand accepts --help / -h to print this message and exit without running.\n' +
  '--version / -v prints the resolved package version and exits 0 — the one command that proves\n' +
  'WHICH basalt-ui ran, which a `bunx` cache can otherwise make a lie. An unknown command or an\n' +
  'unrecognized flag exits 1 and names what it did not understand; neither is ever ignored.'
