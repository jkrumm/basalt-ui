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

export const COMMAND_OPTIONS: Record<
  string,
  Record<string, { type: 'string' | 'boolean'; multiple?: boolean }>
> = {
  init: {
    'no-merge-lint': { type: 'boolean' },
  },
  sync: {
    force: { type: 'boolean' },
    check: { type: 'boolean' },
    verbose: { type: 'boolean' },
    'tokens-only': { type: 'boolean' },
    framework: { type: 'boolean' },
  },
  'check-theme': {
    'audit-allows': { type: 'boolean' },
    'tokens-only': { type: 'boolean' },
    framework: { type: 'boolean' },
  },
  doctor: {
    'tokens-only': { type: 'boolean' },
    framework: { type: 'boolean' },
    from: { type: 'string' },
  },
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
  },
  'fonts:css': { out: { type: 'string' }, check: { type: 'boolean' } },
  shot: {
    base: { type: 'string' },
    dist: { type: 'string' },
    out: { type: 'string' },
    states: { type: 'string' },
    'local-storage': { type: 'string', multiple: true },
    api: { type: 'string', multiple: true },
    header: { type: 'string', multiple: true },
    wait: { type: 'string' },
    'auto-anchors': { type: 'boolean' },
    'api-allow-writes': { type: 'boolean' },
    lint: { type: 'string' },
  },
}

/** The first flag `cmd` does not accept, or null. Unknown commands return null — the dispatcher's
 * default branch already names those. */
export function unknownFlag(cmd: string, flags: readonly string[]): string | null {
  const options = COMMAND_OPTIONS[cmd]
  if (options === undefined) return null
  try {
    parseArgs({ args: [...flags], options, strict: true, allowPositionals: cmd === 'shot' })
    return null
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const match = /'(-{1,2}[^']+)'/.exec(message)
    return match?.[1] ?? flags.find((f) => f.startsWith('-')) ?? flags[0] ?? null
  }
}

