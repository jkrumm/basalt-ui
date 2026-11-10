/**
 * Spike harness: does the bought `shadcn/no-restyle` (@shadcn/lint 0.2.5, oxlint 1.93.0) fire on
 * `import { Button } from 'basalt-ui/ui/button'` carrying a `className` restyle?
 *
 * Three scratch projects are built in the OS temp dir and linted with the spike's own oxlint:
 *   npmSpecifier  the specifier resolves through a node_modules copy of the stub package
 *   pathsEject    no node_modules; tsconfig `paths` maps the specifier to a local file
 *   valid         a permitted className; no-restyle must stay silent
 *   unmatchedSpecifier  negative control: the same restyle imported from a specifier componentImports does not name
 * `positiveControl` is `typescript/no-explicit-any` seeded in all three files: when it is silent
 * the run proves nothing, so the script exits 1 without a verdict.
 *
 * `--ui` adds the fix probe `settings.shadcn.ui` to the same three runs and reports it under `ui`.
 * Exit 0 means the harness ran, not that the hypothesis held.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type Outcome = 'fired' | 'silent'
type Scenario = 'npmSpecifier' | 'pathsEject' | 'valid' | 'unmatchedSpecifier'

type Label = { span: { line: number; column: number } }
type Diagnostic = { message: string; code: string; filename: string; labels?: Label[] }

const SPIKE = import.meta.dirname
const OXLINT = join(SPIKE, 'node_modules/.bin/oxlint')
const PLUGIN = join(SPIKE, 'node_modules/@shadcn/lint/dist/index.js')
const DENY_MESSAGE = 'Button owns its height and fill: use a variant.'

const fixture = (name: string): string =>
  readFileSync(join(SPIKE, 'fixtures', `${name}.fixture.txt`), 'utf8')

const pkgVersion = (name: string): string =>
  (
    JSON.parse(readFileSync(join(SPIKE, 'node_modules', name, 'package.json'), 'utf8')) as {
      version: string
    }
  ).version

type Options = { withUiSetting: boolean }

function config(options: Options): object {
  const shadcn: Record<string, unknown> = options.withUiSetting ? { ui: ['basalt-ui/ui'] } : {}
  return {
    plugins: ['typescript', 'react'],
    jsPlugins: [PLUGIN],
    settings: { shadcn },
    rules: {
      'typescript/no-explicit-any': 'error',
      'shadcn/no-restyle': [
        'error',
        {
          componentImports: ['^basalt-ui/ui/'],
          allow: ['layout'],
          contracts: [
            {
              pattern: '^Button$',
              allow: ['w-full'],
              deny: ['h-*', 'bg-*'],
              message: DENY_MESSAGE,
            },
          ],
        },
      ],
    },
  }
}

function build(root: string, scenario: Scenario): string {
  mkdirSync(join(root, 'src'), { recursive: true })
  const file = join(root, 'src', 'page.tsx')
  const source = fixture(scenario === 'valid' ? 'valid' : 'restyle')
  // The negative control: same restyle, a specifier that componentImports does not name.
  writeFileSync(
    file,
    scenario === 'unmatchedSpecifier'
      ? source.replace('basalt-ui/ui/button', 'other-lib/ui/button')
      : source,
  )
  writeFileSync(
    join(root, 'package.json'),
    '{ "name": "scratch-app", "private": true, "type": "module" }\n',
  )
  if (scenario === 'pathsEject' || scenario === 'valid') {
    // `valid` shares the paths layout so a pass cannot come from an unresolved import being ignored.
    mkdirSync(join(root, 'src/components/ui'), { recursive: true })
    writeFileSync(join(root, 'src/components/ui/button.tsx'), fixture('button-local'))
    writeFileSync(join(root, 'tsconfig.json'), fixture('tsconfig'))
  }
  if (scenario === 'npmSpecifier')
    symlinkSync(join(SPIKE, 'node_modules'), join(root, 'node_modules'), 'dir')
  return file
}

function lint(
  root: string,
  file: string,
  options: Options,
): { diagnostics: Diagnostic[]; stderr: string } {
  const configPath = join(root, '.oxlintrc.json')
  writeFileSync(configPath, JSON.stringify(config(options), null, 2))
  const run = spawnSync(OXLINT, ['-c', configPath, '--format', 'json', file], {
    cwd: root,
    encoding: 'utf8',
  })
  const parsed = JSON.parse(run.stdout || '{"diagnostics":[]}') as { diagnostics: Diagnostic[] }
  return { diagnostics: parsed.diagnostics, stderr: run.stderr.trim() }
}

type Measured = {
  restyle: Outcome
  control: Outcome
  deny: string[]
  diagnostics: string[]
  stderr: string
}

function measure(scenario: Scenario, options: Options): Measured {
  const root = mkdtempSync(join(tmpdir(), `no-restyle-${scenario}-`))
  try {
    const file = build(root, scenario)
    const { diagnostics, stderr } = lint(root, file, options)
    const restyle = diagnostics.filter((d) => d.code.includes('no-restyle'))
    const control = diagnostics.filter((d) => d.code.includes('no-explicit-any'))
    return {
      restyle: restyle.length ? 'fired' : 'silent',
      control: control.length ? 'fired' : 'silent',
      deny: restyle.map(
        (d) => `${d.labels?.[0]?.span.line ?? 0}:${d.labels?.[0]?.span.column ?? 0} ${d.message}`,
      ),
      diagnostics: diagnostics.map((d) => d.code),
      stderr,
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const scenarios: Scenario[] = ['npmSpecifier', 'pathsEject', 'valid', 'unmatchedSpecifier']
const base = Object.fromEntries(
  scenarios.map((s) => [s, measure(s, { withUiSetting: false })]),
) as Record<Scenario, Measured>
const withUi = Object.fromEntries(
  scenarios.map((s) => [s, measure(s, { withUiSetting: true })]),
) as Record<Scenario, Measured>

const positiveControl: Outcome = scenarios.every((s) => base[s].control === 'fired')
  ? 'fired'
  : 'silent'
const holds = (m: Record<Scenario, Measured>): boolean =>
  m.npmSpecifier.restyle === 'fired' &&
  m.pathsEject.restyle === 'fired' &&
  m.valid.restyle === 'silent'

const result = {
  tool: { '@shadcn/lint': pkgVersion('@shadcn/lint'), oxlint: pkgVersion('oxlint') },
  npmSpecifier: base.npmSpecifier.restyle,
  pathsEject: base.pathsEject.restyle,
  valid: base.valid.restyle,
  unmatchedSpecifier: base.unmatchedSpecifier.restyle,
  positiveControl,
  deny: {
    npmSpecifier: base.npmSpecifier.deny,
    pathsEject: base.pathsEject.deny,
    valid: base.valid.deny,
  },
  diagnostics: Object.fromEntries(scenarios.map((s) => [s, base[s].diagnostics])),
  stderr: Object.fromEntries(scenarios.map((s) => [s, base[s].stderr])),
  settingsUi: {
    npmSpecifier: withUi.npmSpecifier.restyle,
    pathsEject: withUi.pathsEject.restyle,
    valid: withUi.valid.restyle,
    unmatchedSpecifier: withUi.unmatchedSpecifier.restyle,
    deny: { npmSpecifier: withUi.npmSpecifier.deny, pathsEject: withUi.pathsEject.deny },
  },
  verdict: positiveControl === 'silent' ? 'void' : holds(base) ? 'pass' : 'refuted',
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
process.exit(positiveControl === 'silent' ? 1 : 0)
