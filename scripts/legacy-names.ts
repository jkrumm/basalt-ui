/**
 * The 2.x spellings v3 no longer carries, and the only places allowed to keep them (Issue 1703).
 *
 * `--vx-*` and the `VX` accessor were the visx/Mantine era's names; v3 owns its styling, so it owns its names
 * (`--basalt-*`, `BASALT`). Mantine is gone from the runtime. Two consumers read this module:
 *
 * - `scripts/rename-legacy.ts`, the re-runnable codemod, skips every path and line allowed here;
 * - `scripts/check-legacy-names.ts`, the gate in `make check` and CI, fails on any spelling outside it, in the
 *   source tree and in the packed tarball.
 *
 * An entry names its reason. History keeps its words (migration data, changelogs, filed briefs, spike runs);
 * everything a v3 reader or consumer sees does not.
 */

export type Kind = 'vx' | 'mantine'

export type Allow = {
  /** A repo-relative path: a directory when it ends in `/`, else one file. */
  path: string
  /** The spellings it may keep; both when absent. */
  kinds?: readonly Kind[]
  /** Only lines matching this; the whole file when absent. */
  line?: RegExp
  reason: string
}

/** Each finder matches one spelling; the gate reports a line when any of them hits. */
const FINDERS: Readonly<Record<Kind, readonly RegExp[]>> = {
  // `vx` opening a word in any case (`--vx-ink`, `.vx-prose`, `VX.ink`, `VxVar`, `REMOVED_VX_NAMES`), and `Vx`
  // inside a camel-case identifier (`collectVxNames`). Base64 runs such as `1YVxB` match neither.
  vx: [/(?:(?<![A-Za-z0-9])|(?<=\\[bBdDsSwW]))vx/i, /(?<=[a-z0-9])Vx(?![a-z])/],
  mantine: [/mantine/i],
}

const HISTORY = 'history: a record of what was, kept in its own words'