/** The one usage string — printed by `basalt help` / `--help` / `-h` AND the unknown-command fallback. */
export const USAGE =
  'Usage: basalt-ui <--version | init [--no-merge-lint] |\n' +
  '                  sync [--force] [--check] [--verbose] [--tokens-only|--framework] |\n' +
  '                  check-theme [--audit-allows] |\n' +
  '                  doctor [--tokens-only|--framework|--from <x.y.z>] | guard-hook | tokens:css | fonts:css |\n' +
  '                  shot <route…> | shot detect | help>\n\n' +
  'check-theme [--tokens-only|--framework] [--audit-allows]\n' +
  '  --audit-allows reports instead of scanning: every `theme-allow` annotation and every\n' +
  '  `basalt.exemptRules` entry, with what each one still suppresses — proved by re-running the\n' +
  '  guard with that one waiver neutralized, not by reading its text. Exits 1 on a waiver that\n' +
  '  suppresses nothing (dead), which is what makes it usable as a CI gate.\n\n' +
  'tokens:css [--out <path>] [--check] [--selector-attribute <attr> | --selector-class <class>]\n' +
  '           [--light-class <class>] [--dark-value <v>] [--light-value <v>]\n' +
  '           [--default-scheme <dark|light|none>] [--media-fallback] [--only <core|all>]\n' +
  '  Emit the --vx-* stylesheet (stdout unless --out). Defaults emit the stock identity; commit the output as your tokens file.\n' +
  '  --selector-class emits `:root.dark` instead of an attribute selector (the Tailwind convention).\n' +
  '  --check writes nothing and exits 1 when --out differs from what would be emitted (a CI gate).\n' +
  '\n' +
  'fonts:css [--out <path>] [--check]\n' +
  '  Emit the shipped --basalt-font-* stacks as plain CSS — the typeface half of the token layer,\n' +
  '  otherwise reachable only by importing styles.css.\n\n' +
  'shot <route…> (--base <url> | --dist <dir>) [--out <dir>] [--states <list>]\n' +
  '  Render routes in Chromium (Playwright from YOUR project: bun add -d playwright) and write\n' +
  '  board.html, metrics.json and png/* — every data-shot anchor × light/dark × desktop/mobile ×\n' +
  '  rest, hover, focus, tooltip, empty, loading, error. --dist serves a built SPA dir itself.\n' +
  '  --out must resolve inside the project (the app dir in a monorepo, not the repo root); routes are\n' +
  '  separate arguments (zsh does not word-split $ROUTES).\n' +
  '  Default --out .basalt/shots (emptied each run); .basalt/shots/last.json names the last out dir.\n' +
  '  A real, signed-in app: [--local-storage <key>=<@env:NAME|@file:path>]… seeds localStorage (app origin\n' +
  '  only) before any page script; [--api <prefix>=<origin>]… (with --dist) proxies GET/HEAD under that\n' +
  '  prefix to the origin (other methods get 405 unless --api-allow-writes); [--header <name>=@env:NAME]… is\n' +
  '  added to every proxied request, to EVERY --api origin (never on a navigation; https required);\n' +
  '  [--wait <ms|networkidle>] adds ms of settle AFTER networkidle (default none); [--auto-anchors] crops\n' +
  '  each Card, Paper and table over 120×60 px (else main, section, header, form) on a page with no data-shot. Values are never printed or\n' +
  '  written; a redirect, 401/403/404, 5xx or dead API fails every shot of that page. Shots of real data go to the\n' +
  '  reviewer subagent and so to its model provider: point --api at staging or synthetic data when the\n' +
  "  app holds other people's data. Example:\n" +
  '    basalt-ui shot /overview --dist dist --api /api=https://app.example.com \\\n' +
  '      --local-storage auth-token=@env:APP_TOKEN --header authorization=@env:APP_BEARER --auto-anchors\n\n' +
  'shot detect [--out <dir>] [--lint <oxlint-json-file>]\n' +
  '  The deterministic second review pass, no browser and no model: reads <out>/metrics.json (default: the\n' +
  '  out dir in .basalt/shots/last.json) and, with --lint, the basalt/* diagnostics of `oxlint --format json`\n' +
  '  output saved to a file. Writes <out>/detect.json and a findings table, content, then layout, then style:\n' +
  '  off-scale inset/gap/radius, nested radius step under 3 px, more than 3 font sizes, an empty region of\n' +
  '  40 % or more, contrast failures, error shots, a missing scale or no anchors.\n' +
  '  Exit codes: 0 clean (P2/P3 findings are listed, not failing), 2 a P0 or P1 finding, 1 scan failure (missing\n' +
  '  or unreadable metrics.json or lint file, or detect.json/history.json cannot be written).\n' +
  '    P0  fails: broken, unreadable or a contrast failure; an error shot; no anchors\n' +
  '    P1  fails: a rubric item fails (off-scale value, font sizes, empty region, nested radius, lint error)\n' +
  '    P2  noted, not failing: degraded: a lint warning, a contrast measured on an assumed white backdrop\n' +
  '    P3  noted, not failing: polish: an off-scale value within 1 px of a step\n' +
  '  score = 100 - (25 per P0 + 10 per P1 + 3 per P2 + 1 per P3), floored at 0. Each run appends\n' +
  '  {at, out, commit, counts, score} to .basalt/shots/history.json and prints the last 5 scores of THAT --out dir as a trend\n' +
  '  with the finding count beside each (the score floors at 0). No anchor measured: "nothing measured", no score.\n' +
  '  detect takes --out <dir>, never a positional.\n' +
  '  A component can declare a rest anchor absent in a URL state with data-shot-absent="empty error": that\n' +
  '  cell is recorded `absent`, not `error`.\n\n' +
  'doctor [--tokens-only|--framework] [--from <x.y.z>]\n' +
  '  doctor --from <x.y.z>  print the consumer-visible MIGRATING changes since that version\n' +
  '  Checks THIS project only: the manifest exists, the oxlint preset is wired, the pre-commit\n' +
  '  hook runs check-theme (via `lefthook dump`), and the ai package major is consistent within\n' +
  '  this package.json. Profile is DECLARED, same as check-theme — never inferred.\n\n' +
  'sync [--force] [--check] [--verbose] [--tokens-only|--framework]\n' +
  '  Refreshes an EXISTING install; it never creates one (that is init). A tokens-only consumer\n' +
  '  has no scaffold to reconcile, so sync reports n/a and exits 0 there — as doctor does.\n' +
  '  --check prints the permanent placement skips as a COUNT; --verbose spells them out again.\n\n' +
  'check-theme / doctor / sync all resolve their project the same way: BASALT_CWD, else the\n' +
  'invocation cwd — nothing inferred, nothing ascended or descended into.\n' +
  '--tokens-only and --framework are alternatives; passing both is an error.\n\n' +
  'Every subcommand accepts --help / -h to print this message and exit without running.\n' +
  '--version / -v prints the resolved package version and exits 0 — the one command that proves\n' +
  'WHICH basalt-ui ran, which a `bunx` cache can otherwise make a lie. An unknown command or an\n' +
  'unrecognized flag exits 1 and names what it did not understand; neither is ever ignored.'
