/**
 * `USAGE` + the per-command flag schema — split out of `src/cli/index.ts` (C2) so the dispatcher
 * file holds routing only.
 *
 * Every flag each subcommand accepts, as a `node:util` `parseArgs` options schema — one per
 * command, replacing a hand-rolled flag table + a value-flag lookahead set + a manual scan.
 *
 * An unrecognized flag used to be SILENTLY IGNORED and the command exited 0: a typo'd flag ran the
 * command normally and reported success, `doctor --json` printed the human report.
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
    start: { type: 'boolean' },
  },
  sync: {
    force: { type: 'boolean' },
    check: { type: 'boolean' },
  },
  doctor: {},
  migrate: {
    from: { type: 'string' },
    profile: { type: 'string' },
    json: { type: 'boolean' },
    check: { type: 'boolean' },
  },
  lint: {
    file: { type: 'string', multiple: true },
    agent: { type: 'boolean' },
    changed: { type: 'boolean' },
    stats: { type: 'boolean' },
    'write-budget': { type: 'boolean' },
    raise: { type: 'string' },
    consumer: { type: 'string' },
    hook: { type: 'string' },
  },
  'tokens:css': {
    out: { type: 'string' },
    check: { type: 'boolean' },
    accent: { type: 'string' },
    neutral: { type: 'string' },
    vibrancy: { type: 'string' },
    selector: { type: 'string' },
    accents: { type: 'string' },
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
  'Usage: basalt-ui <--version | init --profile <tokens|site|bridge|parts|app> [--root <path>]… [--no-install] |\n' +
  '                  sync [--check] [--force] |\n' +
  '                  doctor | migrate --from <x.y.z> --profile <p> [--json] [--check] |\n' +
  '                  lint [--file <p>… | --changed | --stats | --raise escapes --consumer <who>] | tokens:css | fonts:css |\n' +
  '                  eject <name | --all | --adopt <path>> --reason <why> (experimental) | add <block>… [--dir <path>] | add --list |\n' +
  '                  shot <route…> | shot detect | help>\n\n' +
  'tokens:css [--accent <#hex>] [--neutral <zinc|neutral|stone|slate>] [--vibrancy <-4..5>]\n' +
  '           [--selector <:root[attr]> | --accents <name,…>] [--extra <file>] [--format <css|json>] [--out <path>] [--check]\n' +
  '  Emit the --basalt-* stylesheet (stdout unless --out). Defaults emit the stock identity; commit the output as your tokens file.\n' +
  '  --format json emits the resolved #hex per opaque role and scheme, for manifests, theme-color metas and email.\n' +
  '  --selector scopes a tenant sheet (only the roles that differ from the default) to a `:root[…]` selector.\n' +
  '  --accents emits the accent sheet instead: one :root[data-accent=<name>] block per named accent (blue, violet, rose,\n' +
  '    orange, green, teal) against the base the other flags set; import it after tokens.css. Without it no accent ships.\n' +
  '  --extra emits your app-owned tokens (src/basalt.tokens.ts) to --out, plus a sibling <out>.d.ts.\n' +
  '  --check writes nothing and exits 1 when --out (and the .d.ts) differ from what would be emitted (a CI gate).\n' +
  '  Negative values take the = form: --vibrancy=-2.\n' +
  '\n' +
  'fonts:css [--out <path>] [--check]\n' +
  '  Emit the shipped --basalt-font-* stacks as plain CSS — the typeface half of the token layer,\n' +
  '  otherwise reachable only by importing styles.css.\n\n' +
  'shot <route…> (--base <url> | --dist <dir>) --out <dir> [--states <list>]\n' +
  '  Render routes in Chromium (Playwright from YOUR project, a dev dependency) and write\n' +
  '  board.html, metrics.json and png/* — every anchor × light/dark × the manifest viewports ×\n' +
  '  rest, hover, focus, keys, tooltip, empty, loading, error. `keys` focuses a chart or row host, presses its\n' +
  '  arrow key twice, shoots the frame and logs the live text and focus; a page error is a named defect. An anchor is a data-shot element, else the\n' +
  '  outermost stat-card, chart-card, data-table, section, card or board data-slot, plus each open dialog-content,\n' +
  '  alert-dialog-content, sheet-content or peek panel; a hover, focus, keys or tooltip step under an open overlay is absent. Viewports come from\n' +
  '  .basalt/manifest.json (default 1800x1200 and 390x844). --dist serves a built SPA dir itself.\n' +
  '  --out must resolve inside the project (the app dir in a monorepo, not the repo root); routes are\n' +
  '  separate arguments (zsh does not word-split $ROUTES).\n' +
  '  --out is required and must not exist yet: every round writes a fresh dir (shots-1, shots-2, …).\n' +
  '  .basalt/last-shot.json records the latest round (at, out, round).\n' +
  '  empty, loading and error reload the route with ?shot-state=<state>; the page obeys only when its query result goes through\n' +
  '  shotState() from basalt-ui/data (it acts under the runner, never on a production URL). A state crop equal to rest is `states-ignored`.\n' +
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
  'shot detect [--out <dir>] [--lint <oxlint-json-file>] [--facts <dir>]\n' +
  '  The deterministic second review pass, no browser and no model: reads <out>/metrics.json (default: the\n' +
  '  out dir in .basalt/last-shot.json) and, with --lint, the basalt/* diagnostics of `oxlint --format json`\n' +
  '  output saved to a file. Writes <out>/detect.json and a findings table, content, then layout, then style:\n' +
  '  off-scale inset/gap/radius, nested radius step under 3 px, more than 3 font sizes, an empty region of\n' +
  '  40 % or more, overlap, a touch target under the hit floor, document overflow, a state crop identical\n' +
  '  to rest, error shots, a missing scale or no anchors. Contrast is not read: axe owns it.\n' +
  '  --facts <dir> reads the .tsx files under <dir> (not *.test.tsx) and lists the words, phrases and constants\n' +
  '  the page says in several places (communication-5, P2). Without --out it is the whole run: no shot round,\n' +
  '  no score, no detect.json; with --out the facts join that round. --lint needs --out.\n' +
  '  Exit codes: 0 clean (P2/P3 findings are listed, not failing), 2 a P0 or P1 finding, 1 scan failure (missing\n' +
  '  or unreadable metrics.json or lint file, or detect.json cannot be written).\n' +
  '    P0  fails: broken or unreadable: an error shot; no anchors\n' +
  '    P1  fails: a rubric item fails (off-scale value, font sizes, empty region, nested radius, overlap, hit floor, document overflow, an ignored state, lint error)\n' +
  '    P2  noted, not failing: degraded: a lint warning\n' +
  '    P3  noted, not failing: polish: an off-scale value within 1 px of a step\n' +
  '  score = 100 - (25 per P0 + 10 per P1 + 3 per P2 + 1 per P3). A score can go below 0. No anchor\n' +
  '  measured: "nothing measured", no score.\n' +
  '  detect takes --out <dir>, never a positional.\n' +
  '  A component can declare a rest anchor absent in a URL state with data-shot-absent="empty error": that\n' +
  '  cell is recorded `absent`, not `error`.\n\n' +
  'lint [--file <path>… | --changed | --stats [--write-budget] | --raise escapes --consumer "<who>"] [--agent]\n' +
  '  oxlint, stylelint and the --basalt-* name check over the declared roots, then the ceilings of\n' +
  '  .basalt/budget.json. A finding is "<file>:<line> <rule>: <message and fix>"; exit 1 on a finding or\n' +
  '  a ceiling breach, and on a scan of zero files. A full scan records the waiver count in\n' +
  '  .basalt/budget.json (waivers follow the count, so a new one shows in the diff). --file lints the named files, --changed what git\n' +
  '  reports changed (nothing changed is clean). --agent is terse and exits 2 on a finding so a hook\n' +
  '  blocks. --stats prints findings, waivers and escapes per rule against the ceilings;\n' +
  '  --stats --write-budget lands the counted waivers and escapes in .basalt/budget.json (never\n' +
  '  above the base ref for escapes; consumers never hand-edit it). --raise escapes --consumer "<who>" lifts\n' +
  '  that ceiling to the counted figure and appends a raises row naming the consumer (ejects: eject --raise).\n' +
  '  --hook <post-edit|stop|pre-edit> reads the event\n' +
  '  JSON on stdin and is called only by .basalt/hook.mjs; it is exempt from the unknown-flag exit 1\n' +
  '  because every hook failure exits 2.\n\n' +
  'doctor\n' +
  '  Twelve checks on THIS install: manifest, version drift, peers, presets, lint scan, AGENTS block,\n' +
  '  skills and rules, the hook (run from a subdirectory on a seeded offender), the formatter fence,\n' +
  '  token sheets, budgets and app wiring. Each is pass, fail or SKIPPED; SKIPPED exits non-zero.\n' +
  '  Every failure names the command that fixes it.\n\n' +
  'migrate --from <x.y.z> --profile <tokens|site|bridge|parts|app> [--json] [--check]\n' +
  "  The upgrade worklist: reads the app's imports and prints each migration row since --from that\n" +
  '  touches them (renames, removals, token and storage keys), with file:line. Writes nothing. --check\n' +
  '  exits 1 while a removed symbol is still imported; --json prints the report. Read MIGRATING.md beside it.\n\n' +
  'init --profile <tokens|site|bridge|parts|app> [--root <path>]… [--tokens-out <css>] [--tokens-json-out <json>]\n' +
  '     [--extra <file>] [--accent <#hex>] [--neutral <name>] [--vibrancy <n>] [--selector <sel>] [--no-install]\n' +
  '     [--start]\n' +
  '  The one door into an install. The profile is declared, never inferred (exit 1 without it); each --root\n' +
  '  (default .) is declared with it. Paths are relative to the repo root. Writes .basalt/manifest.json and the\n' +
  "  token outputs, installs the profile's peers at exact pins with the lockfile's package manager, places the\n" +
  '  managed files and presets through sync, seeds .basalt/budget.json and DESIGN.md, at app writes the router scaffold (main.tsx, routes, nav) once, writes the formatter\n' +
  '  ignore, and ends in doctor, then the session note when its run wrote agent-read files. --no-install prints the install command instead of running it. Running it\n' +
  '  twice changes nothing. Vite and CSS are patched only for a stock shape; otherwise the lines are printed.\n' +
  '  --start (with --profile app) makes the app a TanStack Start host: tanstackStart() before the React plugin,\n' +
  '  src/router.tsx (getRouter), a root route with the document shell and the pre-paint scheme script, no main.tsx.\n' +
  '  The app owns @tanstack/react-start; init installs nothing for it.\n' +
  '  A site (static pages on Astro) writes no router scaffold; it prints the basalt-ui/astro integration line.\n\n' +
  'sync [--check] [--force]\n' +
  '  Renders every managed file (.claude/{rules,skills,agents}/basalt-*, the AGENTS.md block, the\n' +
  '  preset files, the hook shim .basalt/hook.mjs and its entries in .claude/settings.json, every token\n' +
  '  sheet the manifest records) and compares bytes; it rewrites a ledger file of an older format; it refreshes an EXISTING install and never creates one (that\n' +
  '  is init). --check writes nothing and exits 1 on any difference. A managed file you edited is\n' +
  '  left and reported; --force overwrites it. A retired file is deleted if untouched, else left.\n' +
  '  An ejected primitive is three-way merged with the new seed (adopted: base advanced, file kept);\n' +
  '  a conflict leaves diff3 markers, advances the base and exits 1. An added block (add) is merged\n' +
  '  the same way, file by file.\n\n' +
  'doctor / sync / lint all resolve their project the same way: BASALT_CWD, else the\n' +
  'invocation cwd — nothing inferred, nothing descended into (sync alone looks UP for the manifest\n' +
  'that declares the directory).\n' +
  '\n' +
  'Every subcommand accepts --help / -h to print this message and exit without running; `eject --help` and `add --help`\n' +
  'print their own flags and exit codes.\n' +
  '--version / -v prints the resolved package version and exits 0 — the one command that proves\n' +
  'WHICH basalt-ui ran, which a `bunx` cache can otherwise make a lie. An unknown command or an\n' +
  'unrecognized flag exits 1 and names what it did not understand; neither is ever ignored.'