const ALLOWED: readonly Allow[] = [
  // The issue's own allowlist.
  { path: 'tools/migrate-v3/', reason: 'the 2.x -> 3.x consumer codemod reads the old names' },
  {
    path: 'packages/basalt-ui/migrations/',
    reason: 'migration rows name the 2.x spelling they map from',
  },
  {
    path: 'packages/basalt-ui/MIGRATING.md',
    reason: 'the migration guide names what it migrates from',
  },
  { path: 'packages/basalt-ui/CHANGELOG.md', reason: HISTORY },
  { path: 'docs/archive/', reason: HISTORY },
  { path: 'docs/waves/', reason: HISTORY },
  // Historical v3 records: filed briefs, cycle reports, evidence, spikes, panels and verdicts, as written then.
  ...[
    'docs/v3/issues/',
    'docs/v3/cycles/',
    'docs/v3/evidence/',
    'docs/v3/spikes/',
    'docs/v3/panel/',
    'docs/v3/verdicts/',
    'docs/v3/census/',
    'docs/v3/acceptance/',
    'docs/v3/inspo/',
    'docs/v3/BRIEF.md',
    'docs/v3/DISCOVERY-DIGEST.md',
    'docs/v3/PHASE-0.md',
    'docs/v3/PLAN-REVISION.md',
    'docs/v3/IMPLEMENTATION-PLAN.md',
    'docs/research/',
    'tools/spikes/',
  ].map((path) => ({ path, reason: HISTORY })),
  {
    path: 'apps/marketing/',
    reason: 'content-frozen 2.x site, rebuilt on v3 later (AGENTS.md Structure)',
  },
  { path: 'bun.lock', reason: 'integrity hashes, not names' },
  // The v3 design records argue the move off Mantine, so they name it; their token names are the new ones.
  ...['docs/v3/ARCHITECTURE.md', 'docs/v3/DIRECTION.md', 'docs/v3/concepts/'].map((path) => ({
    path,
    kinds: ['mantine'] as const,
    reason: 'the v3 rationale names the library v3 replaced',
  })),
  // The rename and its gate name what they rename and refuse.
  { path: 'scripts/legacy-names.ts', reason: 'this allowlist' },
  { path: 'scripts/rename-legacy.ts', reason: 'the codemod rewrites these spellings' },
  { path: 'scripts/rename-legacy.test.ts', reason: 'the codemod fixtures' },
  { path: 'scripts/check-legacy-names.ts', reason: 'the gate names what it refuses' },
  { path: 'scripts/check-legacy-names.test.ts', reason: 'the gate plants offenders' },
  // Lines that read what a 2.x tag carries, or ban a removed 2.x API by its name.
  {
    path: 'packages/basalt-ui/scripts/release-migrating.ts',
    kinds: ['vx'],
    line: /^ {2}'packages\/basalt-ui\/src\/(tokens|guard)\/vx-names\.ts',$/,
    reason: 'the name list at a 2.x tag lives at its 2.x path',
  },
  {
    path: 'packages/basalt-ui/scripts/check-agent-doc-drift.ts',
    kinds: ['vx'],
    line: /^ {2}(VxThemeProvider|useVxTheme): /,
    reason: 'the removed-API denylist bans the 1.x names as they were spelled',
  },
  // Detectors: a ban list, or a check that reports what a 2.x app still carries, has to name what it refuses.
  // Each holds in the source and in its compiled twin in `dist/`, and only on the detecting line.
  ...detector(
    'lint/rules/structure/import-boundary',
    /@mantine\b|["']mantine-[a-z-]+["']|Radix, Mantine,|Mantine React Table/,
    'the import ban list',
  ),
  ...detector('lint/stylelint/rules', /\.mantine-/, 'the stylelint selector ban'),
  ...detector(
    'cli/migrate/index',
    /data-mantine-color-scheme/,
    '`migrate --check` finds the 2.x scheme selector',
  ),
  ...detector('cli/migrate/census', /\(mantine-\|/, 'the migrate census finds 2.x storage keys'),
  ...detector(
    'cli/doctor/app',
    /data-mantine-color-scheme/,
    '`doctor` finds the 2.x scheme selector',
  ),
  ...detector(
    'cli/doctor/guards',
    /\/mantine\/i.*DESIGN\.md mentions Mantine/,
    '`doctor` finds a DESIGN.md on the 2.x stack',
  ),
  {
    path: 'packages/basalt-ui/configs/stylelint.basalt.json',
    kinds: ['mantine'],
    line: /\.mantine-/,
    reason: 'the stylelint selector ban, generated from src/lint/stylelint/rules.ts',
  },
  {
    path: 'apps/playground/.stylelintrc.basalt.json',
    kinds: ['mantine'],
    line: /\.mantine-/,
    reason: 'the same selector ban, as `basalt-ui sync` renders it into the playground install',
  },
  {
    path: 'apps/expression/.stylelintrc.basalt.json',
    kinds: ['mantine'],
    line: /\.mantine-/,
    reason: 'the same selector ban, as `basalt-ui sync` renders it into the expression install',
  },
  // The detectors' offender fixtures and the tests that plant them.
  ...[
    'packages/basalt-ui/test/fixtures/lint/import-bypass/',
    'packages/basalt-ui/test/fixtures/lint/stylelint/offenders/mantine-class.css',
    'packages/basalt-ui/src/lint/stylelint/stylelint.test.ts',
    'packages/basalt-ui/src/cli/doctor/app.test.ts',
    'packages/basalt-ui/src/cli/doctor/guards.test.ts',
    'packages/basalt-ui/tests/agent/sk-7.test.ts',
    'packages/basalt-ui/tests/cli/migrate/migrate.test.ts',
  ].map((path) => ({ path, kinds: ['mantine'] as const, reason: 'a detector offender fixture' })),
  // Artifact guards: the packed tarball must not reach the 2.x stack.
  ...[
    'packages/basalt-ui/scripts/check-dist-layering.mjs',
    'packages/basalt-ui/scripts/pack-test.sh',
  ].map((path) => ({
    path,
    kinds: ['mantine'] as const,
    reason: 'a pack-test guard refuses a 2.x import in the artifact',
  })),
  {
    path: 'packages/basalt-ui/scripts/migrating-ui-rows.test.ts',
    kinds: ['mantine'],
    reason: 'the 2.x symbol census the ui migration rows must cover',
  },
  // The 2.x layout oracle (`LAYOUT_TARGET=v2`) measures the 2.x DOM by its own class names.
  ...[
    'packages/basalt-ui/tests/layout/shell-slots.ts',
    'packages/basalt-ui/tests/layout/shell-target.ts',
  ].map((path) => ({
    path,
    kinds: ['mantine'] as const,
    reason: 'the 2.x layout oracle selectors',
  })),
]

/** A detector's source module and its compiled twins, line-scoped. */
function detector(module: string, line: RegExp, reason: string): Allow[] {
  return [`src/${module}.ts`, `dist/${module}.js`, `dist/${module}.d.ts`].map((rel) => ({
    path: `packages/basalt-ui/${rel}`,
    kinds: ['mantine'],
    line,
    reason,
  }))
}

const toPosix = (path: string): string => path.split('\\').join('/')

/** The entries that let `path` keep `kind`; empty when none do. */
function allowsFor(path: string, kind: Kind): Allow[] {
  const p = toPosix(path)
  return ALLOWED.filter(
    (a) =>
      (a.path.endsWith('/') ? p.startsWith(a.path) : p === a.path) &&
      (a.kinds === undefined || a.kinds.includes(kind)),
  )
}

/** Whether a whole file may keep `kind` (an entry with no `line`). */
export function fileAllows(path: string, kind: Kind): boolean {
  return allowsFor(path, kind).some((a) => a.line === undefined)
}

/** Whether one line of `path` may keep `kind`. */
export function lineAllows(path: string, kind: Kind, text: string): boolean {
  return allowsFor(path, kind).some((a) => a.line === undefined || a.line.test(text))
}

/** The kinds `text` spells, in FINDERS order. */
export function spelled(text: string): Kind[] {
  return (Object.keys(FINDERS) as Kind[]).filter((k) => FINDERS[k].some((re) => re.test(text)))
}
