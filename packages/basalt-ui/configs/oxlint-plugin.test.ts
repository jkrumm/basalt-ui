/**
 * Integration tests for the shipped `basalt` oxlint JS plugin (`oxlint-plugin.js`) — exercises the
 * real oxlint binary against small fixture files, the same way a consumer's lint run would.
 *
 * Each fixture repo gets a minimal `.oxlintrc.json` pointing `jsPlugins` at the plugin (absolute
 * path — verified to resolve the same as the relative path the shipped/repo configs use) and
 * enabling every rule this file tests. `run` shells the workspace-root `node_modules/.bin/oxlint`
 * binary and returns the parsed set of `basalt/<rule>` diagnostics it printed.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
// eslint-disable-next-line -- the plugin is plain JS; the ledger + id set are named exports beside it
import basaltPlugin, {
  CTL_THEME_TAGS,
  WAIVER_ID_ALIASES,
  KNOWN_RULE_IDS,
  CHART_ENGINE_ALLOWED_PREFIXES,
  CHART_ENGINE_ALLOWED_SUBPATHS,
  isAllowedChartEngineSubpath,
  PLUGIN_RULE_GRACE,
  RAW_BREAKPOINT_RECIPE,
  RETIRED_RULE_IDS,
} from './oxlint-plugin.js'
import { CTL_THEME } from '../src/theme/ctl-theme'
import {
  GRACE_PERIOD_KINDS,
  GUARD_RULES,
  PLUGIN_RULE_IDS,
  WAIVER_ID_ALIASES as GUARD_WAIVER_ID_ALIASES,
} from '../src/guard/index.ts'
import { PLUGIN_RULE_ID_LIST, SURFACES } from '../src/surfaces.ts'
import { CONTAINER_CLASSES } from '../src/tokens/size-classes.ts'

const PLUGIN_PATH = resolve(import.meta.dirname, 'oxlint-plugin.js')
const OXLINT_BIN = resolve(import.meta.dirname, '..', '..', '..', 'node_modules', '.bin', 'oxlint')

let dir: string

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-oxlint-plugin-'))
  writeFileSync(
    resolve(dir, '.oxlintrc.json'),
    JSON.stringify({
      plugins: [],
      jsPlugins: [PLUGIN_PATH],
      rules: {
        'basalt/query-fn-unwrap': 'error',
        'basalt/forms-field-key': 'error',
        'basalt/no-raw-font-size': 'error',
        'basalt/raw-size-literal': 'error',
        'basalt/card-inset': 'error',
        'basalt/chart-in-raw-surface': 'error',
        'basalt/shadow-basalt-export': 'error',
        'basalt/hand-rolled-shell': 'error',
        'basalt/raw-scroll-container': 'error',
        'basalt/hand-rolled-filter': 'error',
        'basalt/control-outside-home': 'error',
        'basalt/bound-control-outside-home': 'error',
        'basalt/control-size-literal': 'error',
        'basalt/in-body-page-title': 'error',
        'basalt/responsive-twin': 'error',
        'basalt/search-literal-link': 'error',
        'basalt/use-search-from-literal': 'error',
        'basalt/chart-engine-boundary': 'error',
        'basalt/chart-host-single': 'error',
        'basalt/token-layer-boundary': 'error',
        'basalt/agent-no-raw-usechat': 'error',
        'basalt/ai-sdk-major': 'error',
        'basalt/raw-breakpoint': 'error',
        'basalt/no-dev-helper': 'error',
        'basalt/route-view-transition': 'error',
      },
    }),
  )
  // `shadow-basalt-export` and `ai-sdk-major` both scope through `isBasaltScopedFile`, so a fixture
  // repo with NO manifest is out of scope for both and every other assertion here would pass
  // vacuously. Written per-test by the `ai-sdk-major` block, which needs its own `ai` pin.
  writeFileSync(
    resolve(dir, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0', dependencies: { 'basalt-ui': '^1.21.0' } }),
  )
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Writes `source` as the sole fixture file and runs oxlint against the temp fixture repo. */
function run(
  source: string,
  filename = 'fixture.tsx',
): { code: number; rules: Set<string>; output: string } {
  const filePath = resolve(dir, filename)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, source)
  const result = Bun.spawnSync([OXLINT_BIN, '-c', '.oxlintrc.json', filename], { cwd: dir })
  const output = `${result.stdout}${result.stderr}`
  // A plugin that fails to load must fail the run, not read as "no findings" — otherwise every
  // `not.toContain` below is false-green.
  if (/Failed to (?:load JS plugin|parse oxlint configuration)/.test(output))
    throw new Error(`oxlint could not load the basalt plugin:\n${output}`)
  const rules = new Set(
    [...output.matchAll(/\(basalt\/([\w-]+)\)/g)].map((match) => match[1] as string),
  )
  return { code: result.exitCode ?? 0, rules, output }
}

// The sentinel: one fixture every working plugin reports. If it does not, the plugin is not loaded
// (or not registered under `basalt/`) and nothing else in this file means anything.
beforeAll(() => {
  const sentinelDir = mkdtempSync(resolve(tmpdir(), 'basalt-oxlint-sentinel-'))
  try {
    writeFileSync(
      resolve(sentinelDir, '.oxlintrc.json'),
      JSON.stringify({ jsPlugins: [PLUGIN_PATH], rules: { 'basalt/no-raw-font-size': 'error' } }),
    )
    writeFileSync(resolve(sentinelDir, 'sentinel.tsx'), 'export const C = () => <Text fz={10} />\n')
    const result = Bun.spawnSync([OXLINT_BIN, '-c', '.oxlintrc.json', 'sentinel.tsx'], {
      cwd: sentinelDir,
    })
    const output = `${result.stdout}${result.stderr}`
    if (!output.includes('(basalt/no-raw-font-size)'))
      throw new Error(`basalt oxlint plugin did not load — sentinel rule never fired:\n${output}`)
  } finally {
    rmSync(sentinelDir, { recursive: true, force: true })
  }
})

// ── no-raw-font-size ─────────────────────────────────────────────────────────

