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
    profile: { type: 'string' },
    root: { type: 'string', multiple: true },
    'tokens-out': { type: 'string' },
    'tokens-json-out': { type: 'string' },
    extra: { type: 'string' },
    accent: { type: 'string' },
    neutral: { type: 'string' },
    vibrancy: { type: 'string' },
    selector: { type: 'string' },
    'no-install': { type: 'boolean' },
  },
  sync: {
    force: { type: 'boolean' },
    check: { type: 'boolean' },
  },
  'check-theme': {
    'audit-allows': { type: 'boolean' },
    'tokens-only': { type: 'boolean' },
    framework: { type: 'boolean' },
  },
  doctor: { from: { type: 'string' } },
  'guard-hook': {},
  'tokens:css': {
    out: { type: 'string' },
    check: { type: 'boolean' },
    accent: { type: 'string' },
    neutral: { type: 'string' },
    vibrancy: { type: 'string' },
    selector: { type: 'string' },
    extra: { type: 'string' },
    format: { type: 'string' },
    // The 2.x flags stay PARSEABLE so `tokensCss` can exit 1 naming `--selector`, their successor,
    // rather than the generic unrecognized-flag line.
    only: { type: 'string' },
    'selector-attribute': { type: 'string' },
    'selector-class': { type: 'string' },
    'light-class': { type: 'string' },
    'dark-value': { type: 'string' },
    'light-value': { type: 'string' },
    'default-scheme': { type: 'string' },
    'media-fallback': { type: 'boolean' },
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
  'Usage: basalt-ui <--version | init --profile <tokens|bridge|parts|app> [--root <path>]… [--no-install] |\n' +
  '                  sync [--check] [--force] |\n' +
  '                  check-theme [--audit-allows] |\n' +
  '                  doctor [--from <x.y.z>] | guard-hook | tokens:css | fonts:css |\n' +
  '                  shot <route…> | shot detect | help>\n\n' +
  'check-theme [--tokens-only|--framework] [--audit-allows]\n' +
  '  --audit-allows reports instead of scanning: every `theme-allow` annotation and every\n' +
  '  `basalt.exemptRules` entry, with what each one still suppresses — proved by re-running the\n' +
  '  guard with that one waiver neutralized, not by reading its text. Exits 1 on a waiver that\n' +
  '  suppresses nothing (dead), which is what makes it usable as a CI gate.\n\n' +
  'tokens:css [--accent <#hex>] [--neutral <zinc|neutral|stone|slate>] [--vibrancy <-4..5>]\n' +
  '           [--selector <:root[attr]>] [--extra <file>] [--format <css|json>] [--out <path>] [--check]\n' +
  '  Emit the --vx-* stylesheet (stdout unless --out). Defaults emit the stock identity; commit the output as your tokens file.\n' +
  '  --format json emits the resolved #hex per opaque role and scheme, for manifests, theme-color metas and email.\n' +
  '  --selector scopes a tenant sheet (only the roles that differ from the default) to a `:root[…]` selector.\n' +
  '  --extra emits your app-owned tokens (src/basalt.tokens.ts) to --out, plus a sibling <out>.d.ts.\n' +
  '  --check writes nothing and exits 1 when --out (and the .d.ts) differ from what would be emitted (a CI gate).\n' +
  '  Negative values take the = form: --vibrancy=-2.\n' +
  '\n' +
  'fonts:css [--out <path>] [--check]\n' +
  '  Emit the shipped --basalt-font-* stacks as plain CSS — the typeface half of the token layer,\n' +
  '  otherwise reachable only by importing styles.css.\n\n' +
  'shot <route…> (--base <url> | --dist <dir>) --out <dir> [--states <list>]\n' +
  '  Render routes in Chromium (Playwright from YOUR project: bun add -d playwright) and write\n' +
  '  board.html, metrics.json and png/* — every anchor × light/dark × the manifest viewports ×\n' +
  '  rest, hover, focus, tooltip, empty, loading, error. An anchor is a data-shot element, else the\n' +
  '  outermost stat-card, chart-card, data-table, section, card or board data-slot. Viewports come from\n' +
  '  .basalt/manifest.json (default 1800x1200 and 390x844). --dist serves a built SPA dir itself.\n' +
  '  --out must resolve inside the project (the app dir in a monorepo, not the repo root); routes are\n' +
  '  separate arguments (zsh does not word-split $ROUTES).\n' +
  '  --out is required and must not exist yet: every round writes a fresh dir (shots-1, shots-2, …).\n' +
  '  .basalt/last-shot.json records the latest round (at, out, round).\n' +
  '  A real, signed-in app: [--local-storage <key>=<@env:NAME|@file:path>]… seeds localStorage (app origin\n' +
  '  only) before any page script; [--api <prefix>=<origin>]… (with --dist) proxies GET/HEAD under that\n' +
  '  prefix to the origin (other methods get 405 unless --api-allow-writes); [--header <name>=@env:NAME]… is\n' +
  '  added to every proxied request, to EVERY --api origin (never on a navigation; https required);\n' +
  '  [--wait <ms|networkidle>] adds ms of settle AFTER networkidle (default none); [--auto-anchors] crops\n' +
  '  each card and table over 120×60 px (else main, section, header, form) on a page with no anchor. Values are never printed or\n' +
  '  written; a redirect, 401/403/404, 5xx or dead API fails every shot of that page. Shots of real data go to the\n' +
  '  reviewer subagent and so to its model provider: point --api at staging or synthetic data when the\n' +
  "  app holds other people's data. Example:\n" +
  '    basalt-ui shot /overview --dist dist --api /api=https://app.example.com \\\n' +
  '      --local-storage auth-token=@env:APP_TOKEN --header authorization=@env:APP_BEARER --auto-anchors\n\n' +
  'shot detect [--out <dir>] [--lint <oxlint-json-file>]\n' +
  '  The deterministic second review pass, no browser and no model: reads <out>/metrics.json (default: the\n' +
  '  out dir in .basalt/last-shot.json) and, with --lint, the basalt/* diagnostics of `oxlint --format json`\n' +
  '  output saved to a file. Writes <out>/detect.json and a findings table, content, then layout, then style:\n' +
  '  off-scale inset/gap/radius, nested radius step under 3 px, more than 3 font sizes, an empty region of\n' +
  '  40 % or more, overlap, a touch target under the hit floor, document overflow, a state crop identical\n' +
  '  to rest, error shots, a missing scale or no anchors. Contrast is not read: axe owns it.\n' +
  '  Exit codes: 0 clean (P2/P3 findings are listed, not failing), 2 a P0 or P1 finding, 1 scan failure (missing\n' +
  '  or unreadable metrics.json or lint file, or detect.json cannot be written).\n' +
  '    P0  fails: broken or unreadable: an error shot; no anchors\n' +
  '    P1  fails: a rubric item fails (off-scale value, font sizes, empty region, nested radius, overlap, hit floor, document overflow, an ignored state, lint error)\n' +
  '    P2  noted, not failing: degraded: a lint warning\n' +
  '    P3  noted, not failing: polish: an off-scale value within 1 px of a step\n' +
  '  score = 100 - (25 per P0 + 10 per P1 + 3 per P2 + 1 per P3), floored at 0. No anchor\n' +
  '  measured: "nothing measured", no score.\n' +
  '  detect takes --out <dir>, never a positional.\n' +
  '  A component can declare a rest anchor absent in a URL state with data-shot-absent="empty error": that\n' +
  '  cell is recorded `absent`, not `error`.\n\n' +
  'doctor [--from <x.y.z>]\n' +
  '  Twelve checks on THIS install: manifest, version drift, peers, presets, lint scan, AGENTS block,\n' +
  '  skills and rules, the hook (run from a subdirectory on a seeded offender), the formatter fence,\n' +
  '  token sheets, budgets and app wiring. Each is pass, fail or SKIPPED; SKIPPED exits non-zero.\n' +
  '  --from <x.y.z> is accepted for the 2.x upgrade flow and only points at MIGRATING.md.\n\n' +
  'init --profile <tokens|bridge|parts|app> [--root <path>]… [--tokens-out <css>] [--tokens-json-out <json>]\n' +
  '     [--extra <file>] [--accent <#hex>] [--neutral <name>] [--vibrancy <n>] [--selector <sel>] [--no-install]\n' +
  '  The one door into an install. The profile is declared, never inferred (exit 1 without it); each --root\n' +
  '  (default .) is declared with it. Paths are relative to the repo root. Writes .basalt/manifest.json and the\n' +
  "  token outputs, installs the profile's peers at exact pins with the lockfile's package manager, places the\n" +
  '  managed files and presets through sync, seeds .basalt/budget.json and DESIGN.md, writes the formatter\n' +
  '  ignore, and ends in doctor. --no-install prints the install command instead of running it. Running it\n' +
  '  twice changes nothing. Vite and CSS are patched only for a stock shape; otherwise the lines are printed.\n\n' +
  'sync [--check] [--force]\n' +
  '  Renders every managed file (.claude/{rules,skills,agents}/basalt-*, the AGENTS.md block, the\n' +
  '  preset files) and compares bytes; it refreshes an EXISTING install and never creates one (that\n' +
  '  is init). --check writes nothing and exits 1 on any difference. A managed file you edited is\n' +
  '  left and reported; --force overwrites it. A retired file is deleted if untouched, else left.\n\n' +
  'check-theme / doctor / sync all resolve their project the same way: BASALT_CWD, else the\n' +
  'invocation cwd — nothing inferred, nothing descended into (sync alone looks UP for the manifest\n' +
  'that declares the directory).\n' +
  '--tokens-only and --framework are alternatives; passing both is an error.\n\n' +
  'Every subcommand accepts --help / -h to print this message and exit without running.\n' +
  '--version / -v prints the resolved package version and exits 0 — the one command that proves\n' +
  'WHICH basalt-ui ran, which a `bunx` cache can otherwise make a lie. An unknown command or an\n' +
  'unrecognized flag exits 1 and names what it did not understand; neither is ever ignored.'