describe('basalt/no-raw-font-size', () => {
  it('flags a numeric fz JSX attribute', () => {
    const { code, rules } = run(`export const C = () => <Text fz={10}>a</Text>\n`)
    expect(code).toBe(1)
    expect(rules).toContain('no-raw-font-size')
  })

  it('does NOT flag a string fz token', () => {
    const { code, rules } = run(`export const C = () => <Text fz="md">a</Text>\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('no-raw-font-size')
  })

  it('does NOT flag a numeric fontSize with a same-line theme-allow comment', () => {
    const { code, rules } = run(
      `export const C = () => <Text fz={10} /* theme-allow: legacy */>a</Text>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('no-raw-font-size')
  })

  // F25: symmetric with raw-size-literal's own test-file skip below — the doctrine is about
  // shipped UI, not fixtures.
  it('does NOT flag a numeric fz inside a *.test.tsx file', () => {
    const { code, rules } = run(`export const C = () => <Text fz={10}>a</Text>\n`, 'lib.test.tsx')
    expect(code).toBe(0)
    expect(rules).not.toContain('no-raw-font-size')
  })
})

// ── raw-size-literal ─────────────────────────────────────────────────────────

describe('basalt/raw-size-literal', () => {
  it('flags a CSS-length string on size', () => {
    const { code, rules } = run(`export const C = () => <ThemeIcon size="2rem" />\n`)
    expect(code).toBe(1)
    expect(rules).toContain('raw-size-literal')
  })

  it('flags a CSS-length string on fz', () => {
    const { code, rules } = run(`export const C = () => <Text fz="0.8rem">a</Text>\n`)
    expect(code).toBe(1)
    expect(rules).toContain('raw-size-literal')
  })

  it('does NOT flag a scale token on size', () => {
    const { code, rules } = run(`export const C = () => <ThemeIcon size="md" />\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('raw-size-literal')
  })

  it('does NOT flag a numeric size (the documented icon-dimension idiom)', () => {
    const { code, rules } = run(`export const C = () => <ThemeIcon size={32} />\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('raw-size-literal')
  })

  it('does NOT flag with a same-line theme-allow comment', () => {
    const { code, rules } = run(
      `export const C = () => <Text fz="0.8rem" /* theme-allow: legacy */>a</Text>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('raw-size-literal')
  })

  // F25: was the asymmetric half — no-raw-font-size already skipped test files, this rule did not.
  it('does NOT flag a CSS-length string inside a *.test.tsx file', () => {
    const { code, rules } = run(
      `export const C = () => <Text fz="0.8rem">a</Text>\n`,
      'lib.test.tsx',
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('raw-size-literal')
  })

  // A3: the /src/tokens/ exemption used to be a bare path-substring check, then a check gated on
  // `isBasaltScopedFile` — but that predicate tests "does the nearest package.json depend on
  // basalt-ui", not "is this file basalt's own", so a CONSUMER package that merely depends on
  // basalt-ui could still put raw literals under its own `src/tokens/` and silence the rule. The
  // exemption is deleted outright rather than re-gated on package identity: both rules only ever
  // visit JSX, and basalt's real `src/tokens/**` is pure `.ts` data with none, so no gate was ever
  // load-bearing there. A `src/tokens/` path — basalt's own or a consumer's — now always fires.
  it('DOES flag a CSS-length string inside a src/tokens/ file (no path exemption)', () => {
    const { code, rules } = run(
      `export const C = () => <ThemeIcon size="2rem" />\n`,
      'src/tokens/palette.tsx',
    )
    expect(code).toBe(1)
    expect(rules).toContain('raw-size-literal')
  })
})

// ── card-inset ───────────────────────────────────────────────────────────────

describe('basalt/card-inset', () => {
  it('flags an off-idiom padding value on Card', () => {
    const { code, rules } = run(`export const C = () => <Card p="md" />\n`)
    expect(code).toBe(1)
    expect(rules).toContain('card-inset')
  })

  it('does NOT flag the xs/sm inset idiom on Paper', () => {
    const { code, rules } = run(`export const C = () => <Paper py="xs" px="sm" />\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('card-inset')
  })
})

// ── chart-in-raw-surface ──────────────────────────────────────────────────────

describe('basalt/chart-in-raw-surface', () => {
  it('flags a chart-kind element inside a raw Card', () => {
    const { code, rules } = run(`export const C = () => <Card><Lines data={[]} /></Card>\n`)
    expect(code).toBe(1)
    expect(rules).toContain('chart-in-raw-surface')
  })

  it('does NOT flag a chart passed as a prop value (not a Card/Paper subtree)', () => {
    const { code, rules } = run(
      `export const C = () => <Card><StatCard sparkline={<Sparkline />} /></Card>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('chart-in-raw-surface')
  })
})

// ── chart-engine-boundary ────────────────────────────────────────────────────

describe('basalt/chart-engine-boundary', () => {
  it.each([
    ['@visx/scale', `import { scaleLinear } from '@visx/scale'\n`],
    ['@visx/tooltip', `import { Tooltip } from '@visx/tooltip'\n`],
    ['a source-bearing named re-export', `export { scaleLinear } from '@visx/scale'\n`],
    ['a wildcard re-export', `export * from '@visx/scale'\n`],
    ['a dynamic import', `export const load = () => import('@visx/shape')\n`],
  ])('bans %s outside basalt', (_label, source) => {
    const { code, rules } = run(source, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('chart-engine-boundary')
  })

  it('bans @visx/* inside basalt source and a charts/ directory too', () => {
    for (const file of ['charts/lib.tsx', 'packages/basalt-ui/src/charts/lib.tsx']) {
      const { code, rules } = run(`import { Bar } from '@visx/shape'\n`, file)
      expect([file, code]).toEqual([file, 1])
      expect(rules).toContain('chart-engine-boundary')
    }
  })

  it('still bans @visx/* under a theme-allow comment (no escape hatch)', () => {
    const { rules } = run(
      `// theme-allow chart-engine-boundary — legacy\nimport { scaleLinear } from '@visx/scale'\n`,
      'lib.ts',
    )
    expect(rules).toContain('chart-engine-boundary')
  })

  it.each([
    '@tanstack/charts/line',
    '@tanstack/charts/area-x',
    '@tanstack/charts/mark/decorative',
    '@tanstack/charts/d3/shape',
    '@tanstack/charts/scales/linear',
    '@tanstack/charts/transform/bin',
    '@tanstack/charts/types',
  ])('allows %s outside basalt', (specifier) => {
    const { code, rules } = run(`import * as m from '${specifier}'\nexport { m }\n`, 'lib.ts')
    expect([specifier, code]).toEqual([specifier, 0])
    expect(rules).not.toContain('chart-engine-boundary')
  })

  it.each([
    '@tanstack/charts',
    '@tanstack/charts/react',
    '@tanstack/charts/react/tooltip',
    '@tanstack/charts/svg',
    '@tanstack/charts/mark/composite',
    '@tanstack/charts/transform',
    '@tanstack/charts/scales/',
    '@tanstack/charts/line/extra',
  ])('bans %s outside basalt and names the allowed alternative', (specifier) => {
    const { code, rules, output } = run(
      `import * as m from '${specifier}'\nexport { m }\n`,
      'lib.ts',
    )
    expect([specifier, code]).toEqual([specifier, 1])
    expect(rules).toContain('chart-engine-boundary')
    expect(output).toContain('basalt-ui/charts')
  })

  it.each([
    "const m = require('@visx/scale')\n",
    "const m = require('@tanstack/charts')\n",
    "const m = require('@tanstack/charts/react')\n",
    "const m = require('@tanstack/charts/scales/../react')\n",
  ])('bans a literal require: %s', (source) => {
    const { code, rules } = run(`${source}export { m }\n`, 'lib.ts')
    expect([source, code]).toEqual([source, 1])
    expect(rules).toContain('chart-engine-boundary')
  })

  it('allows a literal require of an allowed subpath and ignores computed ones', () => {
    const { code } = run(
      `const a = require('@tanstack/charts/line')\nconst b = require(name)\nexport { a, b }\n`,
      'lib.ts',
    )
    expect(code).toBe(0)
  })

  it('bans a traversal out of an allowed family', () => {
    const { rules } = run(
      `import * as m from '@tanstack/charts/scales/../react'\nexport { m }\n`,
      'lib.ts',
    )
    expect(rules).toContain('chart-engine-boundary')
  })

  it('bans a re-export of the bare root outside basalt', () => {
    const { rules } = run(`export { defineChart } from '@tanstack/charts'\n`, 'lib.ts')
    expect(rules).toContain('chart-engine-boundary')
  })

  it('does NOT apply the allowlist inside basalt source', () => {
    const { code, rules } = run(
      `import { ChartRuntime } from '@tanstack/charts/react'\nexport { ChartRuntime }\n`,
      'packages/basalt-ui/src/charts/host.tsx',
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('chart-engine-boundary')
  })

  it('does not touch unrelated @tanstack packages', () => {
    const { code } = run(
      `import { useQuery } from '@tanstack/react-query'\nexport { useQuery }\n`,
      'lib.ts',
    )
    expect(code).toBe(0)
  })
})

describe('isAllowedChartEngineSubpath', () => {
  it.each([...CHART_ENGINE_ALLOWED_SUBPATHS, 'scales/linear', 'transform/bin-time'])(
    'allows %s',
    (subpath) => expect(isAllowedChartEngineSubpath(subpath)).toBe(true),
  )

  it.each([
    '',
    'scales',
    'scales/',
    'transform',
    'transform/',
    'react',
    'line/extra',
    'scales/../react',
    'scales/./linear',
    'scales//linear',
    '../line',
    'line/..',
  ])('rejects %j', (subpath) => expect(isAllowedChartEngineSubpath(subpath)).toBe(false))
})

// ── chart-host-single ────────────────────────────────────────────────────────

describe('basalt/chart-host-single', () => {
  const REACT_IMPORT = `import { Chart } from '@tanstack/charts/react'\nexport { Chart }\n`

  it('allows @tanstack/charts/react in packages/basalt-ui/src/charts/host.tsx', () => {
    const { rules } = run(REACT_IMPORT, 'packages/basalt-ui/src/charts/host.tsx')
    expect(rules).not.toContain('chart-host-single')
  })

  it.each([
    'packages/basalt-ui/src/charts/kinds/lines.tsx',
    'packages/basalt-ui/src/charts/host.ts',
    'packages/basalt-ui/src/chart.tsx',
  ])('flags it in %s', (file) => {
    const { code, rules } = run(REACT_IMPORT, file)
    expect([file, code]).toEqual([file, 1])
    expect(rules).toContain('chart-host-single')
  })

  it('stays silent outside basalt source — chart-engine-boundary owns that one diagnostic', () => {
    for (const file of ['apps/playground/src/chart.tsx', 'host.tsx']) {
      const { rules } = run(REACT_IMPORT, file)
      expect([file, rules.has('chart-host-single')]).toEqual([file, false])
    }
  })

  it('is not waived by theme-allow', () => {
    const { rules } = run(
      `// theme-allow chart-host-single — just this once\n${REACT_IMPORT}`,
      'packages/basalt-ui/src/charts/kinds/lines.tsx',
    )
    expect(rules).toContain('chart-host-single')
  })

  it('flags require() of the react entry', () => {
    const { rules } = run(
      `const { Chart } = require('@tanstack/charts/react')\nexport { Chart }\n`,
      'packages/basalt-ui/src/charts/a.ts',
    )
    expect(rules).toContain('chart-host-single')
  })

  it('flags the react sub-entries and a dynamic import too', () => {
    expect(
      run(
        `import 'x'\nexport * from '@tanstack/charts/react/tooltip'\n`,
        'packages/basalt-ui/src/a.ts',
      ).rules,
    ).toContain('chart-host-single')
    expect(
      run(
        `export const l = () => import('@tanstack/charts/react')\n`,
        'packages/basalt-ui/src/b.ts',
      ).rules,
    ).toContain('chart-host-single')
  })

  it('leaves the mark subpaths alone', () => {
    const { rules } = run(`import { line } from '@tanstack/charts/line'\nexport { line }\n`, 'a.ts')
    expect(rules).not.toContain('chart-host-single')
  })
})

// ── chart-engine-boundary ↔ the engine's `exports` (V2-SPEC § 9.8) ──────────────────────────────

/**
 * Every `@tanstack/charts` subpath that is deliberately NOT importable outside basalt, classified
 * against 1.1.0's `exports` ('' is the bare root). A new engine subpath is in neither this list nor
 * the allowlist, so the test below fails until someone decides which it is.
 */
const BANNED_ENGINE_SUBPATHS: readonly string[] = [
  '',
  'adapter',
  'adapter/renderer',
  'alpine',
  'angular',
  'band',
  'box',
  'canvas',
  'crosshair',
  'cursor',
  'cursor/host',
  'd3/area-x',
  'dodge',
  'dom',
  'export',
  'facet',
  'focus',
  'focus/disabled',
  'focus/guide',
  'focus/mark',
  'frame',
  'geo',
  'group',
  'hexagon',
  'hierarchy/sunburst',
  'hierarchy/tree',
  'hierarchy/treemap',
  'interaction/brush',
  'interaction/cursor',
  'interaction/handle',
  'interaction/signal',
  'interaction/zoom',
  'legend',
  'lit',
  'mark/composite',
  'mark/scale-values',
  'motion',
  'motion/definition',
  'network/force',
  'network/sankey',
  'octane',
  'octane/canvas',
  'octane/core',
  'polar',
  'preact',
  'react',
  'react-native',
  'react-native/tooltip',
  'react/canvas',
  'react/core',
  'react/tooltip',
  'reconcile',
  'regression',
  'renderer',
  'renderer/rect',
  'ridgeline',
  'runtime',
  'scene',
  'selection',
  'solid',
  'spatial/contour',
  'spatial/delaunay',
  'spatial/density',
  'spatial/hexbin',
  'spatial/voronoi',
  'spring',
  'svelte',
  'svg',
  'svg/renderer',
  'svg/resources',
  'tooltip',
  'tooltip/model',
  'tooltip/portal',
  'transform',
  'types/core',
  'universal',
  'view',
  'violin',
  'vue',
  'waffle',
]

// The package that declares the peer: bun's isolated linker installs it there, never at the root.
const ENGINE_PACKAGE_JSON = resolve(
  import.meta.dirname,
  '..',
  'node_modules',
  '@tanstack',
  'charts',
  'package.json',
)

describe('chart-engine-boundary ↔ @tanstack/charts exports', () => {
  const exportKeys = (): string[] => {
    const manifest = JSON.parse(readFileSync(ENGINE_PACKAGE_JSON, 'utf8')) as {
      exports: Record<string, unknown>
    }
    return Object.keys(manifest.exports).map((key) => (key === '.' ? '' : key.replace(/^\.\//, '')))
  }

  it('every exact allowlisted subpath exists in the engine', () => {
    const exports = new Set(exportKeys())
    for (const subpath of CHART_ENGINE_ALLOWED_SUBPATHS) {
      expect([subpath, exports.has(subpath)]).toEqual([subpath, true])
    }
  })

  it('every allowlisted family matches at least one engine subpath', () => {
    for (const prefix of CHART_ENGINE_ALLOWED_PREFIXES) {
      expect([prefix, exportKeys().some((key) => key.startsWith(prefix))]).toEqual([prefix, true])
    }
  })

  it('every engine subpath is allowlisted or deliberately banned', () => {
    const unclassified = exportKeys().filter(
      (key) => !isAllowedChartEngineSubpath(key) && !BANNED_ENGINE_SUBPATHS.includes(key),
    )
    expect(unclassified).toEqual([])
  })

  it('the banned list has no stale or allowlisted entries', () => {
    const exports = new Set(exportKeys())
    for (const subpath of BANNED_ENGINE_SUBPATHS) {
      expect([subpath, exports.has(subpath), isAllowedChartEngineSubpath(subpath)]).toEqual([
        subpath,
        true,
        false,
      ])
    }
  })
})

// ── token-layer-boundary ─────────────────────────────────────────────────────

describe('basalt/token-layer-boundary', () => {
  it('flags a @mantine/* import inside charts', () => {
    const { code, rules } = run(`import { Button } from '@mantine/core'\n`, 'charts/lib.tsx')
    expect(code).toBe(1)
    expect(rules).toContain('token-layer-boundary')
  })

  it('flags a @mantine/* import inside tokens', () => {
    const { code, rules } = run(`import { Button } from '@mantine/core'\n`, 'tokens/lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('token-layer-boundary')
  })

  it('does NOT flag a @mantine/* import outside charts/tokens', () => {
    const { code, rules } = run(`import { Button } from '@mantine/core'\n`, 'lib.tsx')
    expect(code).toBe(0)
    expect(rules).not.toContain('token-layer-boundary')
  })
})

// ── rule independence ──────────────────────────────────────────────────────────
// Each boundary rule has its own id, so disabling one leaves the others enforced.

describe('rule independence', () => {
  it('disabling basalt/chart-engine-boundary leaves basalt/chart-host-single enforced', () => {
    writeFileSync(
      resolve(dir, '.oxlintrc.json'),
      JSON.stringify({
        plugins: [],
        jsPlugins: [PLUGIN_PATH],
        rules: {
          'basalt/chart-engine-boundary': 'off',
          'basalt/chart-host-single': 'error',
          'basalt/token-layer-boundary': 'error',
        },
      }),
    )
    const { code, rules } = run(
      `import { scaleLinear } from '@visx/scale'\nimport { Chart } from '@tanstack/charts/react'\n`,
      'packages/basalt-ui/src/lib.ts',
    )
    expect(code).toBe(1)
    expect(rules).not.toContain('chart-engine-boundary')
    expect(rules).toContain('chart-host-single')
  })
})

// ── agent-no-raw-usechat ─────────────────────────────────────────────────────

describe('basalt/agent-no-raw-usechat', () => {
  it('flags importing useChat from @ai-sdk/react', () => {
    const { code, rules } = run(`import { useChat } from '@ai-sdk/react'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('agent-no-raw-usechat')
  })

  it('flags importing useCompletion from @ai-sdk/react', () => {
    const { code, rules } = run(`import { useCompletion } from '@ai-sdk/react'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('agent-no-raw-usechat')
  })

  it('does NOT flag a type-only import of UIMessage from the same module', () => {
    const { code, rules } = run(`import type { UIMessage } from '@ai-sdk/react'\n`, 'lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('agent-no-raw-usechat')
  })

  it('does NOT flag an unrelated import from ai', () => {
    const { code, rules } = run(`import { DefaultChatTransport } from 'ai'\n`, 'lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('agent-no-raw-usechat')
  })

  it('does NOT flag useChat imported from a local module', () => {
    const { code, rules } = run(`import { useChat } from './my-hooks'\n`, 'lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('agent-no-raw-usechat')
  })

  // The matcher covers TWO source specifiers (RAW_USE_CHAT_SOURCES: '@ai-sdk/react' AND
  // 'ai/react') — every fixture above only exercises '@ai-sdk/react'; this pins the other half.
  it("flags importing useChat from 'ai/react' (the other matched source)", () => {
    const { code, rules } = run(`import { useChat } from 'ai/react'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('agent-no-raw-usechat')
  })

  it('does NOT flag an import marked basalt-agent-allow', () => {
    const { code, rules } = run(
      `// basalt-agent-allow\nimport { useChat } from '@ai-sdk/react'\n`,
      'lib.ts',
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('agent-no-raw-usechat')
  })

  it('STILL flags an import marked only theme-allow (wrong escape token)', () => {
    const { code, rules } = run(
      `// theme-allow\nimport { useChat } from '@ai-sdk/react'\n`,
      'lib.ts',
    )
    expect(code).toBe(1)
    expect(rules).toContain('agent-no-raw-usechat')
  })
})

// ── ai-sdk-major ─────────────────────────────────────────────────────────────
// The lint rule compares the LINTED FILE's nearest package.json against basalt-ui's own declared
// `ai` peer major (read from packages/basalt-ui/package.json — the real file, since the plugin
// resolves it relative to its own module location regardless of where it's invoked from). basalt-ui
// declares "ai": "^7.0.15" (major 7) in both devDependencies and peerDependencies.

describe('basalt/ai-sdk-major', () => {
  it("flags when the nearest package.json declares a different ai major (5 vs basalt's 7)", () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({ dependencies: { 'basalt-ui': '^1.19.1', ai: '5.0.196' } }),
    )
    const { code, rules } = run(`import { streamText } from 'ai'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('ai-sdk-major')
  })

  it('does NOT flag when the nearest package.json declares the same major (^7.0.18)', () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({ dependencies: { 'basalt-ui': '^1.19.1', ai: '^7.0.18' } }),
    )
    const { code, rules } = run(`import { streamText } from 'ai'\n`, 'lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('ai-sdk-major')
  })

  it('does NOT flag when there is no ai in the nearest package.json', () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({ dependencies: { 'basalt-ui': '^1.19.1' } }),
    )
    const { code, rules } = run(`import { streamText } from 'ai'\n`, 'lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('ai-sdk-major')
  })

  it('does NOT flag an unrelated import even with a skewed nearest package.json', () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({ dependencies: { 'basalt-ui': '^1.19.1', ai: '5.0.196' } }),
    )
    const { code, rules } = run(`import { useState } from 'react'\n`, 'lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('ai-sdk-major')
  })

  // The matcher covers TWO forms (source === 'ai' OR source.startsWith('@ai-sdk/')) — every
  // fixture above only exercises the bare 'ai' specifier; this pins the scoped-package half.
  it("flags a scoped '@ai-sdk/*' import when the nearest package.json declares a different ai major", () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({ dependencies: { 'basalt-ui': '^1.19.1', ai: '5.0.196' } }),
    )
    const { code, rules } = run(`import { openai } from '@ai-sdk/openai'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('ai-sdk-major')
  })

  it("does NOT flag a scoped '@ai-sdk/*' import when the nearest package.json declares the same major", () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({ dependencies: { 'basalt-ui': '^1.19.1', ai: '^7.0.18' } }),
    )
    const { code, rules } = run(`import { openai } from '@ai-sdk/openai'\n`, 'lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('ai-sdk-major')
  })

  // Unlike the other rules in this file, ai-sdk-major honours `basalt-agent-allow` — the SAME
  // token as its agent-chat sibling above — not `theme-allow`. A skewed producer/consumer
  // import that is genuinely intentional (see doctor's `aiMajorSkewReason`) can mark the line.
  it('does NOT flag an import marked basalt-agent-allow, even with a skewed nearest package.json', () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({ dependencies: { 'basalt-ui': '^1.19.1', ai: '5.0.196' } }),
    )
    const { code, rules } = run(
      `// basalt-agent-allow\nimport { streamText } from 'ai'\n`,
      'lib.ts',
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('ai-sdk-major')
  })

  it('STILL flags an import marked only theme-allow (wrong escape token)', () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({ dependencies: { 'basalt-ui': '^1.19.1', ai: '5.0.196' } }),
    )
    const { code, rules } = run(`// theme-allow\nimport { streamText } from 'ai'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('ai-sdk-major')
  })

  // The scoping fix: a workspace package with no basalt-ui dependency is not a basalt consumer, so
  // its `ai` pin is none of this rule's business. rb's `apps/api` took 3 errors for exactly this,
  // while `doctor` — which scopes the same concern by workspace — reported green.
  it('does NOT flag a package that does not depend on basalt-ui at all', () => {
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ dependencies: { ai: '5.0.196' } }))
    const { code, rules } = run(`import { streamText } from 'ai'\n`, 'lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('ai-sdk-major')
  })

  it('does NOT flag a file outside a declared basalt.roots', () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({ basalt: { roots: ['web/src'] }, dependencies: { ai: '5.0.196' } }),
    )
    const { code, rules } = run(`import { streamText } from 'ai'\n`, 'api/src/llm.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('ai-sdk-major')
  })

  // The ORDERING half of the scoping fix, and the layout `init` produces for a monorepo: one
  // manifest carrying BOTH the workspace-root CLI devDependency and `basalt.roots` naming the app.
  // Dep-first returned in-scope on that root before `roots` was ever read, so rb's `apps/api` — no
  // basalt dependency, deliberately on a different `ai` major, explicitly outside the roots — kept
  // taking 3 errors and kept its `.oxlintrc.json` override.
  it('reads basalt.roots BEFORE the basalt-ui dependency in the same manifest', () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({
        basalt: { roots: ['apps/web/src'] },
        devDependencies: { 'basalt-ui': '^1.20.0' },
        dependencies: { ai: '5.0.196' },
      }),
    )
    const outside = run(`import { streamText } from 'ai'\n`, 'apps/api/src/llm.ts')
    expect(outside.code).toBe(0)
    expect(outside.rules).not.toContain('ai-sdk-major')

    // …and the declared root itself is still in scope, so the reorder narrows nothing it shouldn't.
    const inside = run(`import { streamText } from 'ai'\n`, 'apps/web/src/llm.ts')
    expect(inside.rules).toContain('ai-sdk-major')
  })

  it('DOES flag a file inside a declared basalt.roots', () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({ basalt: { roots: ['web/src'] }, dependencies: { ai: '5.0.196' } }),
    )
    const { code, rules } = run(`import { streamText } from 'ai'\n`, 'web/src/llm.ts')
    expect(code).toBe(1)
    expect(rules).toContain('ai-sdk-major')
  })
})

// ── raw-scroll-container — promotion (off → warn → error shipped) ───────────

describe('basalt/raw-scroll-container promotion', () => {
  it('ships "error" (not "warn"/"off") in the consumer preset', () => {
    const shipped = JSON.parse(
      readFileSync(resolve(import.meta.dirname, 'oxlint-basalt.json'), 'utf8'),
    ) as { rules: Record<string, unknown> }
    expect(shipped.rules['basalt/raw-scroll-container']).toBe('error')
  })

  it('stays at the shipped level ("error") repo-local', () => {
    const repoLocal = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '..', '..', '..', '.oxlintrc.json'), 'utf8'),
    ) as { rules: Record<string, unknown> }
    expect(repoLocal.rules['basalt/raw-scroll-container']).toBe('error')
  })

  it('still flags a raw overflow:auto style property at the shipped level', () => {
    writeFileSync(
      resolve(dir, '.oxlintrc.json'),
      JSON.stringify({
        plugins: [],
        jsPlugins: [PLUGIN_PATH],
        rules: { 'basalt/raw-scroll-container': 'warn' },
      }),
    )
    const { rules } = run(`const s = { overflowY: 'auto' }\n`, 'lib.ts')
    expect(rules).toContain('raw-scroll-container')
  })
})

// ── agent rules — promotion (warn → error shipped) ──────────────────────────
// The two agent-chat rules were promoted warn → error in the SHIPPED preset alongside
// raw-scroll-container above, but had no equivalent lock — `scripts/gen-oxlint.ts` only regenerates
// the `overrides` array; this top-level `rules` block is hand-maintained and
// `tests/oxlint-preset-sync.test.ts` only checks `overrides` against `projectBanList('shipped')`, so
// a later accidental revert of one of these back to "warn" would pass the suite silently.

describe('basalt agent rules promotion', () => {
  it.each(['basalt/agent-no-raw-usechat', 'basalt/ai-sdk-major'])(
    '%s ships "error" (not "warn"/"off") in the consumer preset',
    (rule) => {
      const shipped = JSON.parse(
        readFileSync(resolve(import.meta.dirname, 'oxlint-basalt.json'), 'utf8'),
      ) as { rules: Record<string, unknown> }
      expect(shipped.rules[rule]).toBe('error')
    },
  )

  it.each(['basalt/agent-no-raw-usechat', 'basalt/ai-sdk-major'])(
    '%s stays at the shipped level ("error") repo-local',
    (rule) => {
      const repoLocal = JSON.parse(
        readFileSync(resolve(import.meta.dirname, '..', '..', '..', '.oxlintrc.json'), 'utf8'),
      ) as { rules: Record<string, unknown> }
      expect(repoLocal.rules[rule]).toBe('error')
    },
  )
})

// ── theme-allow grammar — the accepted and rejected shapes, exhaustively ─────
//
// Two rounds produced three holes in this one contract, so it gets a matrix rather than a case.
// `card-inset` is the vehicle: a node-level rule honouring both scopes, so one fixture shape
// exercises the node waiver, the file declaration and the prefix rule at once.

describe('theme-allow grammar', () => {
  /** Two flagged nodes, with `annotation` placed as a comment-only line above the first. */
  function twoNodes(annotation: string): { code: number; rules: Set<string> } {
    return run(
      `export const C = () => (
  <div>
    ${annotation}
    <Card p="lg" />
    <Card p="lg" />
  </div>
)\n`,
    )
  }

  const waivesFirstNodeOnly = (annotation: string) => {
    const { rules } = twoNodes(annotation)
    expect([annotation, rules.has('card-inset')]).toEqual([annotation, true])
  }
  const waivesWholeFile = (annotation: string) => {
    const { rules } = twoNodes(annotation)
    expect([annotation, rules.has('card-inset')]).toEqual([annotation, false])
  }

  // ── ACCEPTED as a NODE waiver (the second node still reports) ──────────────

  it.each([
    '{/* theme-allow */}',
    '{/* theme-allow card-inset */}',
    '{/* theme-allow card-inset — a reason */}',
    '{/* theme-allow basalt/card-inset: a reason */}',
    '{/* theme-allow card-inset, raw-hex — two ids */}',
    '{/*theme-allow card-inset — no space after the opener*/}',
  ])('%s waives its own node and leaves the rest policed', waivesFirstNodeOnly)

  // ── ACCEPTED as a FILE declaration (nothing in the file reports) ───────────

  it.each([
    '{/* theme-allow-file card-inset — a reason */}',
    '{/* theme-allow-file basalt/card-inset: a reason */}',
    '{/* theme-allow-file card-inset */}',
    '{/* theme-allow-file card-inset, raw-hex — two ids */}',
  ])('%s declares the whole file', waivesWholeFile)

  it('a theme-allow-file inside a docblock, detached from any node, declares the file', () => {
    const { code, rules } = run(
      `/**
 * A bespoke shape.
 *
 * theme-allow-file card-inset — the inset is dictated by a third-party embed
 */
export const C = () => (
  <div>
    <Card p="lg" />
    <Card p="lg" />
  </div>
)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('card-inset')
  })

  // ── REJECTED — prose that merely MENTIONS the token (the linewatch defect) ─

  // The whole class: a file documenting its own waivers used to disarm itself. Every one of these
  // parsed as the bare blanket form under the old `indexOf('theme-allow')` and silenced the node
  // below it. All four are shapes taken from real consumer source.
  it.each([
    '{/* Since 1.20.0 a `theme-allow` that names a rule is a file declaration */}',
    '{/* see the theme-allow contract for how this file is waived */}',
    '{/* `theme-allow` with a reason declares the whole FILE wherever it is written */}',
    '{/* each with a theme-allow saying why */}',
  ])('%s is prose, not an annotation — it waives nothing', (annotation) => {
    const { code, rules } = twoNodes(annotation)
    expect([annotation, code]).toEqual([annotation, 1])
    expect([annotation, rules.has('card-inset')]).toEqual([annotation, true])
  })

  it('a prose docblock line mentioning theme-allow-file does not declare the file', () => {
    const { rules } = twoNodes(
      '{/* the shape to write here is a theme-allow-file card-inset — see the docs */}',
    )
    expect(rules).toContain('card-inset')
  })

  // ── REJECTED — a longer word that merely STARTS with the token ─────────────

  // `theme-allow-unscoped` is a KIND NAME, written in prose constantly. It used to consume no id,
  // fall through to the empty-`rules` branch, and read as a blanket waiver.
  it('a comment starting with the kind name `theme-allow-unscoped` is not an annotation', () => {
    const { rules } = twoNodes('{/* theme-allow-unscoped is what reports a bare waiver */}')
    expect(rules).toContain('card-inset')
  })

  // ── REJECTED — a bare file declaration, and a typo'd id ────────────────────

  it('a BARE theme-allow-file waives nothing — file scope must name its ids', () => {
    const { code, rules } = twoNodes('{/* theme-allow-file — everything in here is bespoke */}')
    expect(code).toBe(1)
    expect(rules).toContain('card-inset')
  })

  it("a theme-allow-file naming a typo'd id waives nothing", () => {
    const { rules } = twoNodes('{/* theme-allow-file card-insett — a reason */}')
    expect(rules).toContain('card-inset')
  })

  it('a theme-allow-file scoped to a DIFFERENT rule does not waive this one', () => {
    const { rules } = twoNodes('{/* theme-allow-file raw-hex — the swatch is a measured pixel */}')
    expect(rules).toContain('card-inset')
  })

  // ── REJECTED — the token inside a string literal, not a comment ────────────

  it('the token inside a string literal is code, not an annotation', () => {
    const { rules } = twoNodes("{'theme-allow card-inset — a reason'}")
    expect(rules).toContain('card-inset')
  })
})

// ── shadow-basalt-export ─────────────────────────────────────────────────────

describe('basalt/shadow-basalt-export', () => {
  it('flags a local component that collides with a basalt-ui root export', () => {
    const { code, rules } = run(`export function EmptyState() { return null }\n`)
    expect(code).toBe(1)
    expect(rules).toContain('shadow-basalt-export')
  })

  it('flags the arrow/const form too (rb shipped a local StatCard)', () => {
    const { code, rules } = run(`const StatCard = () => null\nexport default StatCard\n`)
    expect(code).toBe(1)
    expect(rules).toContain('shadow-basalt-export')
  })

  it('does NOT flag a name basalt does not export', () => {
    const { code, rules } = run(`export function ExerciseSummaryCard() { return null }\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('shadow-basalt-export')
  })

  // The rule read ONLY the root barrel, and `./charts` is deliberately not re-exported from it —
  // so a consumer whose forks all live in the chart layer, which is the layer forks actually live
  // in, could never trip it. Correctly silent, for the wrong reason.
  it('sees the charts layer, not just the root barrel', () => {
    const { code, rules } = run(`export function ChartCard() { return null }\n`)
    expect(code).toBe(1)
    expect(rules).toContain('shadow-basalt-export')
  })

  it('sees the content layer too', () => {
    const { rules } = run(`export function Callout() { return null }\n`)
    expect(rules).toContain('shadow-basalt-export')
  })

  // …but a barrel is not only basalt's own names. `./charts` re-exports `Bar`, `Line`, `Pie`,
  // `AreaClosed` … straight from `@visx/shape`, and a local `Bar` is not a fork of anything basalt
  // wrote. The playground's own demo tripped on it the moment the rule started reading that barrel.
  it('does NOT flag a name the barrel merely re-exports from a third party', () => {
    const { code, rules } = run(`export function Bar() { return null }\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('shadow-basalt-export')
  })

  // A NAME collision is the whole of the signal, so renaming defeats the rule in one keystroke —
  // linewatch's forks are `Cell` and `Box`, rb's is `Stat`, and all three are invisible here. That
  // limit cannot be closed without intent analysis, so the rule STATES it rather than implying
  // coverage it does not have.
  it('a renamed fork is invisible, and the message says so rather than implying coverage', () => {
    expect(run(`export function Stat() { return null }\n`).rules).not.toContain(
      'shadow-basalt-export',
    )
    const { output } = run(`export function EmptyState() { return null }\n`)
    expect(output).toContain('tripwire, not coverage')
    expect(output).toContain('Silence here is not evidence')
  })

  // The export list is derived from the real barrel, so a TYPE export must not create a collision:
  // a local `StatCardProps` is an ordinary thing for a consumer to declare.
  it('does NOT flag a name that basalt exports only as a type', () => {
    const { code, rules } = run(`export type StatCardProps = { label: string }\n`, 'types.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('shadow-basalt-export')
  })

  it('is waivable with a scoped theme-allow', () => {
    const { code, rules } = run(
      `// theme-allow basalt/shadow-basalt-export — domain-specific, unrelated to the shipped one\nexport function EmptyState() { return null }\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('shadow-basalt-export')
  })

  // The scoping fix, mirroring `ai-sdk-major`'s. obsidian's `packages/obsidian-vault-core` is
  // React-free, carries no basalt-ui dependency, and sits outside the root's declared
  // `basalt.roots` — so it CANNOT import the export it was told it had forked. The rule reported
  // `SlugTracker` there anyway, because it was the one rule in this file that never asked.
  it('does NOT flag a package that does not depend on basalt-ui at all', () => {
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'standalone' }))
    const { code, rules } = run(`export function EmptyState() { return null }\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('shadow-basalt-export')
  })

  it('does NOT flag a file outside a declared basalt.roots', () => {
    writeFileSync(
      resolve(dir, 'package.json'),
      JSON.stringify({
        basalt: { roots: ['packages/ui/src'] },
        devDependencies: { 'basalt-ui': '^1.21.0' },
      }),
    )
    expect(
      run(`export function EmptyState() { return null }\n`, 'packages/core/src/a.tsx').rules,
    ).not.toContain('shadow-basalt-export')
    // …and the declared root is still policed, so the narrowing costs no real coverage.
    expect(
      run(`export function EmptyState() { return null }\n`, 'packages/ui/src/a.tsx').rules,
    ).toContain('shadow-basalt-export')
  })

  // The second half: a PascalCase name is not a component. The nine-barrel widening pulled every
  // PascalCase value export into range, and a bare-PascalCase test then matched a plain data class
  // (obsidian's `SlugTracker` — the same NAME basalt's `./content` exports, and nothing else).
  it('does NOT flag a plain class that merely shares a name', () => {
    const { code, rules } = run(`export class SlugTracker {}\n`, 'slug.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('shadow-basalt-export')
  })

  it('DOES still flag a legacy class component (one that extends)', () => {
    const { rules } = run(`export class EmptyState extends Component {}\n`)
    expect(rules).toContain('shadow-basalt-export')
  })

  it('does NOT flag a non-function binding that shares a name', () => {
    const { code, rules } = run(`export const EmptyState = { label: 'none' }\n`, 'consts.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('shadow-basalt-export')
  })

  it('DOES still flag a memo/forwardRef-wrapped component', () => {
    expect(run(`export const EmptyState = memo(() => null)\n`).rules).toContain(
      'shadow-basalt-export',
    )
    expect(run(`export const EmptyState = React.forwardRef(() => null)\n`).rules).toContain(
      'shadow-basalt-export',
    )
  })
})

// ── theme-allow shape grid (the plugin half of the annotation contract) ──────

/**
 * The plugin's copy of the grid pinned in `src/guard/check-source.test.ts`, row name for row name.
 *
 * Five holes in four rounds, twice because the two parsers disagreed about what an annotation IS —
 * so the shapes are enumerated over the axes that vary (comment style × token position × where the
 * closer falls × what follows), not collected as anecdotes. Every row here has a twin there; the
 * guard-only dialects (CSS continuation lines, HTML, the JSON member form) have no twin because
 * oxlint never parses those files.
 *
 * `no-raw-font-size` is the vehicle — a JSXAttribute rule, so the reported node's line is exactly
 * the line an annotation has to reach.
 */
/** Wraps JSX children in a component, so a `{/* … *\/}` child is legal source. */
const jsxShape = (body: string): string =>
  `export const C = () => (\n  <div>\n${body}\n  </div>\n)\n`

describe('theme-allow shape grid', () => {
  const REASON = 'deliberate legacy value'
  const A = `theme-allow no-raw-font-size — ${REASON}`
  const AF = `theme-allow-file no-raw-font-size — ${REASON}`
  const T = `<Text fz={10} />`
  const J = jsxShape

  const waives = (source: string): boolean => !run(source).rules.has('no-raw-font-size')

  it.each([
    ['// own line', `// ${A}\nexport const C = ${T}\n`],
    ['// indented', `function f() {\n  // ${A}\n  return ${T}\n}\n`],
    ['// no space after the marker', `//${A}\nexport const C = ${T}\n`],
    ['// trailing', `export const C = ${T} // ${A}\n`],
    [
      '// reason wrapped onto a second // comment',
      `// ${A},\n// continued here\nexport const C = ${T}\n`,
    ],
    ['/* */ own line', `/* ${A} */\nexport const C = ${T}\n`],
    ['/* */ trailing', `export const C = ${T} /* ${A} */\n`],
    ['/** */ own line (docblock opener)', `/** ${A} */\nexport const C = ${T}\n`],
    ['/* opener + token, closer on its own line', `/* ${A}\n*/\nexport const C = ${T}\n`],
    ['/* gutter token, closer on the token line', `/*\n ${A} */\nexport const C = ${T}\n`],
    ['/* gutter token, closer on its own line', `/*\n ${A}\n*/\nexport const C = ${T}\n`],
    ['/** star gutter, closer on the token line', `/**\n * ${A} */\nexport const C = ${T}\n`],
    ['/** star gutter, closer on its own line', `/**\n * ${A}\n */\nexport const C = ${T}\n`],
    ['/** token then 1 prose line', `/**\n * ${A}\n * more\n */\nexport const C = ${T}\n`],
    [
      '/** token then 12 prose lines',
      `/**\n * ${A}\n${' * p\n'.repeat(12)} */\nexport const C = ${T}\n`,
    ],
    [
      '/** prose first, token on a later gutter line',
      `/**\n * some prose\n * ${A}\n */\nexport const C = ${T}\n`,
    ],
    ['{/* */} own line', J(`    {/* ${A} */}\n    ${T}`)],
    ['{/* */} trailing on the target line', J(`    ${T} {/* ${A} */}`)],
    ['{/* opener + token, closer on its own line', J(`    {/* ${A}\n    */}\n    ${T}`)],
    ['{/* gutter token, closer on the token line', J(`    {/*\n      ${A} */}\n    ${T}`)],
    ['{/* gutter token, closer on its own line', J(`    {/*\n      ${A}\n    */}\n    ${T}`)],
    ['{/** star gutter, closer on the token line', J(`    {/**\n     * ${A} */}\n    ${T}`)],
    ['{/** star gutter, closer on its own line', J(`    {/**\n     * ${A}\n     */}\n    ${T}`)],
    [
      '{/** token then 6 prose lines',
      J(`    {/**\n     * ${A}\n${'     * p\n'.repeat(6)}     */}\n    ${T}`),
    ],
    ['{/* target on the closer line', J(`    {/*\n      ${A}\n    */}${T}`)],
    ['{/* closer alone, tab indented', J(`\t{/*\n\t  ${A}\n\t*/}\n\t${T}`)],
    ['{/* closer alone, space between */ and }', J(`    {/*\n      ${A}\n    */ }\n    ${T}`)],
    [
      '{/* closer alone, two annotations in one block',
      J(`    {/*\n      ${A}\n      theme-allow card-inset — ${REASON}\n    */}\n    ${T}`),
    ],
    [
      '/** */ then an unrelated // note',
      `/** ${A} */\n// an unrelated note\nexport const C = ${T}\n`,
    ],
    ['{/* */} then an unrelated {/* */}', J(`    {/* ${A} */}\n    {/* unrelated */}\n    ${T}`)],
    ['theme-allow-file, {/* closer on its own line', J(`    {/*\n      ${AF}\n    */}\n    ${T}`)],
    ['theme-allow-file, /** star gutter', `/**\n * ${AF}\n */\nexport const C = ${T}\n`],
  ])('%s waives', (_name, source) => {
    expect(waives(source as string)).toBe(true)
  })

  // ── UNSUPPORTED — asserted, so a hole can never pass for a design decision ──
  it.each([
    ['blank line after a // annotation', `// ${A}\n\nexport const C = ${T}\n`],
    ['blank line after a {/* */} annotation', J(`    {/* ${A} */}\n\n    ${T}`)],
    [
      'blank line after a {/* closer on its own line',
      J(`    {/*\n      ${A}\n    */}\n\n    ${T}`),
    ],
    ['mid-sentence in a line comment', `// we normally write a ${A} here\nexport const C = ${T}\n`],
    [
      'mid-sentence in a docblock gutter',
      `/**\n * Each value is escaped with a ${A} annotation.\n */\nexport const C = ${T}\n`,
    ],
    [
      'mid-sentence in a JSX expression comment',
      J(`    {/* the shape here is a ${A} comment */}\n    ${T}`),
    ],
    [
      'inside a string literal',
      `const doc = 'theme-allow no-raw-font-size'\nexport const C = ${T}\n`,
    ],
    ['above a multi-line opening tag', J(`    {/* ${A} */}\n    <Text\n      fz={10}\n    />`)],
  ])('%s does NOT waive', (_name, source) => {
    expect(waives(source as string)).toBe(false)
  })
})

// ── hand-rolled-shell ────────────────────────────────────────────────────────

describe('basalt/hand-rolled-shell', () => {
  it('flags a hand-assembled Mantine AppShell', () => {
    const { code, rules } = run(
      `import { AppShell, Burger } from '@mantine/core'
export const Shell = () => (
  <AppShell>
    <AppShell.Header><Burger opened={false} /></AppShell.Header>
    <AppShell.Navbar>nav</AppShell.Navbar>
  </AppShell>
)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('hand-rolled-shell')
  })

  it('does NOT flag a file that renders BasaltShell', () => {
    const { code, rules } = run(
      `import { AppShell } from '@mantine/core'
import { BasaltShell } from 'basalt-ui'
export const Shell = () => <BasaltShell sections={[]}><AppShell.Main>x</AppShell.Main></BasaltShell>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('hand-rolled-shell')
  })

  // Exempt by DECLARATION, not by path — a rule saying "compose X" cannot fire inside X. (The
  // fixture also trips `shadow-basalt-export`, which is correct for a consumer file and irrelevant
  // here, so this asserts the rule set rather than the exit code.)
  it('does NOT flag the module that DEFINES BasaltShell', () => {
    const { rules } = run(
      `import { AppShell } from '@mantine/core'
export function BasaltShell() { return <AppShell.Navbar>nav</AppShell.Navbar> }\n`,
    )
    expect(rules).not.toContain('hand-rolled-shell')
  })

  it("does NOT flag a consumer's own AppShell-named component with no @mantine import", () => {
    const { code, rules } = run(
      `import { AppShell } from './my-layout'
export const C = () => <AppShell.Navbar>nav</AppShell.Navbar>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('hand-rolled-shell')
  })

  it('does NOT flag a standalone Mantine NavLink (deliberately not a trigger)', () => {
    const { code, rules } = run(
      `import { NavLink } from '@mantine/core'
export const C = () => <NavLink label="Settings" />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('hand-rolled-shell')
  })
})

// ── grace ledger ↔ shipped preset ────────────────────────────────────────────

type GraceEntry = { since: string; promote: string; why: string }

/**
 * Tiny local semver compare — no dependency. Assumes plain `x.y.z`, no pre-release identifiers.
 * Compares each component numerically, not lexically, so `'1.9.0' < '1.10.0'` and
 * `'1.3.0' < '1.26.0'` — a string compare would get both backwards.
 */
function compareSemver(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

/**
 * The C16 gate itself (docs/CONTROLS-SPEC.md §1), extracted so it can be exercised against a
 * synthetic ledger as well as the real `PLUGIN_RULE_GRACE` — an `it.each` over the real ledger ran
 * zero assertions while it was empty, which proved nothing about the gate actually firing. Throws
 * naming the first offending entry when either invariant breaks: `since` must precede `promote`
 * for every entry, and no entry's `promote` may be `<=` the given version.
 *
 * `version` is `package.json`'s, i.e. the version already published, so this half can only fail
 * AFTER the release that shipped a due entry — `release.yml` runs no tests and the
 * `chore: release … [skip ci]` commit skips CI. The pre-release half is
 * `scripts/check-grace.ts`, run by `scripts/release.sh` against the version the dry run computed.
 */
function assertGraceLedger(ledger: Record<string, GraceEntry>, version: string): void {
  for (const [id, entry] of Object.entries(ledger)) {
    if (compareSemver(entry.since, entry.promote) >= 0) {
      throw new Error(
        `${id}: \`since\` (${entry.since}) must be before \`promote\` (${entry.promote}).`,
      )
    }
    if (compareSemver(version, entry.promote) >= 0) {
      throw new Error(
        `basalt/${id}: shipped preset is at ${version}, which has reached its promote version ` +
          `${entry.promote} — promote to error or extend \`promote\` with a reason.`,
      )
    }
  }
}

describe('compareSemver', () => {
  it('orders multi-digit components numerically, not lexically', () => {
    expect(compareSemver('1.9.0', '1.10.0')).toBeLessThan(0)
    expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0)
    expect(compareSemver('1.3.0', '1.26.0')).toBeLessThan(0)
    expect(compareSemver('1.26.0', '1.3.0')).toBeGreaterThan(0)
  })

  it('treats equal versions as equal', () => {
    expect(compareSemver('1.25.0', '1.25.0')).toBe(0)
  })
})

describe('assertGraceLedger', () => {
  it('does not throw on a well-formed entry not yet due', () => {
    const ledger = { 'fake-rule': { since: '1.0.0', promote: '2.0.0', why: 'synthetic' } }
    expect(() => assertGraceLedger(ledger, '1.25.0')).not.toThrow()
  })

  it('throws once the given version reaches promote', () => {
    const ledger = { 'fake-rule': { since: '1.0.0', promote: '1.25.0', why: 'synthetic' } }
    expect(() => assertGraceLedger(ledger, '1.25.0')).toThrow(/fake-rule/)
  })

  it('throws once the given version is past promote', () => {
    const ledger = { 'fake-rule': { since: '1.0.0', promote: '1.9.0', why: 'synthetic' } }
    expect(() => assertGraceLedger(ledger, '1.10.0')).toThrow(/fake-rule/)
  })

  it('throws when since does not precede promote', () => {
    const ledger = { 'fake-rule': { since: '1.5.0', promote: '1.5.0', why: 'synthetic' } }
    expect(() => assertGraceLedger(ledger, '1.0.0')).toThrow(/since/)
  })
})

// ── twin lanes: one law, two lanes, one promotion ─────────────────────────────
// A guard kind and a plugin rule that enforce ONE law in two lanes (CSS/text vs. JSX AST) must
// promote together — a consumer failing one spelling and warned on the other is the confusion the
// pairing exists to prevent. `raw-media-query` split from `basalt/raw-breakpoint` exactly that way
// (1.32.0 vs 1.33.0). Twins are DERIVED from declarations that outlive the grace window: a
// `WAIVER_ID_ALIASES` pair, and a guard kind whose registry message names its `basalt/<id>` twin.
// (Deriving them from the ledger, as this did until 1.33.0, went vacuous the moment the last pair
// promoted.)

const pluginGrace = PLUGIN_RULE_GRACE as Record<string, GraceEntry>
const guardGrace = GRACE_PERIOD_KINDS as Record<string, GraceEntry>

function twinLanes(): Array<[kind: string, rule: string]> {
  const pairs = new Map<string, string>()
  for (const [kind, aliases] of Object.entries(WAIVER_ID_ALIASES)) {
    if (!Object.hasOwn(GUARD_RULES, kind)) continue
    for (const rule of aliases) pairs.set(kind, rule)
  }
  for (const [kind, rule] of Object.entries(GUARD_RULES)) {
    for (const m of rule.message.matchAll(/basalt\/([a-z-]+)/g)) {
      if (m[1] !== undefined && m[1] in basaltPlugin.rules) pairs.set(kind, m[1])
    }
  }
  return [...pairs]
}

describe('twin lanes share one promotion', () => {
  it('derives the known pairs (the derivation is not silently empty)', () => {
    expect(twinLanes()).toContainEqual(['raw-media-query', 'raw-breakpoint'])
    expect(twinLanes()).toContainEqual(['raw-selection-control', 'control-outside-home'])
  })

  it.each(twinLanes())('%s and basalt/%s share one grace state and promote', (kind, rule) => {
    expect([kind, rule, guardGrace[kind]?.promote]).toEqual([
      kind,
      rule,
      pluginGrace[rule]?.promote,
    ])
  })
})

describe('PLUGIN_RULE_GRACE', () => {
  const shipped = JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'oxlint-basalt.json'), 'utf8'),
  ) as {
    rules: Record<string, unknown>
  }
  const pkgVersion = (
    JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'package.json'), 'utf8')) as {
      version: string
    }
  ).version
  const graceEntries = Object.entries(PLUGIN_RULE_GRACE) as [string, GraceEntry][]
  const graceIds = graceEntries.map(([id]) => id)
  const shippedBasaltIds = Object.keys(shipped.rules).filter((id) => id.startsWith('basalt/'))

  // The mechanism whose ABSENCE let three rules sit at `warn` for up to twelve minors with nothing
  // tracking them. Deleting a ledger entry IS the promotion, and this test makes flipping the
  // shipped level part of the same commit.
  it('every grace entry is warn in the shipped preset', () => {
    for (const id of graceIds) expect(shipped.rules[`basalt/${id}`]).toBe('warn')
  })

  it('every shipped rule NOT in the ledger is error', () => {
    for (const id of shippedBasaltIds) {
      const bareId = id.slice('basalt/'.length)
      if (graceIds.includes(bareId)) continue
      expect([id, shipped.rules[id]]).toEqual([id, 'error'])
    }
  })

  it('every entry carries a written why', () => {
    for (const [id, entry] of graceEntries) {
      if (entry.why.length <= 40)
        throw new Error(`${id}: \`why\` must be longer than 40 characters.`)
      expect(entry.why.length).toBeGreaterThan(40)
    }
  })

  // The C16 version gate, run against the REAL ledger and REAL package version — covers `since` <
  // `promote` and "no entry has reached its promote version" in one call.
  // (see `assertGraceLedger`'s synthetic coverage above for the gate itself).
  it('passes the C16 gate against the real ledger and package version', () => {
    expect(() => assertGraceLedger(Object.fromEntries(graceEntries), pkgVersion)).not.toThrow()
  })

  // F27: a grace entry is written for a rule that lands in the NEXT release, so its `since` can sit
  // one minor ahead of `package.json`'s current version (`bound-control-outside-home` at 1.28.0
  // while the published version still reads 1.27.0, exactly like `control-outside-home` before it).
  // What this catches is a `since` that is malformed or planted further out than that — a value
  // static analysis has no way to verify is "the version this actually ships in", so the bound this
  // test enforces is the one thing that IS checkable: well-formed semver, no more than one minor
  // past what is currently published.
  it("every grace entry's since is valid semver, at most one minor past the published version", () => {
    const SEMVER = /^\d+\.\d+\.\d+$/
    const [major, minor] = pkgVersion.split('.').map(Number)
    const nextMinorCeiling = `${major}.${minor + 1}.0`
    for (const [id, entry] of graceEntries) {
      if (!SEMVER.test(entry.since)) {
        throw new Error(`${id}: \`since\` (${entry.since}) is not valid semver.`)
      }
      if (compareSemver(entry.since, nextMinorCeiling) > 0) {
        throw new Error(
          `${id}: \`since\` (${entry.since}) is more than one minor past the published version ` +
            `${pkgVersion}.`,
        )
      }
    }
  })
})

// ── no-raw-font-size: style-context scoping ──────────────────────────────────

describe('basalt/no-raw-font-size — style context', () => {
  it('flags a fontSize inside a style attribute', () => {
    const { code, rules } = run(`export const C = () => <div style={{ fontSize: 11 }} />\n`)
    expect(code).toBe(1)
    expect(rules).toContain('no-raw-font-size')
  })

  it('flags a fontSize inside a Mantine styles per-part object', () => {
    const { code, rules } = run(
      `export const C = () => <TextInput styles={{ input: { fontSize: 12 } }} />\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('no-raw-font-size')
  })

  it('flags a fontSize in a CSSProperties-annotated const', () => {
    const { code, rules } = run(
      `import type { CSSProperties } from 'react'\nconst rowLook: CSSProperties = { fontSize: 11 }\nexport { rowLook }\n`,
      'look.ts',
    )
    expect(code).toBe(1)
    expect(rules).toContain('no-raw-font-size')
  })

  // The obsidian false positive: a `fontSize` key in a plain data object, in a package with no
  // React and no Mantine, where "route it through VX.text.*" is advice about another domain.
  it('does NOT flag a fontSize key in a plain data object', () => {
    const { code, rules } = run(
      `export const iconizeData = { settings: { fontSize: 16 }, Inbox: 'LiInbox' }\n`,
      'data.ts',
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('no-raw-font-size')
  })

  it('does NOT run in a test file at all', () => {
    const { code, rules } = run(
      `export const C = () => <div style={{ fontSize: 11 }} />\n`,
      'nav-config.test.tsx',
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('no-raw-font-size')
  })
})

// ── KNOWN_RULE_IDS — the hand-maintained list a typo'd theme-allow is measured against ──────────

describe('KNOWN_RULE_IDS', () => {
  // Forgetting an entry is not cosmetic: an id this set does not know is treated as a typo, so the
  // annotation naming it waives nothing. Before the fail-closed fix it was worse — an unknown id
  // fell through to the empty-`rules` branch and became a BLANKET waiver, which is how a
  // hand-maintained duplicate turned a missing entry into a hole in the guard.
  it('contains every rule the plugin actually exports', () => {
    for (const id of Object.keys(basaltPlugin.rules)) {
      expect([id, KNOWN_RULE_IDS.has(id)]).toEqual([id, true])
    }
  })

  it('contains every guard kind', () => {
    for (const kind of Object.keys(GUARD_RULES)) {
      expect([kind, KNOWN_RULE_IDS.has(kind)]).toEqual([kind, true])
    }
  })

  // Deduped, because ONE id is deliberately in both registries: `in-body-page-title` is a plugin
  // rule AND a guard kind (law C8 has an AST half and a text half), so one `theme-allow
  // in-body-page-title — <why>` waives both lanes rather than needing a different word per lane.
  // `RETIRED_RULE_IDS` adds a third component: an id that used to be a guard kind or a plugin
  // rule, is in neither live registry, and must still parse as a (dead) waiver rather than a typo.
  it('contains nothing else — it is exactly the union of the two registries plus retired ids', () => {
    const expected = [
      ...new Set([
        ...Object.keys(basaltPlugin.rules),
        ...Object.keys(GUARD_RULES),
        ...RETIRED_RULE_IDS,
      ]),
    ].toSorted()
    expect([...KNOWN_RULE_IDS].toSorted()).toEqual(expected)
  })

  it('shares exactly one id between the two registries — the C8 pair', () => {
    const shared = Object.keys(basaltPlugin.rules).filter((id) => Object.hasOwn(GUARD_RULES, id))
    expect(shared).toEqual(['in-body-page-title'])
  })

  // The guard's own copy (`PLUGIN_RULE_IDS`) is what `check-theme --audit-allows` classifies an
  // annotation against: an id in neither registry reads as a typo and is reported unscoped. A new
  // plugin rule missing from it would make every waiver naming it look like a mistake.
  it('every plugin rule is classifiable by the guard — its own id set or a guard kind', () => {
    for (const id of Object.keys(basaltPlugin.rules)) {
      expect([id, PLUGIN_RULE_IDS.has(id) || Object.hasOwn(GUARD_RULES, id)]).toEqual([id, true])
    }
  })

  // A retired id has to be classifiable too, on both sides — `RETIRED_RULE_IDS` is this plugin's
  // copy, `PLUGIN_RULE_IDS` (src/guard) is the guard's. Drift between them would mean
  // `--audit-allows` classifies a retired id one way from `check-theme` and another from oxlint.
  it('every retired id is in the guard’s PLUGIN_RULE_IDS too', () => {
    for (const id of RETIRED_RULE_IDS) {
      expect([id, PLUGIN_RULE_IDS.has(id)]).toEqual([id, true])
    }
  })
})

// ── one law, two rule ids ──────────────────────────────────────────────────────────────────────

/**
 * `basalt/control-outside-home` and the guard's `raw-selection-control` are the SAME law read by
 * two engines — the guard's own message says so — and a waiver naming either used to silence only
 * the lane whose id it spelled. The working annotation was `theme-allow raw-selection-control
 * control-outside-home`: two ids, undocumented, one silent debug cycle per consumer.
 */
describe('WAIVER_ID_ALIASES', () => {
  it('is identical in both lanes', () => {
    expect(WAIVER_ID_ALIASES).toEqual(GUARD_WAIVER_ID_ALIASES)
  })

  it('names only ids both registries know', () => {
    for (const [id, aliases] of Object.entries(WAIVER_ID_ALIASES)) {
      expect([id, KNOWN_RULE_IDS.has(id)]).toEqual([id, true])
      for (const alias of aliases) expect([alias, KNOWN_RULE_IDS.has(alias)]).toEqual([alias, true])
    }
  })

  it('waives the plugin rule under the TEXT lane’s id', () => {
    const { code, rules } = run(
      `import { Select } from '@mantine/core'\nexport const C = () => (\n  <div>\n` +
        `    {/* theme-allow raw-selection-control — the Tauri header has no shell */}\n` +
        `    <Select data={[]} />\n  </div>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('control-outside-home')
  })
})

// ── theme-allow fails closed on a typo ─────────────────────────────────────────────────────────

describe('theme-allow with an unrecognized rule id', () => {
  it('waives nothing rather than escalating to a blanket suppression', () => {
    // `no-raw-font-size` would be waived by a bare `theme-allow`. A typo'd id must not do that.
    const { code, rules } = run(
      `export const C = () => <Text fz={10} /> // theme-allow no-raw-font-sizee — legacy\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('no-raw-font-size')
  })

  it('a correctly spelled id still waives', () => {
    const { code, rules } = run(
      `export const C = () => <Text fz={10} /> // theme-allow no-raw-font-size — legacy\n`,
    )
    expect(rules).not.toContain('no-raw-font-size')
    expect(code).toBe(0)
  })

  it('a bare theme-allow still waives everything', () => {
    const { rules } = run(`export const C = () => <Text fz={10} /> // theme-allow\n`)
    expect(rules).not.toContain('no-raw-font-size')
  })

  it('does not resolve an Object.prototype key as a rule id', () => {
    const { code, rules } = run(
      `export const C = () => <Text fz={10} /> // theme-allow constructor — inherited key\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('no-raw-font-size')
  })

  // The id slot closes at the first space no comma opened — mirrors `parseAllowAnnotation`.
  it('reads an unknown word after a resolved id as the reason, not as a second id', () => {
    const { code, rules } = run(
      `export const C = () => <Text fz={10} /> // theme-allow no-raw-font-size sub-scale micro label\n`,
    )
    expect(rules).not.toContain('no-raw-font-size')
    expect(code).toBe(0)
  })
})

// ── the control-home rules (docs/CONTROLS-SPEC.md §6) ────────────────────────

const MANTINE_IMPORT = `import { Button, ScrollArea, SegmentedControl, Select } from '@mantine/core'\n`

/**
 * The home components, imported from basalt — the OWNER-tag provenance every slot rule now requires.
 *
 * Not decoration: `Section` is one of the most common local component names there is, and matching
 * the bare tag made a consumer's own `<Section actions={…}>` an `error`-level tiered home. A fixture
 * that renders `<PageBar>` out of thin air proves nothing a real consumer file would hit, so the
 * fixtures import what they render.
 */
const BASALT_IMPORT = `import { ChartCard, PageBar, Section, SettingsSection } from 'basalt-ui'\n`

describe('basalt/hand-rolled-filter', () => {
  /**
   * The deliberate consequence of teaching the slot resolver to read an object spread: a slot IS a
   * slot in either spelling, so a raw Mantine control conditionally spread into one moves from
   * `control-outside-home` (warn, and the WRONG verdict — it does have a home) to this rule
   * (error, and the right one). One home model or none; a spread that is a home for the rule that
   * exempts and not for the rule that polices is the silent half-application this wave removes.
   */
  it('flags a raw Select handed to a slot written as an object spread', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = ({ cond }) => (\n` +
        `  <Section {...(cond && { filters: <Select data={[]} /> })}>body</Section>\n)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('hand-rolled-filter')
    expect(rules).not.toContain('control-outside-home')
  })

  it('flags a raw Mantine Select handed to a PageBar filters slot', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => <PageBar filters={<Select data={[]} />} />\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('hand-rolled-filter')
  })

  it('flags it through a hoisted binding — the argo headerExtra shape', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}const pills = <Select data={[]} />\n` +
        `export const C = () => <PageBar filters={pills} />\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('hand-rolled-filter')
  })

  it('flags one inside an ARRAY slot value (filtersEnd={[…]})', () => {
    const { rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => <PageBar filtersEnd={[<Select key="a" data={[]} />]} />\n`,
    )
    expect(rules).toContain('hand-rolled-filter')
  })

  // The body form is the whole reason the walk stops at the slot ATTRIBUTE: a Section's children
  // are a page region, not a control home, and a form there is C1's third home.
  // `control-outside-home` DOES report this one (a Section body is not a home either) — which is
  // the point of the split: the body form is a warn about placement, never an error about the slot.
  it("does NOT flag a Select in a Section's CHILDREN — the body form", () => {
    const { rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => (\n  <Section title="Filters">\n    <Select data={[]} />\n  </Section>\n)\n`,
    )
    expect(rules).not.toContain('hand-rolled-filter')
  })

  it("does NOT flag a slot prop on a tag that is not a home (a consumer's own Toolbar)", () => {
    const { rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => <Toolbar filters={<Select data={[]} />} />\n`,
    )
    expect(rules).not.toContain('hand-rolled-filter')
  })

  it('does NOT flag a same-named component that is not the Mantine binding', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}import { Select } from './my-select'\nexport const C = () => <PageBar filters={<Select data={[]} />} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('hand-rolled-filter')
  })

  it('does NOT flag a bound basalt control in the same slot', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}export const C = () => <PageBar filters={<RangeFilter field={f} />} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('hand-rolled-filter')
  })

  // The settled reading of law C1's THIRD home (docs/CONTROLS-SPEC.md §5/§6): a form row keeps
  // Mantine's `md` tier, so a raw input bound to a setting is right there — and `control` /
  // `SettingsRow` are absent from the slot set for exactly that reason.
  it("does NOT flag a raw Select in a SettingsRow's control — the form-row home", () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => (\n  <SettingsSection title="S">\n    <SettingsRow label="Channel" control={<Select data={[]} />} />\n  </SettingsSection>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('hand-rolled-filter')
    expect(rules).not.toContain('control-outside-home')
  })

  it("still flags one in a SettingsSection's actions header slot — that IS tiered", () => {
    const { rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => <SettingsSection title="S" actions={<Select data={[]} />} />\n`,
    )
    expect(rules).toContain('hand-rolled-filter')
  })

  it('flags a member tag whose ROOT binding is Mantine (Chip.Group)', () => {
    const { rules } = run(
      `${BASALT_IMPORT}import { Chip } from '@mantine/core'\nexport const C = () => <PageBar filters={<Chip.Group multiple />} />\n`,
    )
    expect(rules).toContain('hand-rolled-filter')
  })

  it('honors a scoped theme-allow', () => {
    const { rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => (\n  <PageBar\n    filters={\n      // theme-allow hand-rolled-filter — not a store field\n      <Select data={[]} />\n    }\n  />\n)\n`,
    )
    expect(rules).not.toContain('hand-rolled-filter')
  })

  it('honors a theme-allow-file declaration', () => {
    const { rules } = run(
      `// theme-allow-file hand-rolled-filter — a legacy page, migrating next sprint\n` +
        `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => <PageBar filters={<Select data={[]} />} />\n`,
    )
    expect(rules).not.toContain('hand-rolled-filter')
  })

  // Colocating a trigger with its overlay in the slot is how a "create" modal and a "custom range"
  // popover are written. The overlay's contents portal out of the slot and are already declared
  // non-homes by `control-outside-home`, so the same code was exempt outside a slot and an `error`
  // inside one.
  it('does NOT flag a Select inside a Modal colocated in an actions slot', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}import { Button, Modal, Select } from '@mantine/core'\n` +
        `export const C = () => (\n  <WidgetHeader\n    actions={\n      <>\n        <Button onClick={open}>New</Button>\n        <Modal opened>\n          <Select data={[]} />\n        </Modal>\n      </>\n    }\n  />\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('hand-rolled-filter')
  })

  it('does NOT flag one inside a Popover.Dropdown colocated in a filters slot', () => {
    const { rules } = run(
      `${BASALT_IMPORT}import { Button, Popover, Select } from '@mantine/core'\n` +
        `export const C = () => (\n  <Section\n    title="T"\n    filters={\n      <Popover>\n        <Popover.Target>\n          <Button>Custom range</Button>\n        </Popover.Target>\n        <Popover.Dropdown>\n          <Select data={[]} />\n        </Popover.Dropdown>\n      </Popover>\n    }\n  />\n)\n`,
    )
    expect(rules).not.toContain('hand-rolled-filter')
  })

  it('STILL flags a bare sibling Select in the same slot as an exempt overlay', () => {
    const { rules } = run(
      `${BASALT_IMPORT}import { Modal, Select } from '@mantine/core'\n` +
        `export const C = () => (\n  <PageBar\n    filters={\n      <>\n        <Select data={[]} />\n        <Modal opened>\n          <Select data={[]} />\n        </Modal>\n      </>\n    }\n  />\n)\n`,
    )
    expect(rules).toContain('hand-rolled-filter')
  })

  // `Select as MantineSelect` is the canonical way a consumer wraps a Mantine component — the exact
  // case the provenance comment worried about — and keying membership on the LOCAL name made it
  // invisible.
  it('flags an ALIASED Mantine import in a slot', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}import { Select as MantineSelect } from '@mantine/core'\n` +
        `export const C = () => <PageBar filters={<MantineSelect data={[]} />} />\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('hand-rolled-filter')
  })

  it('flags a NAMESPACE-imported Mantine control in a slot', () => {
    const { rules } = run(
      `${BASALT_IMPORT}import * as M from '@mantine/core'\n` +
        `export const C = () => <PageBar filters={<M.SegmentedControl data={[]} />} />\n`,
    )
    expect(rules).toContain('hand-rolled-filter')
  })

  it('flags an aliased MEMBER tag (Chip as C → C.Group)', () => {
    const { rules } = run(
      `${BASALT_IMPORT}import { Chip as Ch } from '@mantine/core'\n` +
        `export const C = () => <PageBar filters={<Ch.Group multiple />} />\n`,
    )
    expect(rules).toContain('hand-rolled-filter')
  })

  // `control-outside-home` DOES report this one — a local `Section` is not a home, so the control
  // has none. Only this rule's silence is asserted; the exit code belongs to that warn.
  it("does NOT flag a slot on a consumer's own Section — provenance is on the OWNER too", () => {
    const { rules } = run(
      `import { Section } from './layout/section'\n${MANTINE_IMPORT}` +
        `export const C = () => <Section actions={<Select data={[]} />} />\n`,
    )
    expect(rules).not.toContain('hand-rolled-filter')
  })
})

describe('basalt/control-outside-home', () => {
  it('flags a raw Mantine Select in no home at all', () => {
    const { code, rules } = run(
      `${MANTINE_IMPORT}export const C = () => <div><Select data={[]} /></div>\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('control-outside-home')
  })

  it('does NOT flag one inside a home slot — that is hand-rolled-filter s business', () => {
    const { rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => <PageBar filters={<Select data={[]} />} />\n`,
    )
    expect(rules).not.toContain('control-outside-home')
  })

  it.each(['SettingsRow', 'Modal', 'Drawer', 'Composer'])(
    'does NOT flag one under a declared non-home (%s)',
    (host) => {
      const { rules } = run(
        `${MANTINE_IMPORT}export const C = () => <${host}><Select data={[]} /></${host}>\n`,
      )
      expect(rules).not.toContain('control-outside-home')
    },
  )

  // FormRow/FormGroup (`basalt-ui/controls`, still re-exported from `basalt-ui/forms` until 1.39.0)
  // are law C1's third home written for a `<form>` rather than a settings page — the same non-home
  // treatment SettingsRow gets, via the same CONTROL_HOST_TAGS ancestry walk, which matches by NAME
  // so either subpath is a home.
  it.each(
    ['FormRow', 'FormGroup'].flatMap((host) =>
      ['basalt-ui/controls', 'basalt-ui/forms'].map((subpath) => [host, subpath] as const),
    ),
  )('does NOT flag a raw Select nested inside a %s imported from %s', (host, subpath) => {
    const { rules } = run(
      `import { ${host} } from '${subpath}'\n${MANTINE_IMPORT}` +
        `export const C = () => <${host} label="L"><Select data={[]} /></${host}>\n`,
    )
    expect(rules).not.toContain('control-outside-home')
  })

  it('still flags a bare Select in a page body with no FormRow/FormGroup around it', () => {
    const { rules } = run(
      `${MANTINE_IMPORT}export const C = () => <div><Select data={[]} /></div>\n`,
    )
    expect(rules).toContain('control-outside-home')
  })

  describe('a hand-rolled row action in a column cell', () => {
    const TABLE_IMPORT = `import { createColumnHelper } from 'basalt-ui/table'\n`
    const cell = (body: string) =>
      `${TABLE_IMPORT}${MANTINE_IMPORT}const col = createColumnHelper<Row>()\n` +
      `export const columns = [col.display({ id: 'a', cell: ({ row }) => ${body} })]\n`

    it('flags a Mantine Menu in a col.display cell', () => {
      const { code, rules } = run(
        `import { Menu } from '@mantine/core'\n${cell('<Menu><Menu.Target><span /></Menu.Target></Menu>').replace(MANTINE_IMPORT, '')}`,
      )
      expect(code).toBe(1)
      expect(rules).toContain('control-outside-home')
    })

    it('flags a Mantine ActionIcon in a cell renderer', () => {
      const { rules } = run(
        `import { ActionIcon } from '@mantine/core'\n${cell('<ActionIcon aria-label="x" />').replace(MANTINE_IMPORT, '')}`,
      )
      expect(rules).toContain('control-outside-home')
    })

    it('does NOT flag a Menu outside a cell renderer', () => {
      const { rules } = run(
        `import { Menu } from '@mantine/core'\nexport const C = () => <Menu><Menu.Target><span /></Menu.Target></Menu>\n`,
      )
      expect(rules).not.toContain('control-outside-home')
    })

    it('reports a hand-rolled Menu + ActionIcon trigger once, not twice', () => {
      const { output } = run(
        `import { ActionIcon, Menu } from '@mantine/core'\n${TABLE_IMPORT}const col = createColumnHelper<Row>()\n` +
          `export const columns = [col.display({ id: 'a', cell: () => (\n` +
          `  <Menu><Menu.Target><ActionIcon aria-label="x" /></Menu.Target></Menu>\n) })]\n`,
      )
      expect(output.match(/\(basalt\/control-outside-home\)/g)).toHaveLength(1)
    })

    it('does NOT flag an ActionIcon already homed in a form row inside a cell', () => {
      const { rules } = run(
        `import { ActionIcon } from '@mantine/core'\nimport { FormRow } from 'basalt-ui/controls'\n${TABLE_IMPORT}` +
          `const col = createColumnHelper<Row>()\nexport const columns = [col.display({ id: 'a', cell: () => (\n` +
          `  <FormRow label="L"><ActionIcon aria-label="x" /></FormRow>\n) })]\n`,
      )
      expect(rules).not.toContain('control-outside-home')
    })

    it('does NOT flag one under a Menu.Dropdown inside a cell', () => {
      const { rules } = run(
        `import { ActionIcon } from '@mantine/core'\n${TABLE_IMPORT}const col = createColumnHelper<Row>()\n` +
          `export const columns = [col.display({ id: 'a', cell: () => (\n` +
          `  <Menu.Dropdown><ActionIcon aria-label="x" /></Menu.Dropdown>\n) })]\n`,
      )
      expect(rules).not.toContain('control-outside-home')
    })

    it('still flags in a file that imports @mantine/form', () => {
      const { rules } = run(
        `import { useForm } from '@mantine/form'\nimport { ActionIcon } from '@mantine/core'\n${TABLE_IMPORT}` +
          `const col = createColumnHelper<Row>()\nexport const columns = [col.display({ id: 'a', cell: () => <ActionIcon aria-label="x" /> })]\n`,
      )
      expect(rules).toContain('control-outside-home')
    })

    it('does not see a cell renderer passed by reference (declared single-file limit)', () => {
      const { rules } = run(
        `import { ActionIcon } from '@mantine/core'\n${TABLE_IMPORT}const col = createColumnHelper<Row>()\n` +
          `const renderActions = () => <ActionIcon aria-label="x" />\n` +
          `export const columns = [col.display({ id: 'a', cell: renderActions })]\n`,
      )
      expect(rules).not.toContain('control-outside-home')
    })

    it('honours a theme-allow waiver', () => {
      const { rules } = run(
        `import { ActionIcon } from '@mantine/core'\n${TABLE_IMPORT}const col = createColumnHelper<Row>()\n` +
          `export const columns = [col.display({ id: 'a', cell: () => (\n` +
          `  // theme-allow control-outside-home — a one-off\n  <ActionIcon aria-label="x" />\n) })]\n`,
      )
      expect(rules).not.toContain('control-outside-home')
    })
  })

  it('does NOT flag one under a member-expression non-home (Menu.Dropdown)', () => {
    const { rules } = run(
      `${MANTINE_IMPORT}export const C = () => <Menu.Dropdown><Select data={[]} /></Menu.Dropdown>\n`,
    )
    expect(rules).not.toContain('control-outside-home')
  })

  it('does NOT flag anything in a file that imports @mantine/form — a form is the third home', () => {
    const { code, rules } = run(
      `${MANTINE_IMPORT}import { useForm } from '@mantine/form'\n` +
        `export const C = () => <div><Select data={[]} /></div>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('control-outside-home')
  })

  // The owner exemption, `hand-rolled-plot`'s shape: the module that IS the bound control cannot be
  // told to use one.
  // `shadow-basalt-export` reports the same fixture (a local `ViewTabs` collides with the shipped
  // one), so only this rule's own silence is asserted — the exit code belongs to that rule.
  it('does NOT flag the module that DEFINES a basalt control', () => {
    const { rules } = run(
      `${MANTINE_IMPORT}export function ViewTabs() {\n  return <SegmentedControl data={[]} />\n}\n`,
    )
    expect(rules).not.toContain('control-outside-home')
  })

  /**
   * The exemption's SECOND half. `CONTROL_OWNER_NAMES` carries generic names (`PanelRow`,
   * `EnumFilter`, `SliderControl`), so a bare-name match let one local helper switch this rule —
   * and `bound-control-outside-home` and `responsive-twin` with it — off for a whole consumer file.
   * A file that imports `basalt-ui*` is CONSUMING basalt; basalt's own control sources import each
   * other relatively and never name the package.
   */
  it('DOES flag a file that declares its own PanelRow but imports basalt-ui', () => {
    const { rules } = run(
      `import { Section } from 'basalt-ui'\n${MANTINE_IMPORT}` +
        `function PanelRow({ children }) {\n  return <div>{children}</div>\n}\n` +
        `export const C = () => (\n  <Section title="x">\n    <Select value={v} onChange={set} data={[]} />\n  </Section>\n)\n`,
    )
    expect(rules).toContain('control-outside-home')
  })

  /**
   * The basalt SUBTREE homes, which this rule did not know: `bound-control-outside-home` has read
   * `FilterSet` / `PageAside` / `PanelRow` as homes since it shipped, so a `<Select>` inside a
   * `<PageAside><PanelRow>` reported while the bound control beside it did not — two rules
   * answering one question two ways.
   */
  it('does NOT flag one inside a PageAside > PanelRow subtree', () => {
    const { code, rules } = run(
      `import { PageAside } from 'basalt-ui'\nimport { PanelRow } from 'basalt-ui/controls'\n${MANTINE_IMPORT}` +
        `export const C = () => (\n  <PageAside title="Filters">\n    <PanelRow label="Scale">\n      <Select data={[]} />\n    </PanelRow>\n  </PageAside>\n)\n`,
      'src/scale-page.tsx',
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('control-outside-home')
  })

  it('does NOT flag one inside a FilterSet subtree', () => {
    const { rules } = run(
      `import { FilterSet } from 'basalt-ui/controls'\n${MANTINE_IMPORT}` +
        `export const C = () => (\n  <FilterSet>\n    <Select data={[]} />\n  </FilterSet>\n)\n`,
      'src/scale-page.tsx',
    )
    expect(rules).not.toContain('control-outside-home')
  })

  // Provenance, the test `SLOT_OWNER_TAGS` already applies: a consumer's own `PanelRow` is a layout
  // helper, not a basalt home, so it exempts nothing.
  it("still flags one inside a consumer's OWN PanelRow", () => {
    const { rules } = run(
      `import { PanelRow } from './panel-row'\n${MANTINE_IMPORT}` +
        `export const C = () => (\n  <PanelRow label="Scale">\n    <Select data={[]} />\n  </PanelRow>\n)\n`,
      'src/scale-page.tsx',
    )
    expect(rules).toContain('control-outside-home')
  })

  it('flags an ALIASED Mantine import with no home', () => {
    const { code, rules } = run(
      `import { Select as MantineSelect } from '@mantine/core'\n` +
        `export const C = () => <div><MantineSelect data={[]} /></div>\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('control-outside-home')
  })

  it('flags a NAMESPACE-imported Mantine control with no home', () => {
    const { rules } = run(
      `import * as M from '@mantine/core'\n` +
        `export const C = () => <div><M.SegmentedControl data={[]} /></div>\n`,
    )
    expect(rules).toContain('control-outside-home')
  })

  it('honors a scoped theme-allow', () => {
    const { rules } = run(
      `${MANTINE_IMPORT}export const C = () => (\n  <div>\n    {/* theme-allow control-outside-home — a one-off admin picker */}\n    <Select data={[]} />\n  </div>\n)\n`,
    )
    expect(rules).not.toContain('control-outside-home')
  })

  /**
   * The CROSS-FILE case, exempted by a naming convention rather than by ancestry — argo carried 9 of
   * these, each a control in a modal/form module whose `<Modal>` is rendered by the parent route.
   * Nothing in the flagged file can see the host, so the ancestry walk never could have.
   */
  describe('the overlay filename convention', () => {
    const SOURCE = `${MANTINE_IMPORT}export const C = () => <div><Select data={[]} /></div>\n`

    it.each([
      'src/edit-session-modal.tsx',
      'src/filters-drawer.tsx',
      'src/column-popover.tsx',
      'src/detail-panel.tsx',
      'src/booking-form.tsx',
    ])('does NOT flag %s — its host lives in the parent', (filename) => {
      const { code, rules } = run(SOURCE, filename)
      expect(code).toBe(0)
      expect(rules).not.toContain('control-outside-home')
    })

    it('still flags a plain page module beside them', () => {
      const { rules } = run(SOURCE, 'src/bookings-page.tsx')
      expect(rules).toContain('control-outside-home')
    })

    // Basename only: a directory of modals holds the page pieces around them too, so a whole
    // `modal/` tree going silent is the version of this exemption that WOULD switch the rule off.
    it('is a BASENAME convention, not a directory one', () => {
      const { rules } = run(SOURCE, 'src/modal/session.tsx')
      expect(rules).toContain('control-outside-home')
    })

    // `modal.tsx` with no leading segment is a page module in every consumer that has one; the
    // convention is `<subject>-modal.tsx`, and the regex says so.
    it('needs the leading subject — a bare modal.tsx is not the convention', () => {
      const { rules } = run(SOURCE, 'src/modal.tsx')
      expect(rules).toContain('control-outside-home')
    })

    // The SECOND dialect: a repo mandating `PascalCase.tsx` for component files (basalt's own root
    // AGENTS.md included) can never write `foo-panel.tsx`, so the kebab form alone exempted nothing
    // there — which is how the CBBI panel collected four warns for a `<PageAside>` in its parent.
    it.each(['src/EditSessionModal.tsx', 'src/FiltersDrawer.tsx', 'src/CbbiPanel.tsx'])(
      'does NOT flag %s — the PascalCase dialect of the same convention',
      (filename) => {
        const { code, rules } = run(SOURCE, filename)
        expect(code).toBe(0)
        expect(rules).not.toContain('control-outside-home')
      },
    )

    /**
     * The trade, stated as a test rather than only as prose: a `FooPanel.tsx` that renders NO page
     * bar is exempt WHOLE-FILE, so a control that genuinely belongs in a bar goes unreported there.
     * Measured before keeping it — across argo, linewatch, image-share, rb and image-gen the
     * PascalCase dialect matches 9 files, all in image-gen, and NONE of them renders a `<PageBar>`
     * or sits under a `routes/` directory. Nine overlay bodies, zero pages, so the dialect stays
     * whole-file rather than growing a "does it render a page bar" predicate (CONTROLS-SPEC §6).
     */
    it('exempts a FooPanel.tsx that renders no page bar — the measured trade', () => {
      const { code, rules } = run(SOURCE, 'src/components/refine/CropPanel.tsx')
      expect(code).toBe(0)
      expect(rules).not.toContain('control-outside-home')
    })

    it('needs the leading subject in the PascalCase dialect too', () => {
      const { rules } = run(SOURCE, 'src/Panel.tsx')
      expect(rules).toContain('control-outside-home')
    })

    it('is CASE-sensitive — foopanel.tsx is neither dialect', () => {
      const { rules } = run(SOURCE, 'src/foopanel.tsx')
      expect(rules).toContain('control-outside-home')
    })
  })
})

/**
 * Ledger G5 (`docs/ASIDE-SPEC.md` §2) — the basalt half of law C1. Mirrors the
 * `control-outside-home` block above case for case, because the two rules answer the same question
 * about a different tag set: that one matches raw Mantine, this one matches a bound basalt control.
 */
describe('basalt/bound-control-outside-home', () => {
  const CONTROLS_IMPORT = `import { FilterSet, PanelRow, SelectFilter, SliderControl } from 'basalt-ui/controls'\n`
  const ASIDE_IMPORT = `import { PageAside, PageBar, Section } from 'basalt-ui'\n`

  it("flags a bound control in a Section's BODY — the stray pill G5 named", () => {
    const { code, rules } = run(
      `${ASIDE_IMPORT}${CONTROLS_IMPORT}export const C = () => (\n  <Section title="Composition">\n    <SelectFilter field={f} />\n  </Section>\n)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('bound-control-outside-home')
  })

  it('flags one in a bare page Stack', () => {
    const { rules } = run(
      `import { Stack } from '@mantine/core'\n${CONTROLS_IMPORT}` +
        `export const C = () => (\n  <Stack>\n    <SelectFilter field={f} />\n  </Stack>\n)\n`,
    )
    expect(rules).toContain('bound-control-outside-home')
  })

  it('does NOT flag one in a PageBar filters slot', () => {
    const { code, rules } = run(
      `${ASIDE_IMPORT}${CONTROLS_IMPORT}export const C = () => <PageBar filters={<SelectFilter field={f} />} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('bound-control-outside-home')
  })

  it('does NOT flag one inside a FilterSet subtree', () => {
    const { code, rules } = run(
      `${CONTROLS_IMPORT}export const C = () => (\n  <FilterSet>\n    <SelectFilter field={f} />\n  </FilterSet>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('bound-control-outside-home')
  })

  // The aside is a shell REGION whose body IS a home — it scopes its children to the `panel`
  // surface, where the same control renders as a row rather than a pill (docs/ASIDE-SPEC.md §3).
  it('does NOT flag one inside a PageAside subtree, Section and all', () => {
    const { code, rules } = run(
      `${ASIDE_IMPORT}${CONTROLS_IMPORT}export const C = () => (\n  <PageAside title="Filters">\n    <Section title="Origin">\n      <SelectFilter field={f} />\n    </Section>\n  </PageAside>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('bound-control-outside-home')
  })

  it("does NOT flag one as a PanelRow's `end` — the attribute hangs off PanelRow itself", () => {
    const { code, rules } = run(
      `${CONTROLS_IMPORT}export const C = () => <PanelRow label="Weight" end={<SelectFilter field={f} />} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('bound-control-outside-home')
  })

  it("does NOT flag one in a PanelRow's children — the row IS the home", () => {
    const { rules } = run(
      `${CONTROLS_IMPORT}export const C = () => (\n  <PanelRow label="Origin">\n    <SelectFilter field={f} />\n  </PanelRow>\n)\n`,
    )
    expect(rules).not.toContain('bound-control-outside-home')
  })

  it('does NOT flag one inside an overlay host (Modal)', () => {
    const { rules } = run(
      `import { Modal } from '@mantine/core'\n${CONTROLS_IMPORT}` +
        `export const C = () => (\n  <Modal opened>\n    <SelectFilter field={f} />\n  </Modal>\n)\n`,
    )
    expect(rules).not.toContain('bound-control-outside-home')
  })

  // FormRow/FormGroup are the same declared non-home as SettingsRow — shared CONTROL_HOST_TAGS walk.
  it.each(['FormRow', 'FormGroup'])('does NOT flag one inside a %s', (host) => {
    const { code, rules } = run(
      `import { ${host} } from 'basalt-ui/controls'\n${CONTROLS_IMPORT}` +
        `export const C = () => <${host} label="L"><SelectFilter field={f} /></${host}>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('bound-control-outside-home')
  })

  it.each(['src/cbbi-panel.tsx', 'src/CbbiPanel.tsx'])(
    'does NOT flag %s — a panel body whose host lives in the parent, in either dialect',
    (filename) => {
      const { code, rules } = run(
        `${CONTROLS_IMPORT}export const C = () => <div><SelectFilter field={f} /></div>\n`,
        filename,
      )
      expect(code).toBe(0)
      expect(rules).not.toContain('bound-control-outside-home')
    },
  )

  // Both dialects need the leading SUBJECT, and neither is case-insensitive — `foopanel.tsx` is a
  // page module spelled without a separator, not a declaration.
  it.each(['src/foopanel.tsx', 'src/Panel.tsx'])('still flags %s', (filename) => {
    const { rules } = run(
      `${CONTROLS_IMPORT}export const C = () => <div><SelectFilter field={f} /></div>\n`,
      filename,
    )
    expect(rules).toContain('bound-control-outside-home')
  })

  it('honors a scoped theme-allow', () => {
    const { rules } = run(
      `${CONTROLS_IMPORT}export const C = () => (\n  <div>\n    {/* theme-allow bound-control-outside-home — a one-off embedded picker */}\n    <SelectFilter field={f} />\n  </div>\n)\n`,
    )
    expect(rules).not.toContain('bound-control-outside-home')
  })

  it('honors a theme-allow-file declaration', () => {
    const { rules } = run(
      `// theme-allow-file bound-control-outside-home — a legacy page, migrating next sprint\n` +
        `${CONTROLS_IMPORT}export const C = () => <div><SelectFilter field={f} /></div>\n`,
    )
    expect(rules).not.toContain('bound-control-outside-home')
  })

  // Provenance, the same test the raw-filter rules apply the other way round: a consumer's own
  // `SelectFilter` is not basalt's, and basalt has no claim over where it is written.
  it('does NOT flag a locally-defined SelectFilter', () => {
    const { code, rules } = run(
      `import { SelectFilter } from './my-filters'\n` +
        `export const C = () => <div><SelectFilter field={f} /></div>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('bound-control-outside-home')
  })

  it('flags an ALIASED basalt import with no home', () => {
    const { rules } = run(
      `import { SelectFilter as Picker } from 'basalt-ui/controls'\n` +
        `export const C = () => <div><Picker field={f} /></div>\n`,
    )
    expect(rules).toContain('bound-control-outside-home')
  })

  /**
   * The owner exemption needs the file to import NOTHING from `basalt-ui*` — see
   * `control-outside-home`'s copy for why. For THIS rule that makes the exemption reachable only
   * inside basalt's own `src/`, which is exactly where it is meant to apply: provenance already
   * requires a basalt import (or a relative one inside that tree), so a consumer file can never be
   * both the owner and a place this rule could fire.
   */
  it('DOES flag a consumer file that declares its own PanelRow', () => {
    const { rules } = run(
      `${CONTROLS_IMPORT}function PanelRow({ children }) {\n  return <div>{children}</div>\n}\n` +
        `export const C = () => <div><SelectFilter field={f} /></div>\n`,
    )
    expect(rules).toContain('bound-control-outside-home')
  })

  // Provenance on the HOME too, the same test `control-outside-home` applies: a consumer's own
  // `PanelRow` is a layout helper, not the aside's row primitive.
  it("still flags one inside a consumer's OWN PanelRow", () => {
    const { rules } = run(
      `import { SelectFilter } from 'basalt-ui/controls'\nimport { PanelRow } from './panel-row'\n` +
        `export const C = () => (\n  <PanelRow label="Scale">\n    <SelectFilter field={f} />\n  </PanelRow>\n)\n`,
    )
    expect(rules).toContain('bound-control-outside-home')
  })

  /**
   * `SliderControl` is NOT policed: it renders its own `PanelRow` and has no pill form at all
   * (`docs/ASIDE-SPEC.md` §3), so "this renders as a stray pill" is false for it and a `Section`
   * body is a legitimate place to write one. The plugin has no per-tag home set, so the honest fix
   * is dropping it from the policed set rather than giving it a private exemption.
   */
  it('does NOT flag a SliderControl in a Section body — it has no pill form', () => {
    const { code, rules } = run(
      `${ASIDE_IMPORT}${CONTROLS_IMPORT}export const C = () => (\n  <Section title="Weights">\n    <SliderControl field={f} label="Pi" />\n  </Section>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('bound-control-outside-home')
  })

  it('resolves a hoisted binding handed to a slot, like its siblings do', () => {
    const { rules } = run(
      `${ASIDE_IMPORT}${CONTROLS_IMPORT}const pills = <SelectFilter field={f} />\n` +
        `export const C = () => <PageBar filters={pills} />\n`,
    )
    expect(rules).not.toContain('bound-control-outside-home')
  })

  /**
   * …and one handed to a subtree home as its CHILDREN, which the ancestry walk cannot see: at the
   * `const` there is no `PageAside` above the node at all. The same `Program:exit` deferral the
   * slot lane uses, over the home's `{expr}` children instead of its attributes.
   */
  it('resolves a hoisted binding rendered as a PageAside CHILD', () => {
    const { code, rules } = run(
      `${ASIDE_IMPORT}${CONTROLS_IMPORT}const rows = <SelectFilter field={f} />\n` +
        `export const C = () => <PageAside title="Filters">{rows}</PageAside>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('bound-control-outside-home')
  })

  it('still flags the same hoisted binding under a bare Stack', () => {
    const { rules } = run(
      `import { Stack } from '@mantine/core'\n${CONTROLS_IMPORT}const rows = <SelectFilter field={f} />\n` +
        `export const C = () => <Stack>{rows}</Stack>\n`,
    )
    expect(rules).toContain('bound-control-outside-home')
  })

  /**
   * A slot written as an OBJECT SPREAD is the same home as a slot written as a JSXAttribute — and
   * `exactOptionalPropertyTypes` FORCES the spread, because `tabs={cond ? <X/> : undefined}` is not
   * assignable to an optional prop. Every control rule resolved homes off JSXAttribute nodes alone,
   * so a strict consumer's conditional slot was a false positive on a rule scheduled to go `error`.
   */
  describe('a slot written as an object spread', () => {
    it.each([
      '{...(cond && { tabs: <SelectFilter field={f} /> })}',
      '{...(cond ? { tabs: <SelectFilter field={f} /> } : {})}',
      '{...{ filters: <SelectFilter field={f} /> }}',
    ])('does NOT flag %s on a Section', (spread) => {
      const { code, rules } = run(
        `${ASIDE_IMPORT}${CONTROLS_IMPORT}export const C = ({ cond }) => (\n  <Section ${spread}>body</Section>\n)\n`,
      )
      expect(code).toBe(0)
      expect(rules).not.toContain('bound-control-outside-home')
    })

    it('does NOT flag a hoisted binding handed to a spread slot', () => {
      const { rules } = run(
        `${ASIDE_IMPORT}${CONTROLS_IMPORT}const tabs = <SelectFilter field={f} />\n` +
          `export const C = ({ cond }) => <Section {...(cond && { tabs })}>body</Section>\n`,
      )
      expect(rules).not.toContain('bound-control-outside-home')
    })

    // Deliberately narrow: only a Property reaching a JSXSpreadAttribute through object / `&&` /
    // `?:` nodes is claimed. A non-slot key, and an object built anywhere else, are not homes.
    it('still flags a non-slot key in the same spread', () => {
      const { rules } = run(
        `${ASIDE_IMPORT}${CONTROLS_IMPORT}export const C = ({ cond }) => (\n` +
          `  <Section {...(cond && { footer: <SelectFilter field={f} /> })}>body</Section>\n)\n`,
      )
      expect(rules).toContain('bound-control-outside-home')
    })

    it('still flags a slot-shaped object built inside a .map() callback', () => {
      const { rules } = run(
        `${CONTROLS_IMPORT}export const C = () => [1].map((k) => ({ tabs: <SelectFilter field={f} /> }))\n`,
      )
      expect(rules).toContain('bound-control-outside-home')
    })

    it('still flags one on a tag that is not a slot owner', () => {
      const { rules } = run(
        `import { Stack } from '@mantine/core'\n${CONTROLS_IMPORT}export const C = ({ cond }) => (\n` +
          `  <Stack {...(cond && { tabs: <SelectFilter field={f} /> })} />\n)\n`,
      )
      expect(rules).toContain('bound-control-outside-home')
    })
  })

  it('names PageBar as the reachable home for a shell-less app', () => {
    const { output } = run(
      `import { Stack } from '@mantine/core'\n${CONTROLS_IMPORT}` +
        `export const C = () => (\n  <Stack>\n    <SelectFilter field={f} />\n  </Stack>\n)\n`,
    )
    expect(output).toContain('PageBar` needs no `BasaltShell`')
  })
})

describe('basalt/control-size-literal', () => {
  // Same widening as `hand-rolled-filter` above, for the same reason: a slot is a slot in either
  // spelling, and the tier the message promises is mounted by the slot however it was written.
  it('flags a size prop inside a slot written as an object spread', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = ({ cond }) => (\n` +
        `  <Section {...(cond && { actions: <Button size="xs">Go</Button> })}>body</Section>\n)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('control-size-literal')
  })

  it.each(['size="xs"', 'w={200}', 'fullWidth', 'visibleFrom="sm"', 'hiddenFrom="sm"'])(
    'flags %s on an element inside a home slot',
    (prop) => {
      const { code, rules } = run(
        `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => <PageBar actions={<Button ${prop}>Go</Button>} />\n`,
      )
      expect(code).toBe(1)
      expect(rules).toContain('control-size-literal')
    },
  )

  it('flags it through a hoisted slot binding too', () => {
    const { rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}const acts = <Button size="xs">Go</Button>\n` +
        `export const C = () => <PageBar actions={acts} />\n`,
    )
    expect(rules).toContain('control-size-literal')
  })

  it("does NOT flag a size prop in a SettingsRow's control — the form tier is Mantine's md", () => {
    const { code, rules } = run(
      `${MANTINE_IMPORT}export const C = () => (\n  <SettingsRow label="L" control={<Button size="compact-sm">Go</Button>} />\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('control-size-literal')
  })

  /**
   * `ChartCard` is the one slot owner whose slot cannot mount the tier theme — it lives inside the
   * Mantine-free chart layer, so it writes `data-basalt-tier` by hand and the control there really
   * does have to state its own size. The rule fires on the `size` ATTRIBUTE and cannot tell a
   * correct `ctl` from the `xs` it exists to catch, so this is an exemption, not a waiver.
   */
  describe('ChartCard.actions — the one slot with no tier theme', () => {
    it('does NOT flag a size prop there', () => {
      const { code, rules } = run(
        `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => <ChartCard title="T" actions={<Button size="ctl">Go</Button>} />
`,
      )
      expect(code).toBe(0)
      expect(rules).not.toContain('control-size-literal')
    })

    // The owner test reads the IMPORTED name, so the alias every wrapper writes still resolves.
    it('does NOT flag it under an aliased ChartCard import', () => {
      const { rules } = run(
        `import { ChartCard as Card } from 'basalt-ui'
${MANTINE_IMPORT}` +
          `export const C = () => <Card title="T" actions={<Button size="xs">Go</Button>} />
`,
      )
      expect(rules).not.toContain('control-size-literal')
    })

    // The positive control: every OTHER home does mount the theme, so the rule still fires there.
    it('STILL flags the same prop in a Section slot', () => {
      const { code, rules } = run(
        `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => <Section title="T" actions={<Button size="xs">Go</Button>} />
`,
      )
      expect(code).toBe(1)
      expect(rules).toContain('control-size-literal')
    })

    // The exemption is keyed on the OWNER, and one hoisted binding can be handed to several — so it
    // holds only when EVERY home it reached is tierless. A last-writer-wins owner map made the
    // verdict depend on which attribute came later in the file: same code, opposite answer.
    it('STILL flags a hoisted binding shared with a Section slot — ChartCard last', () => {
      const { rules } = run(
        `${BASALT_IMPORT}${MANTINE_IMPORT}const acts = <Button size="xs">Go</Button>\n` +
          `export const C = () => (\n  <>\n    <Section title="S" actions={acts} />\n    <ChartCard title="T" actions={acts} />\n  </>\n)\n`,
      )
      expect(rules).toContain('control-size-literal')
    })

    it('STILL flags a hoisted binding shared with a Section slot — ChartCard first', () => {
      const { rules } = run(
        `${BASALT_IMPORT}${MANTINE_IMPORT}const acts = <Button size="xs">Go</Button>\n` +
          `export const C = () => (\n  <>\n    <ChartCard title="T" actions={acts} />\n    <Section title="S" actions={acts} />\n  </>\n)\n`,
      )
      expect(rules).toContain('control-size-literal')
    })

    it('does NOT flag a hoisted binding handed only to ChartCard', () => {
      const { code, rules } = run(
        `${BASALT_IMPORT}${MANTINE_IMPORT}const acts = <Button size="ctl">Go</Button>\n` +
          `export const C = () => <ChartCard title="T" actions={acts} />\n`,
      )
      expect(code).toBe(0)
      expect(rules).not.toContain('control-size-literal')
    })

    // A consumer's OWN `ChartCard` is not basalt's, so it is not a home at all and nothing fires —
    // the same provenance rule every other home tag follows.
    it('hand-rolled-filter is NOT exempted there — the tier is not what makes a filter wrong', () => {
      const { rules } = run(
        `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => <ChartCard title="T" actions={<Select data={[]} />} />
`,
      )
      expect(rules).toContain('hand-rolled-filter')
    })
  })

  it('does NOT flag a size prop on the HOME itself', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => <PageBar w={200} actions={<Button>Go</Button>} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('control-size-literal')
  })

  it("does NOT flag a size prop in a Section's CHILDREN", () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => (\n  <Section title="T">\n    <Button size="xs">Go</Button>\n  </Section>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('control-size-literal')
  })

  // The rule only reaches what the slot's own MantineThemeProvider re-tiers. An icon's `size` IS
  // its only sizing API and the slot theme cannot touch an SVG, so "drop the prop" produced a 24px
  // icon — on the shape the spec's own reference example writes.
  it("does NOT flag an icon's size inside a slot — the slot theme cannot size an SVG", () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}import { IconDownload } from '@tabler/icons-react'\n` +
        `export const C = () => (\n  <PageBar actions={<Button leftSection={<IconDownload size={14} />}>Export</Button>} />\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('control-size-literal')
  })

  it('does NOT flag a Badge or Loader size in a Section actions slot', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}import { Badge, Loader } from '@mantine/core'\n` +
        `export const C = ({ n, busy }) => (\n  <Section title="T" actions={[<Badge key="c" size="sm">{n}</Badge>, busy ? <Loader key="l" size={14} /> : null]} />\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('control-size-literal')
  })

  it("does NOT flag a Modal's own size, or an input's size inside that Modal", () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}import { Button, Modal, TextInput } from '@mantine/core'\n` +
        `export const C = () => (\n  <WidgetHeader\n    actions={\n      <>\n        <Button>New</Button>\n        <Modal opened size="lg">\n          <TextInput size="md" />\n        </Modal>\n      </>\n    }\n  />\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('control-size-literal')
  })

  it('STILL flags a raw filter size in the slot beside those exemptions', () => {
    const { rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => (\n  <PageBar filters={<Select size="xs" data={[]} />} />\n)\n`,
    )
    expect(rules).toContain('control-size-literal')
  })

  it('flags an ALIASED Mantine Button size in a slot', () => {
    const { rules } = run(
      `${BASALT_IMPORT}import { Button as Btn } from '@mantine/core'\n` +
        `export const C = () => <PageBar actions={<Btn size="xs">Go</Btn>} />\n`,
    )
    expect(rules).toContain('control-size-literal')
  })

  it("does NOT flag a size prop in a slot on a consumer's own Section", () => {
    const { code, rules } = run(
      `import { Section } from './layout/section'\n${MANTINE_IMPORT}` +
        `export const C = () => <Section actions={<Button size="sm">Go</Button>} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('control-size-literal')
  })

  it('honors a scoped theme-allow', () => {
    const { rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => (\n  <PageBar\n    actions={\n      <Button\n        // theme-allow control-size-literal — a deliberate 24px tag\n        size="xs"\n      >\n        Go\n      </Button>\n    }\n  />\n)\n`,
    )
    expect(rules).not.toContain('control-size-literal')
  })
})

// `control-size-literal`'s scope is a copy of the theme's own re-tiering list, because a plain-JS
// plugin shipped to consumers cannot import Mantine-coupled TS. This is the pin that makes the copy
// safe: a component added to (or dropped from) CTL_THEME without the rule following is a rule
// telling someone to drop a prop nothing else sets — or silently ignoring one that matters.
describe('CTL_THEME_TAGS ↔ CTL_THEME', () => {
  it('is exactly the component map the slot theme re-tiers', () => {
    expect([...(CTL_THEME_TAGS as Set<string>)].toSorted()).toEqual(
      Object.keys(CTL_THEME.components ?? {}).toSorted(),
    )
  })
})

describe('basalt/in-body-page-title', () => {
  it.each([1, 2])('flags <Title order={%i}> in the body', (order) => {
    const { code, rules } = run(`export const C = () => <Title order={${order}}>Page</Title>\n`)
    expect(code).toBe(1)
    expect(rules).toContain('in-body-page-title')
  })

  it('does NOT flag order={3} — a section heading', () => {
    const { code, rules } = run(`export const C = () => <Title order={3}>Section</Title>\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('in-body-page-title')
  })

  it.each(['Prose', 'ArticleLayout', 'Modal', 'Drawer'])(
    'does NOT flag one under %s — that is a document heading',
    (host) => {
      const { rules } = run(
        `export const C = () => <${host}><Title order={1}>Doc</Title></${host}>\n`,
      )
      expect(rules).not.toContain('in-body-page-title')
    },
  )

  it('does NOT flag one under a content/ path segment', () => {
    const { code, rules } = run(
      `export const C = () => <Title order={1}>Doc</Title>\n`,
      'content/page.tsx',
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('in-body-page-title')
  })

  it('honors a scoped theme-allow', () => {
    const { rules } = run(
      `// theme-allow in-body-page-title — a shell-less print view\nexport const C = () => <Title order={1}>Page</Title>\n`,
    )
    expect(rules).not.toContain('in-body-page-title')
  })

  // The narrowing that made C8 satisfiable — the law is "one NAME per page", and a name is
  // written in words. rb hit both of these shapes 24 times across 12 files with no legal fix.
  it('does NOT flag a nav-less detail route rendering the document title', () => {
    const { code, rules } = run(
      `export const C = ({ knot }) => <Title order={1}>{knot.title}</Title>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('in-body-page-title')
  })

  it("does NOT flag a card's hero VALUE at order={2}", () => {
    const { rules } = run(`export const C = ({ g }) => <Title order={2}>{RANK[g.rank]}</Title>\n`)
    expect(rules).not.toContain('in-body-page-title')
  })

  // The escape is the EXPRESSION, not the braces: a literal laundered through `{…}` is still a
  // static page name, and so is a substitution-free template.
  it.each([`{'Users'}`, '{`Users`}'])('still flags a laundered literal %s', (child) => {
    const { rules } = run(`export const C = () => <Title order={1}>${child}</Title>\n`)
    expect(rules).toContain('in-body-page-title')
  })

  it('still flags a name with a value interpolated into it', () => {
    const { rules } = run(`export const C = ({ n }) => <Title order={1}>Users {n}</Title>\n`)
    expect(rules).toContain('in-body-page-title')
  })

  it('still flags a name nested one element deep', () => {
    const { rules } = run(`export const C = () => <Title order={1}><span>Users</span></Title>\n`)
    expect(rules).toContain('in-body-page-title')
  })

  it('names PageTitle as the shell-less answer', () => {
    const { output } = run(`export const C = () => <Title order={1}>Page</Title>\n`)
    expect(output).toContain('<PageTitle>')
  })
})

describe('basalt/responsive-twin', () => {
  it('flags the same control mounted under visibleFrom and hiddenFrom', () => {
    const { code, rules } = run(
      `export const C = () => (\n  <div>\n    <SegmentedControl visibleFrom="sm" data={[]} />\n    <SegmentedControl hiddenFrom="sm" data={[]} />\n  </div>\n)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('responsive-twin')
  })

  it('flags it when the control sits inside each half rather than being it', () => {
    const { rules } = run(
      `export const C = () => (\n  <div>\n    <Group visibleFrom="sm"><ViewTabs field={f} /></Group>\n    <Stack hiddenFrom="sm"><ViewTabs field={f} /></Stack>\n  </div>\n)\n`,
    )
    expect(rules).toContain('responsive-twin')
  })

  it('does NOT flag two halves on DIFFERENT breakpoints', () => {
    // `code` is not asserted here: raw visibleFrom/hiddenFrom outside a shell home is its own,
    // unrelated finding (basalt/raw-breakpoint) — this test is only about responsive-twin's silence.
    const { rules } = run(
      `export const C = () => (\n  <div>\n    <SegmentedControl visibleFrom="sm" data={[]} />\n    <SegmentedControl hiddenFrom="md" data={[]} />\n  </div>\n)\n`,
    )
    expect(rules).not.toContain('responsive-twin')
  })

  it('does NOT flag a pair holding DIFFERENT controls', () => {
    const { rules } = run(
      `export const C = () => (\n  <div>\n    <SegmentedControl visibleFrom="sm" data={[]} />\n    <Select hiddenFrom="sm" data={[]} />\n  </div>\n)\n`,
    )
    expect(rules).not.toContain('responsive-twin')
  })

  // Same fixture caveat as control-outside-home's owner test: the local `ViewTabs` name is itself a
  // `shadow-basalt-export` finding, so only this rule's silence is asserted.
  it('does NOT flag the module that DEFINES a basalt control — the CSS swap lives there', () => {
    const { rules } = run(
      `export function ViewTabs() {\n  return (\n    <div>\n      <SegmentedControl visibleFrom="sm" data={[]} />\n      <SegmentedControl hiddenFrom="sm" data={[]} />\n    </div>\n  )\n}\n`,
    )
    expect(rules).not.toContain('responsive-twin')
  })

  // The owner exemption's second half, the same predicate its two siblings apply: a consumer file
  // that names a helper `PanelRow` and imports basalt is consuming basalt, not defining a control.
  it('DOES flag a file that declares its own PanelRow but imports basalt-ui', () => {
    const { rules } = run(
      `import { Section } from 'basalt-ui'\n` +
        `function PanelRow({ children }) {\n  return <div>{children}</div>\n}\n` +
        `export const C = () => (\n  <div>\n    <SegmentedControl visibleFrom="sm" data={[]} />\n    <SegmentedControl hiddenFrom="sm" data={[]} />\n  </div>\n)\n`,
    )
    expect(rules).toContain('responsive-twin')
  })

  it('honors a scoped theme-allow', () => {
    const { rules } = run(
      `export const C = () => (\n  <div>\n    <SegmentedControl visibleFrom="sm" data={[]} />\n    {/* theme-allow responsive-twin — two genuinely different data sets */}\n    <SegmentedControl hiddenFrom="sm" data={[]} />\n  </div>\n)\n`,
    )
    expect(rules).not.toContain('responsive-twin')
  })
})

describe('basalt/search-literal-link', () => {
  const NAV = (search: string) =>
    `export const nav = defineNav({\n  sections: [\n    { id: 'a', label: 'A', link: linkOptions({ to: '/dashboard'${search} }) },\n  ],\n})\n`

  it('flags a `search` object literal inside defineNav', () => {
    const { code, rules } = run(NAV(", search: { window: '30d' }"), 'nav.ts')
    expect(code).toBe(1)
    expect(rules).toContain('search-literal-link')
  })

  it('flags it inside navGroup too', () => {
    const { rules } = run(
      `export const g = navGroup({ id: 'g', label: 'G' }, [\n  { id: 'x', label: 'X', link: linkOptions({ to: '/d', search: { window: '30d' } }) },\n])\n`,
      'nav.ts',
    )
    expect(rules).toContain('search-literal-link')
  })

  it('does NOT flag `search: store.linkSearch` passed by reference', () => {
    const { code, rules } = run(NAV(', search: dashboardFilters.linkSearch'), 'nav.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('search-literal-link')
  })

  it('does NOT flag a linkOptions literal OUTSIDE a nav definition', () => {
    const { code, rules } = run(
      `export const target = linkOptions({ to: '/d', search: { window: '30d' } })\n`,
      'nav.ts',
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('search-literal-link')
  })

  it('honors a scoped theme-allow', () => {
    const { rules } = run(
      `export const nav = defineNav({\n  sections: [\n    {\n      id: 'a',\n      label: 'A',\n      link: linkOptions({\n        to: '/d',\n        // theme-allow search-literal-link — a fixed report link, deliberately pinned\n        search: { window: '30d' },\n      }),\n    },\n  ],\n})\n`,
      'nav.ts',
    )
    expect(rules).not.toContain('search-literal-link')
  })
})

describe('basalt/use-search-from-literal', () => {
  it('flags useSearch({ from: <literal> })', () => {
    const { code, rules } = run(
      `export const useRange = () => useSearch({ from: '/dashboard' })\n`,
      'hooks.ts',
    )
    expect(code).toBe(1)
    expect(rules).toContain('use-search-from-literal')
  })

  it('does NOT flag useSearch({ strict: false })', () => {
    const { code, rules } = run(
      `export const useRange = () => useSearch({ strict: false })\n`,
      'hooks.ts',
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('use-search-from-literal')
  })

  it('honors a scoped theme-allow', () => {
    const { rules } = run(
      `export const useRange = () =>\n  useSearch({\n    // theme-allow use-search-from-literal — a route-owned loader, never rendered elsewhere\n    from: '/dashboard',\n  })\n`,
      'hooks.ts',
    )
    expect(rules).not.toContain('use-search-from-literal')
  })
})

// ── raw-scroll-container — the C7 widening ───────────────────────────────────

describe('basalt/raw-scroll-container — the home widening (C7)', () => {
  it('flags overflowX inside a home slot', () => {
    const { rules } = run(
      `${BASALT_IMPORT}export const C = () => <PageBar filters={<div style={{ overflowX: 'auto' }} />} />\n`,
    )
    expect(rules).toContain('raw-scroll-container')
  })

  // The C7 widening is about a sideways-scrolling row of CONTROLS, which only ever lives in a slot.
  // Counting the body made every wide table and every horizontally scrolling code block on a page
  // an `error` carrying that message — the exact pattern this rule's own comment calls legitimate.
  it('does NOT flag overflowX in a Section BODY — page content, not a control row', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}export const C = () => (\n  <Section title="Raw rows">\n    <div style={{ overflowX: 'scroll' }}>\n      <table />\n    </div>\n  </Section>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('raw-scroll-container')
  })

  it('does NOT flag <ScrollArea scrollbars="x"> around a wide table in a ChartCard body', () => {
    const { rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => (\n  <ChartCard title="T">\n    <ScrollArea scrollbars="x">\n      <table />\n    </ScrollArea>\n  </ChartCard>\n)\n`,
    )
    expect(rules).not.toContain('raw-scroll-container')
  })

  it("does NOT flag a slot on a consumer's own Section — not a basalt home", () => {
    const { code, rules } = run(
      `import { Section } from './layout/section'\n${MANTINE_IMPORT}` +
        `export const C = () => <Section actions={<ScrollArea scrollbars="x" />} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('raw-scroll-container')
  })

  it("does NOT flag a consumer's own ScrollArea in a basalt slot", () => {
    const { rules } = run(
      `${BASALT_IMPORT}import { ScrollArea } from './ui/scroll-area'\n` +
        `export const C = () => <PageBar filters={<ScrollArea scrollbars="x" />} />\n`,
    )
    expect(rules).not.toContain('raw-scroll-container')
  })

  it('flags <ScrollArea scrollbars="x"> inside a home slot', () => {
    const { rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => <PageBar filters={<ScrollArea scrollbars="x" />} />\n`,
    )
    expect(rules).toContain('raw-scroll-container')
  })

  // The original doctrine, unchanged: a horizontal bar outside a home reserves no gutter width, so
  // a code block or a pinned-column table stays its own legitimate pattern.
  it('does NOT flag overflowX outside a home', () => {
    const { code, rules } = run(`const s = { overflowX: 'auto' }\n`, 'lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('raw-scroll-container')
  })

  it('does NOT flag <ScrollArea scrollbars="x"> outside a home', () => {
    const { code, rules } = run(
      `${MANTINE_IMPORT}export const C = () => <ScrollArea scrollbars="x" />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('raw-scroll-container')
  })

  it('honors a scoped theme-allow on the widened half', () => {
    const { rules } = run(
      `${BASALT_IMPORT}export const C = () => (\n  <Section\n    title="T"\n    actions={\n      // theme-allow raw-scroll-container — a pinned-column table owns its own scroll node\n      <div style={{ overflowX: 'auto' }} />\n    }\n  />\n)\n`,
    )
    expect(rules).not.toContain('raw-scroll-container')
  })
})

// ── shadow-basalt-export — the rename table ──────────────────────────────────

describe('basalt/shadow-basalt-export — SHADOW_ALIASES', () => {
  it.each([
    ['PageHeader', 'PageBar'],
    ['WindowSelector', 'RangeFilter'],
    ['SectionTitle', 'Section'],
    ['RefreshButton', 'SyncButton'],
    ['HeroCard', 'StatCard'],
  ])('flags a local %s and names %s as what it forks', (local, canonical) => {
    const { code, rules, output } = run(`export function ${local}() {\n  return null\n}\n`)
    expect(code).toBe(1)
    expect(rules).toContain('shadow-basalt-export')
    expect(output).toContain(canonical)
  })

  it('flags the const form too', () => {
    const { rules } = run(`export const FilterBar = () => null\n`)
    expect(rules).toContain('shadow-basalt-export')
  })

  it('does NOT flag a name that is neither an export nor an alias', () => {
    const { code, rules } = run(`export const RangePickerish = () => null\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('shadow-basalt-export')
  })

  it('is waivable with a scoped theme-allow', () => {
    const { rules } = run(
      `// theme-allow shadow-basalt-export — a marketing hero, unrelated to StatCard\nexport const HeroCard = () => null\n`,
    )
    expect(rules).not.toContain('shadow-basalt-export')
  })
})

/**
 * The provenance half of the alias table: a file that COMPOSES the export it renames is a wrapper,
 * not a fork. argo's three hero cards each imported `StatCard`, wrapped it, and each took a warn
 * telling them to import the thing they were already importing.
 *
 * Both directions are asserted, because the exemption is only worth having if the rule still fires
 * WITHOUT the import — a wrapper is evidence, and silence on every `HeroCard` in the repo would be
 * the rule switching itself off.
 */
describe('basalt/shadow-basalt-export — an alias that composes what it renames', () => {
  it('fires on a HeroCard that does not import StatCard', () => {
    const { rules, output } = run(
      `export function HeroCard() {\n  return null\n}\n`,
      'src/hero-card.tsx',
    )
    expect(rules).toContain('shadow-basalt-export')
    expect(output).toContain('StatCard')
  })

  it('is silent on a HeroCard that composes the imported StatCard', () => {
    const { code, rules } = run(
      `import { StatCard } from 'basalt-ui'\n` +
        `export function HeroCard() {\n  return <StatCard title="x" value="1" />\n}\n`,
      'src/hero-card.tsx',
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('shadow-basalt-export')
  })

  // The provenance test reads the IMPORTED name, not the local one — `StatCard as BaseStatCard` is
  // the canonical way a wrapper avoids shadowing its own import, and a local-name set would answer
  // `BaseStatCard` and miss it.
  it('is silent when the composed export is imported under an alias', () => {
    const { rules } = run(
      `import { StatCard as BaseStatCard } from 'basalt-ui'\n` +
        `export function HeroCard() {\n  return <BaseStatCard title="x" value="1" />\n}\n`,
      'src/hero-card.tsx',
    )
    expect(rules).not.toContain('shadow-basalt-export')
  })

  it('is silent from a basalt SUBPATH too, not just the root barrel', () => {
    const { rules } = run(
      `import { RangeFilter } from 'basalt-ui/controls'\n` +
        `export function WindowSelector() {\n  return <RangeFilter field={{}} />\n}\n`,
      'src/window-selector.tsx',
    )
    expect(rules).not.toContain('shadow-basalt-export')
  })

  // Importing SOMETHING from basalt is not the exemption — importing the thing you renamed is.
  it('still fires when the file imports a DIFFERENT basalt export', () => {
    const { rules } = run(
      `import { Section } from 'basalt-ui'\n` +
        `export function HeroCard() {\n  return <Section title="x" />\n}\n`,
      'src/hero-card.tsx',
    )
    expect(rules).toContain('shadow-basalt-export')
  })

  // The COLLISION half is deliberately not exempted: a local `StatCard` beside an
  // `import { StatCard as Base }` kept the name AND a piece of the original, which is the fork
  // shape this rule most wants to see.
  it('still fires on a name COLLISION even when the export is imported under an alias', () => {
    const { rules } = run(
      `import { StatCard as Base } from 'basalt-ui'\n` +
        `export function StatCard() {\n  return <Base title="x" value="1" />\n}\n`,
      'src/stat-card.tsx',
    )
    expect(rules).toContain('shadow-basalt-export')
  })

  // COMPOSITION, not import. A type-only import is erased at compile time, so the shape a
  // props-copying fork actually writes — `ComponentProps<typeof StatCard>` off an
  // `import type` — composes nothing and used to exempt the whole file.
  it('still fires on a type-only import of the export it renames', () => {
    const { rules } = run(
      `import type { StatCard } from 'basalt-ui'\n` +
        `export function HeroCard() {\n  return <div />\n}\n`,
      'src/hero-card.tsx',
    )
    expect(rules).toContain('shadow-basalt-export')
  })

  it('still fires on an inline `type` specifier', () => {
    const { rules } = run(
      `import { type StatCard } from 'basalt-ui'\n` +
        `export function HeroCard() {\n  return <div />\n}\n`,
      'src/hero-card.tsx',
    )
    expect(rules).toContain('shadow-basalt-export')
  })

  // `typeof StatCard` is a `TSTypeQuery` around a plain Identifier, so a VALUE import used only in
  // a type position has to be rejected too — otherwise the props-copying fork just drops `type`.
  it('still fires when a value import is only used in a type position', () => {
    const { rules } = run(
      `import { StatCard } from 'basalt-ui'\n` +
        `type P = { card: typeof StatCard }\n` +
        `export function HeroCard(props: P) {\n  return <div>{String(props)}</div>\n}\n`,
      'src/hero-card.tsx',
    )
    expect(rules).toContain('shadow-basalt-export')
  })

  it('still fires on a dead import left behind after the body was re-rolled', () => {
    const { rules } = run(
      `import { StatCard } from 'basalt-ui'\n` +
        `export function HeroCard() {\n  return <div />\n}\n`,
      'src/hero-card.tsx',
    )
    expect(rules).toContain('shadow-basalt-export')
  })

  // A JSX tag is not the only way to compose: a wrapper that hands the component on as a prop or to
  // `createElement` composes it just as much, and a JSX-only test would report both.
  it('is silent when the import is passed on as a prop rather than rendered', () => {
    const { code, rules } = run(
      `import { StatCard } from 'basalt-ui'\n` +
        `export function HeroCard() {\n  return <Slot component={StatCard} />\n}\n`,
      'src/hero-card.tsx',
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('shadow-basalt-export')
  })
})

// ── SURFACES ↔ the plugin registry ───────────────────────────────────────────

describe('PLUGIN_RULE_ID_LIST ↔ the plugin', () => {
  // surfaces.ts cannot import the plugin (it is dependency-free by contract, and the plugin is a
  // standalone .js loaded out of a consumer's node_modules), so the list is hand-maintained and
  // THIS is the gate that keeps it honest.
  it('is exactly the plugin s registered rule ids', () => {
    expect([...PLUGIN_RULE_ID_LIST].toSorted()).toEqual(Object.keys(basaltPlugin.rules).toSorted())
  })

  it('maps every plugin rule to exactly one surface', () => {
    const owners = new Map<string, string[]>()
    for (const [key, spec] of Object.entries(SURFACES)) {
      if (spec.kind !== 'doctrine') continue
      for (const id of spec.pluginRules) owners.set(id, [...(owners.get(id) ?? []), key])
    }
    for (const id of PLUGIN_RULE_ID_LIST) {
      expect([id, owners.get(id)?.length ?? 0]).toEqual([id, 1])
    }
    // …and no surface claims an id the plugin does not register (the type already forbids it; this
    // catches a list entry deleted without its surface).
    for (const id of owners.keys()) {
      expect([id, (PLUGIN_RULE_ID_LIST as readonly string[]).includes(id)]).toEqual([id, true])
    }
  })

  it("puts the shell rule on the root barrel's surface (wave 6)", () => {
    expect(SURFACES['.'].pluginRules).toContain('hand-rolled-shell')
  })

  it('gives ./controls the control-tier rules', () => {
    expect([...SURFACES['./controls'].pluginRules].toSorted()).toEqual([
      'bound-control-outside-home',
      'control-outside-home',
      'control-size-literal',
      'hand-rolled-filter',
      'responsive-twin',
    ])
  })
})

// ── query-fn-unwrap (F5) ─────────────────────────────────────────────────────

describe('basalt/query-fn-unwrap', () => {
  const IMPORT = `import { unwrap } from 'basalt-ui/query'\n`

  it('flags a queryFn that fetches with no unwrap', () => {
    const { code, rules } = run(
      `${IMPORT}export const o = { queryKey: ['t'], queryFn: () => fetch('/api/t') }\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('query-fn-unwrap')
  })

  it('flags the async .json() form', () => {
    const { code, rules } = run(
      `${IMPORT}export const o = {\n  queryKey: ['t'],\n` +
        `  queryFn: async () => (await fetch('/api/t')).json(),\n}\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('query-fn-unwrap')
  })

  it('does NOT flag a queryFn that wraps the call', () => {
    const { code, rules } = run(
      `${IMPORT}export const o = { queryKey: ['t'], queryFn: () => unwrap(fetch('/api/t')) }\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('query-fn-unwrap')
  })

  it('does NOT flag a queryFn with no fetch in it', () => {
    const { code, rules } = run(
      `${IMPORT}export const o = { queryKey: ['t'], queryFn: () => client.t.get() }\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('query-fn-unwrap')
  })

  // The scope gate: with no basalt-ui/query import this is an opinion about `fetch`, which basalt
  // does not have.
  it('does NOT flag a file that never imports basalt-ui/query', () => {
    const { code, rules } = run(
      `export const o = { queryKey: ['t'], queryFn: () => fetch('/api/t') }\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('query-fn-unwrap')
  })

  // The documented blind spot — a reference, not a function literal. Pinned so a widening moves it.
  it('does NOT see a queryFn passed as a reference', () => {
    const { code, rules } = run(
      `${IMPORT}const load = () => fetch('/api/t')\n` +
        `export const o = { queryKey: ['t'], queryFn: load }\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('query-fn-unwrap')
  })

  it('flags a fetching queryFn in a file importing the root barrel', () => {
    const { code, rules } = run(
      `import { unwrap } from 'basalt-ui'\nexport const o = { queryKey: ['t'], queryFn: () => fetch('/api/t') }\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('query-fn-unwrap')
  })

  it('honours a theme-allow naming the rule', () => {
    const { code, rules } = run(
      `${IMPORT}export const o = {\n  queryKey: ['t'],\n` +
        `  // theme-allow query-fn-unwrap — raw Response is the point, this reads a blob\n` +
        `  queryFn: () => fetch('/api/t'),\n}\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('query-fn-unwrap')
  })
})

// ── forms-field-key ──────────────────────────────────────────────────────────

describe('basalt/forms-field-key', () => {
  const FORMS = `import { inputProps } from 'basalt-ui/forms'\n`

  it('flags a spread inputProps() with no sibling key', () => {
    const { code, rules, output } = run(
      `${FORMS}export const C = () => <TextInput {...inputProps(form, 'email')} />\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('forms-field-key')
    expect(output).toContain('no sibling `key`')
  })

  it('does NOT flag the documented two-call idiom', () => {
    const { code, rules } = run(
      `import { fieldKey, inputProps } from 'basalt-ui/forms'\n` +
        `export const C = () => <TextInput key={fieldKey(form, 'e')} {...inputProps(form, 'e')} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('forms-field-key')
  })

  // An `inputProps` a consumer wrote themselves is not basalt's — the same provenance gate the
  // control and chart rules take, one lane over.
  it('does NOT flag a same-named helper imported from somewhere else', () => {
    const { code, rules } = run(
      `import { inputProps } from './my-helpers'\n` +
        `export const C = () => <TextInput {...inputProps(form, 'email')} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('forms-field-key')
  })

  it('resolves an aliased import — `inputProps as f` is still inputProps', () => {
    const { code, rules } = run(
      `import { inputProps as f } from 'basalt-ui/forms'\n` +
        `export const C = () => <TextInput {...f(form, 'email')} />\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('forms-field-key')
  })

  // The second message: reported whether or not the element carries a key — the remedy is the
  // rename, never an added attribute.
  it('flags a spread field() even when the element already has a key', () => {
    const { code, rules } = run(
      `import { field } from 'basalt-ui/forms'\n` +
        `export const C = () => <TextInput key="e" {...field(form, 'email')} />\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('forms-field-key')
  })

  /**
   * The message has to state the version it is RUNNING at, not the one the deprecation was
   * scheduled in. It used to say the alias "still bundles `key` INTO the returned object" and "is
   * removed in 1.29.0" while running AT 1.29.x, where `field` no longer exists at all — a consumer
   * reading it concluded nothing was broken, on a call site that does not compile.
   */
  it('says `field` no longer exists, not that it is merely deprecated', () => {
    const { output } = run(
      `import { field } from 'basalt-ui/forms'\n` +
        `export const C = () => <TextInput {...field(form, 'email')} />\n`,
    )
    expect(output).toContain('NO LONGER EXISTS')
    expect(output).toContain('does not compile')
    expect(output).not.toContain('still bundles')
  })

  it('honours a theme-allow naming the rule', () => {
    const { code, rules } = run(
      `${FORMS}export const C = () => (\n` +
        `  // theme-allow forms-field-key — this input is remounted by its parent\n` +
        `  <TextInput {...inputProps(form, 'email')} />\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('forms-field-key')
  })

  // The autofix has to produce COMPILING code: an inserted `fieldKey(…)` with no import is a worse
  // outcome than the missing key it replaced.
  it('autofixes the key in, with the same arguments, and adds fieldKey to the import once', () => {
    const source =
      `${FORMS}export const C = () => (\n` +
      `  <form>\n` +
      `    <TextInput {...inputProps(form, 'email')} label="Email" />\n` +
      `    <TextInput {...inputProps(form, 'name')} />\n` +
      `  </form>\n)\n`
    writeFileSync(resolve(dir, 'fixture.tsx'), source)
    Bun.spawnSync([OXLINT_BIN, '-c', '.oxlintrc.json', '--fix', 'fixture.tsx'], { cwd: dir })
    const fixed = readFileSync(resolve(dir, 'fixture.tsx'), 'utf8')
    expect(fixed).toContain(`import { inputProps, fieldKey } from 'basalt-ui/forms'`)
    expect(fixed).toContain(`key={fieldKey(form, 'email')} {...inputProps(form, 'email')}`)
    expect(fixed).toContain(`key={fieldKey(form, 'name')} {...inputProps(form, 'name')}`)
    // Once, not twice: two overlapping edits to one import declaration would drop one of them.
    expect(fixed.match(/fieldKey,|, fieldKey/g)).toHaveLength(1)
  })

  it('does not re-add fieldKey when it is already imported', () => {
    const source =
      `import { fieldKey, inputProps } from 'basalt-ui/forms'\n` +
      `export const C = () => <TextInput {...inputProps(form, 'email')} />\n`
    writeFileSync(resolve(dir, 'fixture.tsx'), source)
    Bun.spawnSync([OXLINT_BIN, '-c', '.oxlintrc.json', '--fix', 'fixture.tsx'], { cwd: dir })
    const fixed = readFileSync(resolve(dir, 'fixture.tsx'), 'utf8')
    expect(fixed).toContain(`import { fieldKey, inputProps } from 'basalt-ui/forms'`)
    expect(fixed).toContain(`key={fieldKey(form, 'email')}`)
  })
})

// ── raw-breakpoint ────────────────────────────────────────────────────────────

describe('basalt/raw-breakpoint', () => {
  it('flags a responsive-object prop on an imported Mantine component', () => {
    const { rules } = run(
      `import { SimpleGrid } from '@mantine/core'\n` +
        `export const C = () => <SimpleGrid cols={{ base: 1, sm: 2 }} />\n`,
    )
    expect(rules).toContain('raw-breakpoint')
  })

  it('flags a responsive object nested one level down (Mantine AppShell idiom)', () => {
    const { rules } = run(
      `import { AppShell } from '@mantine/core'\n` +
        `export const C = () => <AppShell footer={{ height: { base: 60, sm: 0 } }}>hi</AppShell>\n`,
    )
    expect(rules).toContain('raw-breakpoint')
  })

  it('flags a responsive object behind a same-file const binding', () => {
    const { rules } = run(
      `import { SimpleGrid } from '@mantine/core'\n` +
        `const responsiveCols = { base: 1, sm: 2 }\n` +
        `export const C = () => <SimpleGrid cols={responsiveCols} />\n`,
    )
    expect(rules).toContain('raw-breakpoint')
  })

  // The nested-property half: a property VALUE that is itself an Identifier must resolve through
  // the same-file const map, exactly as the attribute's own top-level value already does.
  it('flags a responsive object behind a const used as a nested property value', () => {
    const { rules } = run(
      `import { AppShell } from '@mantine/core'\n` +
        `const h = { base: 60, sm: 0 }\n` +
        `export const C = () => <AppShell footer={{ height: h }}>hi</AppShell>\n`,
    )
    expect(rules).toContain('raw-breakpoint')
  })

  // A name declared twice in the file has no single binding without a scope manager, so it is
  // dropped rather than resolved last-declaration-wins — the outer (non-responsive) `cols` the JSX
  // actually references must not be flagged via the inner function's responsive one.
  it('does NOT flag a name redeclared in the file — an ambiguous binding is skipped, not guessed', () => {
    const { rules } = run(
      `import { SimpleGrid } from '@mantine/core'\n` +
        `const cols = { fixed: 2 }\n` +
        `function Other() {\n  const cols = { base: 1, sm: 2 }\n  return null\n}\n` +
        `export const C = () => <SimpleGrid cols={cols} />\n`,
    )
    expect(rules).not.toContain('raw-breakpoint')
  })

  it('does NOT flag a fixed cols on the same component', () => {
    const { rules } = run(
      `import { SimpleGrid } from '@mantine/core'\n` +
        `export const C = () => <SimpleGrid cols={2} />\n`,
    )
    expect(rules).not.toContain('raw-breakpoint')
  })

  it('does NOT flag an object prop on a component never imported from @mantine/*', () => {
    const { rules } = run(`export const C = () => <WidgetGrid cols={{ base: 1, sm: 2 }} />\n`)
    expect(rules).not.toContain('raw-breakpoint')
  })

  // The recipe's px keys are CONTAINER_CLASSES written out by hand in two places — the plugin
  // (plain JS, cannot import TS source) and MIGRATING's rule entry. Retuning a class must fail here.
  describe('recipe px literals ↔ CONTAINER_CLASSES', () => {
    const boundaries = new Set<number>(Object.values(CONTAINER_CLASSES).filter((px) => px > 0))
    const pxLiterals = (text: string) => [...text.matchAll(/(\d+)px/g)].map((m) => Number(m[1]))

    it('every px key in the rule messages is a CONTAINER_CLASSES boundary', () => {
      const found = pxLiterals(RAW_BREAKPOINT_RECIPE as string)
      expect(found.length).toBeGreaterThan(0)
      for (const px of found) expect([px, boundaries.has(px)]).toEqual([px, true])
    })

    it("every px value and the class table in MIGRATING's raw-breakpoint entry match", () => {
      const migrating = readFileSync(resolve(import.meta.dir, '../MIGRATING.md'), 'utf8')
      const start = migrating.indexOf('### `basalt/raw-breakpoint`')
      expect(start).toBeGreaterThan(-1)
      const end = migrating.indexOf('\n### ', start + 1)
      const section = migrating.slice(start, end === -1 ? undefined : end)
      for (const px of pxLiterals(section)) expect([px, boundaries.has(px)]).toEqual([px, true])
      const { compact, regular, wide } = CONTAINER_CLASSES
      expect(section).toContain(`compact ${compact} · regular ${regular} · wide ${wide}`)
    })
  })

  // The sanctioned answer, read from @mantine/core 9.3 source: SimpleGrid type="container" writes
  // each key verbatim as `@container simple-grid (min-width: <key>)`, Grid type="container" only
  // goes container WITH a `breakpoints` map. Exempt exactly where Mantine resolves the object.
  describe('Mantine type="container" grids', () => {
    const grid = (jsx: string) =>
      run(`import { Grid, SimpleGrid } from '@mantine/core'\nexport const C = () => ${jsx}\n`)
    const CONTAINER_MESSAGE = /Theme breakpoint name under type="container"/

    it('does NOT flag a px-keyed container SimpleGrid (the recipe)', () => {
      expect(
        grid(`<SimpleGrid type="container" cols={{ base: 1, '480px': 2, '800px': 3 }} />`).rules,
      ).not.toContain('raw-breakpoint')
    })

    it('does NOT flag CONTAINER_KEYS computed keys (named, aliased, namespace)', () => {
      const keyed = (imp: string, key: string) =>
        run(
          `import { SimpleGrid } from '@mantine/core'\n${imp}\n` +
            `export const C = () => <SimpleGrid type="container" cols={{ base: 1, [${key}.regular]: 2, [${key}.wide]: 3 }} />\n`,
        ).rules
      expect(
        keyed(`import { CONTAINER_KEYS } from 'basalt-ui/tokens'`, 'CONTAINER_KEYS'),
      ).not.toContain('raw-breakpoint')
      expect(keyed(`import { CONTAINER_KEYS as CQ } from 'basalt-ui/tokens'`, 'CQ')).not.toContain(
        'raw-breakpoint',
      )
      expect(
        keyed(`import * as tokens from 'basalt-ui/tokens'`, 'tokens.CONTAINER_KEYS'),
      ).not.toContain('raw-breakpoint')
    })

    it('does NOT flag a lone `base` under type="container"', () => {
      expect(grid(`<SimpleGrid type="container" cols={{ base: 2 }} />`).rules).not.toContain(
        'raw-breakpoint',
      )
    })

    it('flags a theme-named key on a container SimpleGrid — Mantine emits a dead (min-width: sm)', () => {
      const { rules, output } = grid(`<SimpleGrid type="container" cols={{ base: 1, sm: 2 }} />`)
      expect(rules).toContain('raw-breakpoint')
      expect(CONTAINER_MESSAGE.test(output)).toBe(true)
    })

    it('still flags type="media" (and a dynamic type) with the viewport message', () => {
      for (const type of [`"media"`, `{kind}`]) {
        const { rules, output } = grid(`<SimpleGrid type=${type} cols={{ base: 1, sm: 2 }} />`)
        expect(rules).toContain('raw-breakpoint')
        expect(CONTAINER_MESSAGE.test(output)).toBe(false)
      }
    })

    it('does NOT flag Grid.Col spans under a container Grid with a breakpoints map', () => {
      const src =
        `<Grid type="container" breakpoints={{ xs: '240px', sm: '480px' }}>\n` +
        `  {items.map((i) => <Grid.Col key={i} span={{ base: 12, sm: 6 }}>x</Grid.Col>)}\n` +
        `</Grid>`
      expect(grid(src).rules).not.toContain('raw-breakpoint')
    })

    it('flags Grid.Col spans under a container Grid with NO breakpoints — Mantine falls back to media', () => {
      const { rules, output } = grid(
        `<Grid type="container"><Grid.Col span={{ base: 12, sm: 6 }}>x</Grid.Col></Grid>`,
      )
      expect(rules).toContain('raw-breakpoint')
      expect(CONTAINER_MESSAGE.test(output)).toBe(true)
    })

    it('reports a const-extracted theme-keyed object on a container SimpleGrid — still a dead query', () => {
      const { rules, output } = run(
        `import { SimpleGrid } from '@mantine/core'\n` +
          `const cols = { base: 1, sm: 2 }\n` +
          `export const C = () => <SimpleGrid type="container" cols={cols} />\n`,
      )
      expect(rules).toContain('raw-breakpoint')
      expect(CONTAINER_MESSAGE.test(output)).toBe(true)
    })

    // Grid goes container only on a truthy map, and an empty one emits no query — so the exemption
    // needs a map that statically resolves to a non-empty object, not the attribute's presence.
    it.each([
      ['undefined', `breakpoints={undefined}`, ''],
      ['an empty object', `breakpoints={{}}`, ''],
      ['an unresolvable identifier', `breakpoints={imported}`, `import { imported } from './bp'\n`],
    ])('flags Grid.Col spans under a container Grid whose breakpoints is %s', (_, bp, extra) => {
      const { rules, output } = run(
        `import { Grid } from '@mantine/core'\n${extra}` +
          `export const C = () => <Grid type="container" ${bp}><Grid.Col span={{ base: 12, sm: 6 }}>x</Grid.Col></Grid>\n`,
      )
      expect(rules).toContain('raw-breakpoint')
      expect(CONTAINER_MESSAGE.test(output)).toBe(true)
    })

    it('does NOT flag Grid.Col spans under a container Grid whose breakpoints is a same-file const', () => {
      const { rules } = run(
        `import { Grid } from '@mantine/core'\n` +
          `const bp = { xs: '240px', sm: '480px', md: '800px', lg: '800px', xl: '800px' }\n` +
          `export const C = () => <Grid type="container" breakpoints={bp}><Grid.Col span={{ base: 12, sm: 6 }}>x</Grid.Col></Grid>\n`,
      )
      expect(rules).not.toContain('raw-breakpoint')
    })

    // The shipped map is the one IMPORTED map trusted: its value is known, so five route files no
    // longer copy the same literal. Provenance-gated on `basalt-ui/tokens`, alias-safe.
    const SPAN = `<Grid.Col span={{ base: 12, sm: 6 }}>x</Grid.Col>`
    it.each([
      [
        'the named import',
        `import { CONTAINER_GRID_BREAKPOINTS } from 'basalt-ui/tokens'`,
        'CONTAINER_GRID_BREAKPOINTS',
      ],
      [
        'an aliased import',
        `import { CONTAINER_GRID_BREAKPOINTS as bp } from 'basalt-ui/tokens'`,
        'bp',
      ],
      [
        'a same-file alias of it',
        `import { CONTAINER_GRID_BREAKPOINTS } from 'basalt-ui/tokens'\nconst bp = CONTAINER_GRID_BREAKPOINTS`,
        'bp',
      ],
    ])(
      'does NOT flag Grid.Col spans under breakpoints={CONTAINER_GRID_BREAKPOINTS} (%s)',
      (_, imp, ref) => {
        const { rules } = run(
          `import { Grid } from '@mantine/core'\n${imp}\n` +
            `export const C = () => <Grid type="container" breakpoints={${ref}}>${SPAN}</Grid>\n`,
        )
        expect(rules).not.toContain('raw-breakpoint')
      },
    )

    it.each([
      ['another module', `import { CONTAINER_GRID_BREAKPOINTS } from './tokens'`],
      ['a type-only import', `import type { CONTAINER_GRID_BREAKPOINTS } from 'basalt-ui/tokens'`],
      [
        'another basalt-ui/tokens name',
        `import { CONTAINER_CLASSES as CONTAINER_GRID_BREAKPOINTS } from 'basalt-ui/tokens'`,
      ],
    ])('still flags an imported map of the same name from %s', (_, imp) => {
      const { rules, output } = run(
        `import { Grid } from '@mantine/core'\n${imp}\n` +
          `export const C = () => <Grid type="container" breakpoints={CONTAINER_GRID_BREAKPOINTS}>${SPAN}</Grid>\n`,
      )
      expect(rules).toContain('raw-breakpoint')
      expect(CONTAINER_MESSAGE.test(output)).toBe(true)
    })

    const NS = `import * as tokens from 'basalt-ui/tokens'`
    it.each([
      ['a member of the namespace import', NS, 'tokens.CONTAINER_GRID_BREAKPOINTS'],
      ['a computed member', NS, `tokens['CONTAINER_GRID_BREAKPOINTS']`],
      ['a const alias of the member', `${NS}\nconst bp = tokens.CONTAINER_GRID_BREAKPOINTS`, 'bp'],
    ])('does NOT flag Grid.Col spans under %s', (_, imp, ref) => {
      const { rules } = run(
        `import { Grid } from '@mantine/core'\n${imp}\n` +
          `export const C = () => <Grid type="container" breakpoints={${ref}}>${SPAN}</Grid>\n`,
      )
      expect(rules).not.toContain('raw-breakpoint')
    })

    it.each([
      ['another module', `import * as tokens from './tokens'`, 'tokens.CONTAINER_GRID_BREAKPOINTS'],
      ['another member', NS, 'tokens.CONTAINER_CLASSES'],
      [
        'a parameter shadowing the namespace',
        `${NS}\nexport const Used = () => tokens.VX`,
        'tokens.CONTAINER_GRID_BREAKPOINTS',
        '({ tokens }: { tokens: { CONTAINER_GRID_BREAKPOINTS: Record<string, string> } })',
      ],
    ])('still flags a namespace member from %s', (_, imp, ref, params = '()') => {
      const { rules, output } = run(
        `import { Grid } from '@mantine/core'\n${imp}\n` +
          `export const C = ${params} => <Grid type="container" breakpoints={${ref}}>${SPAN}</Grid>\n`,
      )
      expect(rules).toContain('raw-breakpoint')
      expect(CONTAINER_MESSAGE.test(output)).toBe(true)
    })

    // Trust follows the BINDING, not the name: a shadow of the import is someone else's value.
    it.each([
      [
        'a parameter',
        `export const C = ({ bp }: { bp: Record<string, string> }) => <Grid type="container" breakpoints={bp}>${SPAN}</Grid>`,
      ],
      [
        'an inner const',
        `export const C = () => {\n  const bp = pick()\n  return <Grid type="container" breakpoints={bp}>${SPAN}</Grid>\n}`,
      ],
      [
        'an inner const aliasing a parameter',
        `export function C(props: { m: Record<string, string> }) {\n  const bp = props.m\n  return <Grid type="container" breakpoints={bp}>${SPAN}</Grid>\n}`,
      ],
    ])('flags breakpoints={bp} when bp is %s shadowing the aliased import', (_, component) => {
      const { rules, output } = run(
        `import { Grid } from '@mantine/core'\n` +
          `import { CONTAINER_GRID_BREAKPOINTS as bp } from 'basalt-ui/tokens'\n` +
          `export const Used = () => <Grid type="container" breakpoints={bp}>x</Grid>\n` +
          `${component}\n`,
      )
      expect(rules).toContain('raw-breakpoint')
      expect(CONTAINER_MESSAGE.test(output)).toBe(true)
    })

    it('flags a parameter shadowing the unaliased import name', () => {
      const { rules } = run(
        `import { Grid } from '@mantine/core'\n` +
          `import { CONTAINER_GRID_BREAKPOINTS } from 'basalt-ui/tokens'\n` +
          `export const C = ({ CONTAINER_GRID_BREAKPOINTS }: { CONTAINER_GRID_BREAKPOINTS: Record<string, string> }) =>\n` +
          `  <Grid type="container" breakpoints={CONTAINER_GRID_BREAKPOINTS}>${SPAN}</Grid>\n`,
      )
      expect(rules).toContain('raw-breakpoint')
    })

    // Only the grid-keyed props route through the container queries; Box style props on the same
    // element still compile to viewport @media, so they keep the ordinary viewport message.
    it.each([
      [
        'SimpleGrid p',
        `<SimpleGrid type="container" cols={{ base: 1, '480px': 2 }} p={{ base: 'xs', lg: 'md' }} />`,
      ],
      [
        'Grid mt',
        `<Grid type="container" breakpoints={{ xs: '240px', sm: '480px', md: '800px', lg: '800px', xl: '800px' }} mt={{ base: 0, sm: 'md' }}>x</Grid>`,
      ],
      [
        'Grid.Col mih',
        `<Grid type="container" breakpoints={{ xs: '240px', sm: '480px', md: '800px', lg: '800px', xl: '800px' }}><Grid.Col span={6} mih={{ base: 80, lg: 120 }}>x</Grid.Col></Grid>`,
      ],
    ])('flags a Box style prop on a container grid as viewport (%s)', (_, jsx) => {
      const { rules, output } = grid(jsx)
      expect(rules).toContain('raw-breakpoint')
      expect(CONTAINER_MESSAGE.test(output)).toBe(false)
    })

    it('does NOT flag container-routed spacing props on a container grid', () => {
      const src =
        `<Grid type="container" breakpoints={{ xs: '240px', sm: '480px', md: '800px', lg: '800px', xl: '800px' }} gap={{ base: 'xs', sm: 'md' }}>` +
        `<Grid.Col span={{ base: 12, sm: 6 }} order={{ base: 2, sm: 1 }}>x</Grid.Col></Grid>`
      expect(grid(src).rules).not.toContain('raw-breakpoint')
    })

    it('still flags Grid.Col spans under an ordinary Grid', () => {
      expect(
        grid(`<Grid><Grid.Col span={{ base: 12, sm: 6 }}>x</Grid.Col></Grid>`).rules,
      ).toContain('raw-breakpoint')
    })
  })

  it('flags visibleFrom/hiddenFrom outside a shell home', () => {
    const { rules } = run(
      `import { Box } from '@mantine/core'\n` +
        `export const C = () => <Box visibleFrom="sm">desktop only</Box>\n`,
    )
    expect(rules).toContain('raw-breakpoint')
  })

  it('does NOT flag visibleFrom/hiddenFrom inside a file that DEFINES BasaltShell', () => {
    const { rules } = run(
      `import { Box } from '@mantine/core'\n` +
        `export function BasaltShell() {\n  return <Box visibleFrom="sm">desktop only</Box>\n}\n`,
    )
    expect(rules).not.toContain('raw-breakpoint')
  })

  // The exemption is uniform across all four shapes: a file that IS the shell may also carry a
  // responsive-object prop, not only visibleFrom/hiddenFrom.
  it('does NOT flag a responsive-object prop inside a file that DEFINES BasaltShell', () => {
    const { rules } = run(
      `import { SimpleGrid } from '@mantine/core'\n` +
        `export function BasaltShell() {\n  return null\n}\n` +
        `export const C = () => <SimpleGrid cols={{ base: 1, sm: 2 }} />\n`,
    )
    expect(rules).not.toContain('raw-breakpoint')
  })

  it('does NOT flag visibleFrom/hiddenFrom inside a file that DEFINES a C9 control (ViewTabs) and imports no basalt-ui', () => {
    const { rules } = run(
      `import { Box } from '@mantine/core'\n` +
        `export function ViewTabs() {\n  return <Box visibleFrom="sm">desktop only</Box>\n}\n`,
    )
    expect(rules).not.toContain('raw-breakpoint')
  })

  it('flags an import of useMediaQuery/useMatches/useViewportSize from @mantine/*', () => {
    expect(run(`import { useMediaQuery } from '@mantine/hooks'\n`).rules).toContain(
      'raw-breakpoint',
    )
    expect(run(`import { useMatches } from '@mantine/core'\n`).rules).toContain('raw-breakpoint')
    expect(run(`import { useViewportSize } from '@mantine/hooks'\n`).rules).toContain(
      'raw-breakpoint',
    )
  })

  it('does NOT flag useMatches imported from a non-Mantine router (name collision)', () => {
    // @tanstack/react-router (and react-router) export their own unrelated `useMatches` —
    // basalt's own `src/router-tanstack/index.ts` imports it; scoped to `@mantine/*` sources only.
    expect(run(`import { useMatches } from '@tanstack/react-router'\n`).rules).not.toContain(
      'raw-breakpoint',
    )
    expect(run(`import { useViewportSize } from 'some-lib'\n`).rules).not.toContain(
      'raw-breakpoint',
    )
  })

  it('flags window.matchMedia and window.innerWidth', () => {
    expect(run(`const mq = window.matchMedia('(max-width: 600px)')\n`).rules).toContain(
      'raw-breakpoint',
    )
    expect(run(`const w = window.innerWidth\n`).rules).toContain('raw-breakpoint')
  })

  it('flags a bare matchMedia() call', () => {
    expect(run(`const mq = matchMedia('(max-width: 600px)')\n`).rules).toContain('raw-breakpoint')
  })

  it('honors a scoped theme-allow on the responsive-object prop', () => {
    const { rules } = run(
      `import { SimpleGrid } from '@mantine/core'\n` +
        `export const C = () => (\n  // theme-allow raw-breakpoint — migrating in a follow-up\n  <SimpleGrid cols={{ base: 1, sm: 2 }} />\n)\n`,
    )
    expect(rules).not.toContain('raw-breakpoint')
  })

  // rb r2 #11: the object sat inside a conditional, so the rule never saw it.
  it('flags a responsive object inside a conditional prop value (Grid.Col, no container)', () => {
    const { rules } = run(
      `import { Grid } from '@mantine/core'\n` +
        `export const C = ({ wide }: { wide: boolean }) => (\n` +
        `  <Grid><Grid.Col span={wide ? { base: 12, md: 4 } : 12}>x</Grid.Col></Grid>\n)\n`,
    )
    expect(rules).toContain('raw-breakpoint')
  })

  // Review r1: the unwrap ran before const resolution, so hoisting the conditional bypassed it.
  it('flags a conditional responsive object behind a same-file const', () => {
    const { rules } = run(
      `import { Grid } from '@mantine/core'\n` +
        `export const C = ({ wide }: { wide: boolean }) => {\n` +
        `  const span = wide ? { base: 12, md: 4 } : 12\n` +
        `  return <Grid><Grid.Col span={span}>x</Grid.Col></Grid>\n}\n`,
    )
    expect(rules).toContain('raw-breakpoint')
  })

  it('flags through a const alias chain and survives an alias cycle', () => {
    const chained = run(
      `import { SimpleGrid } from '@mantine/core'\n` +
        `const base = { base: 1, sm: 2 }\nconst cols = base\n` +
        `export const C = () => <SimpleGrid cols={cols} />\n`,
    )
    expect(chained.rules).toContain('raw-breakpoint')
    const cyclic = run(
      `import { SimpleGrid } from '@mantine/core'\n` +
        `const a = b\nconst b = a\n` +
        `export const C = () => <SimpleGrid cols={a} />\n`,
    )
    expect(cyclic.rules).not.toContain('raw-breakpoint')
  })

  it('flags a responsive object on either side of a logical prop value', () => {
    const { rules } = run(
      `import { SimpleGrid } from '@mantine/core'\n` +
        `export const C = ({ c }: { c?: number }) => <SimpleGrid cols={c ?? { base: 1, sm: 2 }} />\n`,
    )
    expect(rules).toContain('raw-breakpoint')
  })

  // rb r2 #13: a base-only object is no breakpoint at all — the message says to write the value.
  it('tells a base-only responsive object to write the bare value', () => {
    const { rules, output } = run(
      `import { SimpleGrid } from '@mantine/core'\n` +
        `export const C = () => <SimpleGrid cols={{ base: 3 }} />\n`,
    )
    expect(rules).toContain('raw-breakpoint')
    expect(output).toContain('cols={3}')
    expect(output).not.toContain('keyed on theme breakpoints')
  })

  it('gives the base-only message through a const-bound conditional too', () => {
    const { output } = run(
      `import { SimpleGrid } from '@mantine/core'\n` +
        `export const C = ({ d }: { d: boolean }) => {\n` +
        `  const cols = d ? { base: 3 } : 2\n  return <SimpleGrid cols={cols} />\n}\n`,
    )
    expect(output).toContain('cols={3}')
    expect(output).not.toContain('keyed on theme breakpoints')
  })

  it('keeps the viewport message when any branch carries a real breakpoint', () => {
    const { output } = run(
      `import { SimpleGrid } from '@mantine/core'\n` +
        `export const C = ({ d }: { d: boolean }) => <SimpleGrid cols={d ? { base: 3 } : { base: 1, sm: 2 }} />\n`,
    )
    expect(output).toContain('keyed on theme breakpoints')
  })

  // rb r2 #5.
  it('points a useMediaQuery read at the (pointer: coarse) CSS home', () => {
    const { output } = run(
      `import { useMediaQuery } from '@mantine/hooks'\n` +
        `export const useTouch = () => useMediaQuery('(hover: none)')\n`,
    )
    expect(output).toContain('@media (pointer: coarse)')
    expect(output).toContain('useCoarsePointer() from basalt-ui')
  })

  // obsidian r2 #7: a test-setup polyfill lives in `tests/`, not in a `.test` file.
  it.each(['tests/setup/dom.ts', 'test/setup.ts', 'src/__tests__/setup.ts'])(
    'does NOT flag a matchMedia stub under %s',
    (filename) => {
      const { rules } = run(`window.matchMedia = () => ({ matches: false })\n`, filename)
      expect(rules).not.toContain('raw-breakpoint')
    },
  )

  it('still flags a file whose name merely contains "test" outside a test dir', () => {
    const { rules } = run(`const mq = window.matchMedia('(max-width: 600px)')\n`, 'src/latest/a.ts')
    expect(rules).toContain('raw-breakpoint')
  })
})

// ── control homes: text lane ≡ plugin ────────────────────────────────────────

// 1.32.1 (B2): the plugin homed FormRow/FormGroup while check-theme's `raw-selection-control` did
// not, so a correctly migrated form reported in one lane only. Both lists are module-private (the
// guard is dependency-free, the plugin cannot import TS), so this reads them out of the source.
describe('control homes — lane parity', () => {
  const pluginSource = readFileSync(PLUGIN_PATH, 'utf8')
  const guardSource = readFileSync(resolve(import.meta.dirname, '../src/guard/index.ts'), 'utf8')

  const pluginSet = (name: string): string[] => {
    const body = pluginSource.match(new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]`))?.[1]
    if (body === undefined) throw new Error(`${name} not found in oxlint-plugin.js`)
    return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1] as string)
  }

  it('check-theme CONTROL_HOST_TAG names exactly CONTROL_HOST_TAGS ∪ BASALT_HOST_TAGS', () => {
    const alternation = guardSource.match(/const CONTROL_HOST_TAG =\s*\/<\(\?:([^)]*)\)/)?.[1]
    if (alternation === undefined) throw new Error('CONTROL_HOST_TAG not found in guard/index.ts')
    const textLane = alternation.split('|').map((tag) => tag.replaceAll('\\.', '.'))
    const pluginLane = [...pluginSet('CONTROL_HOST_TAGS'), ...pluginSet('BASALT_HOST_TAGS')]
    expect(pluginLane).toContain('FormRow')
    expect(textLane.toSorted()).toEqual(pluginLane.toSorted())
  })
})

// ── agent-no-raw-usechat — the `Chat` class ──────────────────────────────────

describe('basalt/agent-no-raw-usechat — Chat', () => {
  it.each(['@ai-sdk/react', 'ai/react'])('flags `Chat` imported from %s', (source) => {
    const { code, rules } = run(`import { Chat } from '${source}'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('agent-no-raw-usechat')
  })

  it('does NOT flag a type-only `Chat` import', () => {
    const { code } = run(`import type { Chat } from '@ai-sdk/react'\n`, 'lib.ts')
    expect(code).toBe(0)
  })

  it.each([
    ['AI.useChat()', `const c = AI.useChat({ id })\n`],
    ['AI.Chat as a value', `const C = AI.Chat\n`],
    ['new AI.Chat()', `const c = new AI.Chat({ id })\n`],
  ])('flags %s through a namespace import', (_name, use) => {
    const { code, rules } = run(`import * as AI from '@ai-sdk/react'\n${use}`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('agent-no-raw-usechat')
  })

  it('flags a namespace import of ai/react', () => {
    const { code } = run(`import * as AI from 'ai/react'\nAI.useChat()\n`, 'lib.ts')
    expect(code).toBe(1)
  })

  it('does NOT flag a namespace member that is not a chat hook, a local namespace, or a type import', () => {
    expect(run(`import * as AI from '@ai-sdk/react'\nAI.somethingElse()\n`, 'lib.ts').code).toBe(0)
    expect(run(`import * as AI from './mine'\nAI.useChat()\n`, 'lib.ts').code).toBe(0)
    expect(run(`import type * as AI from '@ai-sdk/react'\nAI.useChat()\n`, 'lib.ts').code).toBe(0)
  })

  it.each([
    `export { Chat } from '@ai-sdk/react'\n`,
    `export { useChat as chat } from 'ai/react'\n`,
    `export * from '@ai-sdk/react'\n`,
  ])('flags the re-export %s', (source) => {
    const { code, rules } = run(source, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('agent-no-raw-usechat')
  })

  it('does NOT flag a type re-export or an unrelated name', () => {
    expect(run(`export type { UIMessage } from '@ai-sdk/react'\n`, 'lib.ts').code).toBe(0)
    expect(run(`export { Other } from '@ai-sdk/react'\n`, 'lib.ts').code).toBe(0)
  })
})

// ── no-dev-helper ────────────────────────────────────────────────────────────

describe('basalt/no-dev-helper', () => {
  const LAZY = `const Dock = lazy(() => import('../dev-dock'))\n`
  it.each([
    ['an unguarded devtools import()', `const m = import('@tanstack/react-router-devtools')\n`],
    ['an unguarded theme-lab import()', `export const load = () => import('./theme-lab')\n`],
    ['an isDev() gate', `if (isDev()) import('./dev-dock')\n`],
    ['an eager const import() with no gate', `const m = import('./theme-lab')\n`],
    [
      'an eager const import() even when a later use is gated',
      `const m = import('./theme-lab')\nif (process.env.NODE_ENV !== 'production') use(m)\n`,
    ],
    [
      'an import() inside an anonymous callback',
      `useEffect(() => { void import('./dev-dock') }, [])\n`,
    ],
    ['a lazy binding rendered without a gate', `${LAZY}export const C = () => <Dock />\n`],
    [
      'a lazy binding with one ungated use',
      `${LAZY}export const C = () => (\n  <>\n    {process.env.NODE_ENV !== 'production' && <Dock />}\n    <Dock />\n  </>\n)\n`,
    ],
    ['a TS-wrapped ungated use', `const load = () => import('./dev-dock')\nload!()\n`],
    [
      'a gate that only holds in production',
      `const load = () => import('./dev-dock')\nif (ok && process.env.NODE_ENV === 'production') load()\n`,
    ],
    [
      'a component that merely contains the import (its uses are not the dev uses)',
      `const App = () => { useEffect(() => { void import('./dev-dock') }, []); return null }\nexport const C = () => <App />\n`,
    ],
  ])('flags %s', (_name, source) => {
    const { code, rules } = run(source, 'lib.tsx')
    expect(code).toBe(1)
    expect(rules).toContain('no-dev-helper')
  })

  it.each([
    [
      'an if-gate',
      `if (process.env.NODE_ENV !== 'production') {\n  void import('@tanstack/react-query-devtools')\n}\n`,
    ],
    [
      'the bracketed spelling',
      `if (process.env['NODE_ENV'] !== 'production') {\n  void import('./dev-dock')\n}\n`,
    ],
    [
      '=== development',
      `const m = process.env.NODE_ENV === 'development' ? import('./theme-lab') : null\n`,
    ],
    [
      'the production alternate',
      `const m = process.env.NODE_ENV === 'production' ? null : import('./dev-dock')\n`,
    ],
    [
      'a lazy binding used only under the gate',
      `${LAZY}export const C = () => process.env.NODE_ENV !== 'production' && <Dock />\n`,
    ],
    [
      'a lazy binding whose name also appears as a property key, attribute and type',
      `${LAZY}type T = typeof Dock\nconst o = { Dock: 1 }\nexport const C = () => <X Dock="a" y={o.Dock}>{process.env.NODE_ENV !== 'production' && <Dock />}</X>\n`,
    ],
    [
      'another binding that shadows the lazy name',
      `${LAZY}export const A = () => process.env.NODE_ENV !== 'production' && <Dock />\nexport const B = (Dock: unknown) => String(Dock)\n`,
    ],
    [
      'a plain loader called under the gate',
      `const load = () => import('./dev-dock')\nif (process.env.NODE_ENV !== 'production') load()\n`,
    ],
    [
      'a gate inside an && chain',
      `const load = () => import('./dev-dock')\nexport const f = (ok: boolean) => ok && process.env.NODE_ENV !== 'production' && load()\n`,
    ],
    [
      'a negated production test',
      `const load = () => import('./dev-dock')\nif (!(process.env.NODE_ENV === 'production')) load()\n`,
    ],
    [
      'a negated || test',
      `const load = () => import('./dev-dock')\nif (!(ok || process.env.NODE_ENV === 'production')) load()\n`,
    ],
    [
      'the literal on the left',
      `const load = () => import('./dev-dock')\nif ('production' !== process.env.NODE_ENV) load()\n`,
    ],
    [
      'TS-wrapped uses under the gate plus a class member of the same name',
      `${LAZY}class K { Dock = 1 }\nexport const C = () => process.env.NODE_ENV !== 'production' && (Dock as unknown as () => null)\n`,
    ],
    ['an unrelated import()', `const m = import('rehype-sanitize')\n`],
  ])('does NOT flag %s', (_name, source) => {
    const { code, rules } = run(source, 'lib.tsx')
    expect(code).toBe(0)
    expect(rules).not.toContain('no-dev-helper')
  })

  it('exempts the dev modules themselves', () => {
    const { code } = run(`const m = import('./theme-lab')\n`, 'src/dev-dock.tsx')
    expect(code).toBe(0)
  })
})

// ── no-import-meta-env — scopes itself to basalt's own source ────────────────

describe('basalt/no-import-meta-env', () => {
  const PKG_ROOT = resolve(import.meta.dirname, '..')
  const visit = (filename: string): number => {
    const reports: unknown[] = []
    const visitor = basaltPlugin.rules['no-import-meta-env'].create({
      filename,
      sourceCode: { getAllComments: () => [] },
      report: (r: unknown) => reports.push(r),
    })
    const node = {
      type: 'MemberExpression',
      computed: false,
      property: { name: 'env' },
      object: { type: 'MetaProperty', meta: { name: 'import' }, property: { name: 'meta' } },
      loc: { start: { line: 1 } },
    }
    visitor.MemberExpression?.(node)
    return reports.length
  }

  it('reports inside packages/basalt-ui/src', () => {
    expect(visit(`${PKG_ROOT}/src/x.ts`)).toBe(1)
  })

  it('is silent elsewhere (the playground is a consumer) and in tests', () => {
    expect(visit(`${PKG_ROOT}/../../apps/playground/src/main.tsx`)).toBe(0)
    expect(visit(`${PKG_ROOT}/src/x.test.ts`)).toBe(0)
  })
})

// ── route-view-transition ────────────────────────────────────────────────────

describe('basalt/route-view-transition', () => {
  const RR = `import { Outlet } from '@tanstack/react-router'\n`
  it.each([
    [
      'a named import',
      `import { ViewTransition } from 'react'\n${RR}export const C = () => <ViewTransition><Outlet /></ViewTransition>\n`,
    ],
    [
      'an aliased import',
      `import { ViewTransition as VT } from 'react'\n${RR}export const C = () => <VT><Outlet /></VT>\n`,
    ],
    [
      'React.ViewTransition',
      `import React from 'react'\n${RR}export const C = () => <React.ViewTransition><Outlet /></React.ViewTransition>\n`,
    ],
    [
      'a namespace import',
      `import * as R from 'react'\n${RR}export const C = () => <R.ViewTransition><Outlet /></R.ViewTransition>\n`,
    ],
    [
      'an aliased Outlet, nested deep',
      `import { ViewTransition } from 'react'\nimport { Outlet as Page } from '@tanstack/react-router'\nexport const C = () => <ViewTransition><div><main><Page /></main></div></ViewTransition>\n`,
    ],
    [
      'a nested ViewTransition (both are inert)',
      `import { ViewTransition } from 'react'\n${RR}export const C = () => <ViewTransition><section><ViewTransition><Outlet /></ViewTransition></section></ViewTransition>\n`,
    ],
    [
      'a namespace Outlet',
      `import { ViewTransition } from 'react'\nimport * as Router from '@tanstack/react-router'\nexport const C = () => <ViewTransition><Router.Outlet /></ViewTransition>\n`,
    ],
  ])('flags %s', (_name, source) => {
    const { code, rules } = run(source, 'lib.tsx')
    expect(code).toBe(1)
    expect(rules).toContain('route-view-transition')
  })

  it.each([
    [
      'a ViewTransition with no Outlet',
      `import { ViewTransition } from 'react'\nexport const C = () => <ViewTransition><p /></ViewTransition>\n`,
    ],
    [
      'an Outlet beside, not inside, a ViewTransition',
      `import { ViewTransition } from 'react'\n${RR}export const C = () => <><ViewTransition><p /></ViewTransition><Outlet /></>\n`,
    ],
    [
      'a ViewTransition not from react',
      `import { ViewTransition } from './mine'\n${RR}export const C = () => <ViewTransition><Outlet /></ViewTransition>\n`,
    ],
    [
      'an Outlet not from the router',
      `import { ViewTransition } from 'react'\nimport { Outlet } from './mine'\nexport const C = () => <ViewTransition><Outlet /></ViewTransition>\n`,
    ],
    [
      'a type-only Outlet import',
      `import { ViewTransition } from 'react'\nimport type { Outlet } from '@tanstack/react-router'\nexport const C = () => <ViewTransition><Outlet /></ViewTransition>\n`,
    ],
  ])('does NOT flag %s', (_name, source) => {
    const { rules } = run(source, 'lib.tsx')
    expect(rules).not.toContain('route-view-transition')
  })

  it('reports each enclosing ViewTransition once', () => {
    const { output } = run(
      `import { ViewTransition } from 'react'\n${RR}export const C = () => <ViewTransition><ViewTransition><Outlet /></ViewTransition></ViewTransition>\n`,
      'lib.tsx',
    )
    expect(output.match(/basalt\/route-view-transition/g)).toHaveLength(2)
  })

  it('does not apply in test files', () => {
    const source = `import { ViewTransition } from 'react'\n${RR}export const C = () => <ViewTransition><Outlet /></ViewTransition>\n`
    expect(run(source, 'lib.test.tsx').rules).not.toContain('route-view-transition')
  })

  it('honours a theme-allow annotation naming the rule', () => {
    const source = `import { ViewTransition } from 'react'\n${RR}export const C = () => (\n  // theme-allow route-view-transition: legacy page under migration\n  <ViewTransition><Outlet /></ViewTransition>\n)\n`
    expect(run(source, 'lib.tsx').rules).not.toContain('route-view-transition')
  })
})

describe('rule level locks', () => {
  const levels = (path: string) =>
    (JSON.parse(readFileSync(path, 'utf8')) as { rules: Record<string, unknown> }).rules
  const shipped = levels(resolve(import.meta.dirname, 'oxlint-basalt.json'))
  const repo = levels(resolve(import.meta.dirname, '..', '..', '..', '.oxlintrc.json'))

  it('no-dev-helper is repo-local only, at error', () => {
    expect(shipped).not.toHaveProperty('basalt/no-dev-helper')
    expect(repo['basalt/no-dev-helper']).toBe('error')
  })
})

// ── dogfood — /.oxlintrc.json ⊇ the shipped basalt/* levels ──────────────────

describe('/.oxlintrc.json dogfoods oxlint-basalt.json', () => {
  const rulesOf = (path: string) =>
    (JSON.parse(readFileSync(path, 'utf8')) as { rules: Record<string, unknown> }).rules
  const shipped = rulesOf(resolve(import.meta.dirname, 'oxlint-basalt.json'))
  const repo = rulesOf(resolve(import.meta.dirname, '..', '..', '..', '.oxlintrc.json'))

  // Repo-local is the strict side: `error` for every shipped id, grace entries included (those
  // ship `warn`); every other id ships the very level the repo runs.
  it.each(Object.entries(shipped))('%s is error repo-locally', (id, level) => {
    expect([id, repo[id]]).toEqual([id, 'error'])
    if (!Object.hasOwn(PLUGIN_RULE_GRACE, id.slice('basalt/'.length))) {
      expect([id, level]).toEqual([id, repo[id]])
    }
  })
})

// ── the `Ships:` claim above each rule (F26) ─────────────────────────────────

/**
 * F26 was a rule's own doc comment claiming a level it did not ship at, with nothing able to catch
 * it: the C16 ledger is asserted against the preset, and a COMMENT is outside the ledger. So the
 * claim is now one normalised line — `// Ships: <level>` directly above each rule's `const` — and
 * this is the assertion that makes it as checkable as the ledger it restates.
 */
describe('the `Ships:` line above each rule', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'oxlint-plugin.js'), 'utf8')
  const lines = source.split('\n')
  const shipped = JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'oxlint-basalt.json'), 'utf8'),
  ) as {
    rules: Record<string, unknown>
  }
  // The registry block maps rule id → the `const` implementing it.
  const registry = [
    ...source.slice(source.indexOf('export default {')).matchAll(/^ {4}'([\w-]+)': (\w+),$/gm),
  ].map(([, id, binding]) => ({ id: id as string, binding: binding as string }))

  it('covers every registered rule', () => {
    expect(registry.map((r) => r.id).toSorted()).toEqual(Object.keys(basaltPlugin.rules).toSorted())
  })

  for (const { id, binding } of registry) {
    it(`${id}: the claim matches oxlint-basalt.json`, () => {
      const at = lines.indexOf(`const ${binding} = {`)
      expect([id, at]).not.toEqual([id, -1])
      const claim = /^\/\/ Ships: (.+)$/.exec(lines[at - 1] as string)?.[1]
      const level = shipped.rules[`basalt/${id}`]
      if (level === undefined) {
        expect([id, claim]).toEqual([id, 'repo-local only'])
        return
      }
      if (Object.hasOwn(PLUGIN_RULE_GRACE, id)) {
        const { promote } = PLUGIN_RULE_GRACE[id] as GraceEntry
        expect([id, claim]).toEqual([id, `warn (grace → ${promote})`])
        expect([id, level]).toEqual([id, 'warn'])
        return
      }
      expect([id, claim]).toEqual([id, 'error'])
      expect([id, level]).toEqual([id, 'error'])
    })
  }
})

// emailgw r4b: wiring the full preset on a repo with history forced unrelated jsx-a11y/unicorn
// errors before a single basalt/* rule could land. The guards-only preset is the guard lane alone,
// and the full preset extends it, so every basalt/* level is stated in exactly one file.
describe('configs/oxlint-basalt.json — the guards-only preset', () => {
  const read = (file: string) =>
    JSON.parse(readFileSync(resolve(import.meta.dirname, file), 'utf8')) as Record<string, unknown>
  const guards = read('oxlint-basalt.json')
  const full = read('oxlint.json')

  it('carries the plugin and basalt/* rules, nothing from the generic preset', () => {
    expect(Object.keys(guards).toSorted()).toEqual(['jsPlugins', 'rules'])
    expect(guards['jsPlugins']).toEqual(['./oxlint-plugin.js'])
    const ids = Object.keys(guards['rules'] as object)
    expect(ids.filter((id) => !id.startsWith('basalt/'))).toEqual([])
    expect(ids.length).toBeGreaterThan(0)
  })

  it('is extended by the full preset, which states no basalt/* level of its own', () => {
    expect(full['extends']).toEqual(['./oxlint-basalt.json'])
    expect(full['jsPlugins']).toBeUndefined()
    expect(Object.keys(full['rules'] as object).filter((id) => id.startsWith('basalt/'))).toEqual(
      [],
    )
  })
})
