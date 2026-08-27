/**
 * Integration tests for the shipped `basalt` oxlint JS plugin (`oxlint-plugin.js`) — exercises the
 * real oxlint binary against small fixture files, the same way a consumer's lint run would.
 *
 * Each fixture repo gets a minimal `.oxlintrc.json` pointing `jsPlugins` at the plugin (absolute
 * path — verified to resolve the same as the relative path the shipped/repo configs use) and
 * enabling every rule this file tests. `run` shells the workspace-root `node_modules/.bin/oxlint`
 * binary and returns the parsed set of `basalt/<rule>` diagnostics it printed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
// eslint-disable-next-line -- the plugin is plain JS; the ledger + id set are named exports beside it
import basaltPlugin, {
  CTL_THEME_TAGS,
  KNOWN_RULE_IDS,
  PLUGIN_RULE_ADVISORY,
  PLUGIN_RULE_GRACE,
} from './oxlint-plugin.js'
import { CTL_THEME } from '../src/theme/ctl-theme'
import { GUARD_RULES, PLUGIN_RULE_IDS } from '../src/guard/index.ts'
import { PLUGIN_RULE_ID_LIST, SURFACES } from '../src/surfaces.ts'

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
        'basalt/no-raw-font-size': 'error',
        'basalt/card-inset': 'error',
        'basalt/chart-in-raw-surface': 'error',
        'basalt/hand-rolled-plot': 'error',
        'basalt/chart-legend-literal': 'error',
        'basalt/shadow-basalt-export': 'error',
        'basalt/hand-rolled-shell': 'error',
        'basalt/raw-scroll-container': 'error',
        'basalt/hand-rolled-filter': 'error',
        'basalt/control-outside-home': 'error',
        'basalt/control-size-literal': 'error',
        'basalt/page-bar-budget': 'error',
        'basalt/in-body-page-title': 'error',
        'basalt/responsive-twin': 'error',
        'basalt/search-literal-link': 'error',
        'basalt/use-search-from-literal': 'error',
        'basalt/visx-boundary': 'error',
        'basalt/visx-tooltip': 'error',
        'basalt/token-layer-boundary': 'error',
        'basalt/agent-resume-guard': 'error',
        'basalt/agent-no-raw-usechat': 'error',
        'basalt/ai-sdk-major': 'error',
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
  const rules = new Set(
    [...output.matchAll(/\(basalt\/([\w-]+)\)/g)].map((match) => match[1] as string),
  )
  return { code: result.exitCode ?? 0, rules, output }
}

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
    const { code, rules } = run(`export const C = () => <Card><ZonedLine data={[]} /></Card>\n`)
    expect(code).toBe(1)
    expect(rules).toContain('chart-in-raw-surface')
  })

  it('does NOT flag a chart passed as a prop value (not a Card/Paper subtree)', () => {
    const { code, rules } = run(
      `export const C = () => <Card><StatCard sparkline={<LineSparkline />} /></Card>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('chart-in-raw-surface')
  })
})

// ── visx-boundary ────────────────────────────────────────────────────────────

describe('basalt/visx-boundary', () => {
  it('flags a @visx/* import outside charts', () => {
    const { code, rules } = run(`import { scaleLinear } from '@visx/scale'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('visx-boundary')
  })

  it('does NOT flag a @visx/* import inside charts', () => {
    const { code, rules } = run(`import { scaleLinear } from '@visx/scale'\n`, 'charts/lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('visx-boundary')
  })

  it('does NOT flag a @mantine/* import (out of scope for this rule)', () => {
    const { code, rules } = run(`import { Button } from '@mantine/core'\n`, 'lib.tsx')
    expect(code).toBe(0)
    expect(rules).not.toContain('visx-boundary')
  })

  it('still flags a @visx/* import outside charts carrying a theme-allow comment (no escape hatch)', () => {
    const { code, rules } = run(
      `// theme-allow: legacy\nimport { scaleLinear } from '@visx/scale'\n`,
      'lib.ts',
    )
    expect(code).toBe(1)
    expect(rules).toContain('visx-boundary')
  })

  it('flags a source-bearing named re-export of @visx/* outside charts', () => {
    const { code, rules } = run(`export { scaleLinear } from '@visx/scale'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('visx-boundary')
  })

  it('flags a wildcard re-export of @visx/* outside charts', () => {
    const { code, rules } = run(`export * from '@visx/scale'\n`, 'lib.ts')
    expect(code).toBe(1)
    expect(rules).toContain('visx-boundary')
  })

  it('does NOT flag a plain local named export (no source)', () => {
    const { code, rules } = run(`const x = 1\nexport { x }\n`, 'lib.ts')
    expect(code).toBe(0)
    expect(rules).not.toContain('visx-boundary')
  })
})

// ── visx-tooltip ─────────────────────────────────────────────────────────────

describe('basalt/visx-tooltip', () => {
  it('flags @visx/tooltip even inside charts', () => {
    const { code, rules } = run(`import { Tooltip } from '@visx/tooltip'\n`, 'charts/lib.tsx')
    expect(code).toBe(1)
    expect(rules).toContain('visx-tooltip')
  })

  it('flags @visx/tooltip outside charts too', () => {
    const { code, rules } = run(`import { Tooltip } from '@visx/tooltip'\n`, 'lib.tsx')
    expect(code).toBe(1)
    expect(rules).toContain('visx-tooltip')
  })

  it('takes precedence over basalt/visx-boundary for @visx/tooltip specifically', () => {
    const { rules } = run(`import { Tooltip } from '@visx/tooltip'\n`, 'lib.tsx')
    expect(rules).toContain('visx-tooltip')
    expect(rules).not.toContain('visx-boundary')
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
// The three rules used to be one bundled `import-boundary` rule with a single on/off toggle — a
// consumer disabling the one check they disagreed with silently dropped the other two. Proves
// disabling one of the three leaves the other two enforced.

describe('rule independence', () => {
  it('disabling basalt/visx-boundary leaves basalt/visx-tooltip enforced', () => {
    writeFileSync(
      resolve(dir, '.oxlintrc.json'),
      JSON.stringify({
        plugins: [],
        jsPlugins: [PLUGIN_PATH],
        rules: {
          'basalt/visx-boundary': 'off',
          'basalt/visx-tooltip': 'error',
          'basalt/token-layer-boundary': 'error',
        },
      }),
    )
    const { code, rules } = run(
      `import { scaleLinear } from '@visx/scale'\nimport { Tooltip } from '@visx/tooltip'\n`,
      'lib.ts',
    )
    expect(code).toBe(1)
    expect(rules).not.toContain('visx-boundary')
    expect(rules).toContain('visx-tooltip')
  })
})

// ── agent-resume-guard ───────────────────────────────────────────────────────
// The two agent rules honour a SEPARATE escape token, `basalt-agent-allow`, not `theme-allow` — a
// color exemption must never be able to switch off a streaming guard. The `theme-allow` fixture
// below proves the wrong token does not suppress the finding.

describe('basalt/agent-resume-guard', () => {
  it('flags useChat({ resume: true })', () => {
    const { code, rules } = run(`const c = useChat({ id, resume: true })\n`)
    expect(code).toBe(1)
    expect(rules).toContain('agent-resume-guard')
  })

  it('does NOT flag useChat({ resume: false })', () => {
    const { code, rules } = run(`const c = useChat({ id, resume: false })\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('agent-resume-guard')
  })

  it('does NOT flag a bare useChat({ id }) with no resume key', () => {
    const { code, rules } = run(`const c = useChat({ id })\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('agent-resume-guard')
  })

  it('flags chat.resumeStream() called from an effect', () => {
    const { code, rules } = run(`useEffect(() => { chat.resumeStream() }, [])\n`)
    expect(code).toBe(1)
    expect(rules).toContain('agent-resume-guard')
  })

  it('does NOT flag chat.resumeStream() marked basalt-agent-allow', () => {
    const { code, rules } = run(`// basalt-agent-allow\nchat.resumeStream()\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('agent-resume-guard')
  })

  it('STILL flags chat.resumeStream() marked only theme-allow (wrong escape token)', () => {
    const { code, rules } = run(`// theme-allow\nchat.resumeStream()\n`)
    expect(code).toBe(1)
    expect(rules).toContain('agent-resume-guard')
  })

  it('does NOT flag an unrelated call like runs.start(id, text)', () => {
    const { code, rules } = run(`runs.start(id, text)\n`)
    expect(code).toBe(0)
    expect(rules).not.toContain('agent-resume-guard')
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
  // token as its two agent-chat siblings above — not `theme-allow`. A skewed producer/consumer
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
      readFileSync(resolve(import.meta.dirname, 'oxlint.json'), 'utf8'),
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
// The three agent-chat rules were promoted warn → error in the SHIPPED preset alongside
// raw-scroll-container above, but had no equivalent lock — `scripts/gen-oxlint.ts` only regenerates
// the `overrides` array; this top-level `rules` block is hand-maintained and
// `tests/oxlint-preset-sync.test.ts` only checks `overrides` against `projectBanList('shipped')`, so
// a later accidental revert of one of these three back to "warn" would pass the suite silently.

describe('basalt agent rules promotion', () => {
  it.each(['basalt/agent-resume-guard', 'basalt/agent-no-raw-usechat', 'basalt/ai-sdk-major'])(
    '%s ships "error" (not "warn"/"off") in the consumer preset',
    (rule) => {
      const shipped = JSON.parse(
        readFileSync(resolve(import.meta.dirname, 'oxlint.json'), 'utf8'),
      ) as { rules: Record<string, unknown> }
      expect(shipped.rules[rule]).toBe('error')
    },
  )

  it.each(['basalt/agent-resume-guard', 'basalt/agent-no-raw-usechat', 'basalt/ai-sdk-major'])(
    '%s stays at the shipped level ("error") repo-local',
    (rule) => {
      const repoLocal = JSON.parse(
        readFileSync(resolve(import.meta.dirname, '..', '..', '..', '.oxlintrc.json'), 'utf8'),
      ) as { rules: Record<string, unknown> }
      expect(repoLocal.rules[rule]).toBe('error')
    },
  )
})

// ── hand-rolled-plot ─────────────────────────────────────────────────────────

const CHARTS_IMPORT = `import { AxisLeftNumeric, CartesianChart, ChartLegend, Crosshair, HoverOverlay } from 'basalt-ui/charts'\n`

describe('basalt/hand-rolled-plot', () => {
  it('flags an axis primitive in a file that never composes CartesianChart', () => {
    const { code, rules } = run(
      `${CHARTS_IMPORT}export const C = () => <svg><AxisLeftNumeric scale={s} /></svg>\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('hand-rolled-plot')
  })

  it('does NOT flag the same primitive when CartesianChart is composed', () => {
    const { code, rules } = run(
      `${CHARTS_IMPORT}export const C = () => <CartesianChart>{() => <AxisLeftNumeric scale={s} />}</CartesianChart>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('hand-rolled-plot')
  })

  // `theme-allow-file` is the written declaration about the file, and it covers every assembly node
  // in it — the DualPanel shape.
  it('a theme-allow-file declaration covers the whole file', () => {
    const { code, rules } = run(
      `${CHARTS_IMPORT}export const C = () => (
  <svg>
    {/* theme-allow-file basalt/hand-rolled-plot: multi-pane shape, not a single cartesian plot */}
    <AxisLeftNumeric scale={a} />
    <HoverOverlay width={1} height={1} />
    <Crosshair x={0} top={0} bottom={1} />
  </svg>
)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('hand-rolled-plot')
  })

  // The other half of the 1.20.0 fix. Naming the rule AND giving a reason used to promote the
  // waiver to the whole file, which made whole-file the ONLY expressible scope: the shape the rule's
  // own message asks for was the shape that granted immunity. It is now what it reads as — one node.
  it('a named-with-a-reason theme-allow waives its own node ONLY, not the file', () => {
    const { code, rules } = run(
      `${CHARTS_IMPORT}export const C = () => (
  <svg>
    {/* theme-allow basalt/hand-rolled-plot — this one axis is drawn against a second scale */}
    <AxisLeftNumeric scale={a} />
    <HoverOverlay width={1} height={1} />
  </svg>
)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('hand-rolled-plot')
  })

  // The linewatch defect: a BARE comment used to buy the whole file permanent immunity, because
  // only the first node was reported and the waiver was tested there. It now waives its own node
  // and nothing else, so everything added to the file afterwards is still reported.
  it('a bare theme-allow waives only the node it sits above, not the file', () => {
    const { code, rules } = run(
      `${CHARTS_IMPORT}export const C = () => (
  <svg>
    {/* theme-allow */}
    <AxisLeftNumeric scale={a} />
    <HoverOverlay width={1} height={1} />
  </svg>
)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('hand-rolled-plot')
  })

  // A comment written about something else must not double as a licence to hand-assemble a plot.
  it('a theme-allow scoped to a DIFFERENT rule does not waive this one', () => {
    const { code, rules } = run(
      `${CHARTS_IMPORT}export const C = () => (
  <svg>
    {/* theme-allow raw-hex — the swatch below is a measured pixel */}
    <AxisLeftNumeric scale={a} />
  </svg>
)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('hand-rolled-plot')
  })

  it('does NOT flag a same-named component that is NOT a basalt chart primitive', () => {
    const { code, rules } = run(
      `import { Crosshair } from './my-own-widgets'
export const C = () => <svg><Crosshair x={0} /></svg>\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('hand-rolled-plot')
  })

  // `code` is 1 in both of these and that is correct: a CONSUMER file declaring `CartesianChart`
  // shadows a basalt export, which `shadow-basalt-export` now sees since it reads the charts barrel
  // too. The assertion under test is that `hand-rolled-plot` stays silent — a rule saying "compose
  // X" cannot fire inside X.
  it('does NOT flag the module that DEFINES CartesianChart (function form)', () => {
    const { rules } = run(
      `import { AxisBottomDate } from '../primitives/Axes'
export function CartesianChart() {
  return <svg><AxisBottomDate scale={s} top={0} tickValues={[]} /></svg>
}\n`,
    )
    expect(rules).not.toContain('hand-rolled-plot')
  })

  it('does NOT flag the module that DEFINES CartesianChart (const form)', () => {
    const { rules } = run(
      `import { AxisBottomDate } from '../primitives/Axes'
export const CartesianChart = () => <svg><AxisBottomDate scale={s} top={0} tickValues={[]} /></svg>\n`,
    )
    expect(rules).not.toContain('hand-rolled-plot')
  })
})

// ── theme-allow grammar — the accepted and rejected shapes, exhaustively ─────
//
// Two rounds produced three holes in this one contract, so it gets a matrix rather than a case.
// `hand-rolled-plot` is the vehicle: it is the only rule with BOTH scopes, so one fixture shape
// exercises the node waiver, the file declaration and the prefix rule at once.

describe('theme-allow grammar', () => {
  /** Two assembly nodes, with `annotation` placed as a comment-only line above the first. */
  function twoNodes(annotation: string): { code: number; rules: Set<string> } {
    return run(
      `${CHARTS_IMPORT}export const C = () => (
  <svg>
    ${annotation}
    <AxisLeftNumeric scale={a} />
    <HoverOverlay width={1} height={1} />
  </svg>
)\n`,
    )
  }

  const waivesFirstNodeOnly = (annotation: string) => {
    const { rules } = twoNodes(annotation)
    expect([annotation, rules.has('hand-rolled-plot')]).toEqual([annotation, true])
  }
  const waivesWholeFile = (annotation: string) => {
    const { rules } = twoNodes(annotation)
    expect([annotation, rules.has('hand-rolled-plot')]).toEqual([annotation, false])
  }

  // ── ACCEPTED as a NODE waiver (the second node still reports) ──────────────

  it.each([
    '{/* theme-allow */}',
    '{/* theme-allow hand-rolled-plot */}',
    '{/* theme-allow hand-rolled-plot — a reason */}',
    '{/* theme-allow basalt/hand-rolled-plot: a reason */}',
    '{/* theme-allow hand-rolled-plot, raw-hex — two ids */}',
    '{/*theme-allow hand-rolled-plot — no space after the opener*/}',
  ])('%s waives its own node and leaves the rest policed', waivesFirstNodeOnly)

  // ── ACCEPTED as a FILE declaration (nothing in the file reports) ───────────

  it.each([
    '{/* theme-allow-file hand-rolled-plot — a reason */}',
    '{/* theme-allow-file basalt/hand-rolled-plot: a reason */}',
    '{/* theme-allow-file hand-rolled-plot */}',
    '{/* theme-allow-file hand-rolled-plot, chart-legend-literal — two ids */}',
  ])('%s declares the whole file', waivesWholeFile)

  it('a theme-allow-file inside a docblock, detached from any node, declares the file', () => {
    const { code, rules } = run(
      `${CHARTS_IMPORT}/**
 * A two-pane shape.
 *
 * theme-allow-file hand-rolled-plot — two panes over one x scale is not a single plot
 */
export const C = () => (
  <svg>
    <AxisLeftNumeric scale={a} />
    <HoverOverlay width={1} height={1} />
  </svg>
)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('hand-rolled-plot')
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
    expect([annotation, rules.has('hand-rolled-plot')]).toEqual([annotation, true])
  })

  it('a prose docblock line mentioning theme-allow-file does not declare the file', () => {
    const { rules } = twoNodes(
      '{/* the shape to write here is a theme-allow-file hand-rolled-plot — see the docs */}',
    )
    expect(rules).toContain('hand-rolled-plot')
  })

  // ── REJECTED — a longer word that merely STARTS with the token ─────────────

  // `theme-allow-unscoped` is a KIND NAME, written in prose constantly. It used to consume no id,
  // fall through to the empty-`rules` branch, and read as a blanket waiver.
  it('a comment starting with the kind name `theme-allow-unscoped` is not an annotation', () => {
    const { rules } = twoNodes('{/* theme-allow-unscoped is what reports a bare waiver */}')
    expect(rules).toContain('hand-rolled-plot')
  })

  // ── REJECTED — a bare file declaration, and a typo'd id ────────────────────

  it('a BARE theme-allow-file waives nothing — file scope must name its ids', () => {
    const { code, rules } = twoNodes('{/* theme-allow-file — everything in here is bespoke */}')
    expect(code).toBe(1)
    expect(rules).toContain('hand-rolled-plot')
  })

  it("a theme-allow-file naming a typo'd id waives nothing", () => {
    const { rules } = twoNodes('{/* theme-allow-file hand-rolled-plott — a reason */}')
    expect(rules).toContain('hand-rolled-plot')
  })

  it('a theme-allow-file scoped to a DIFFERENT rule does not waive this one', () => {
    const { rules } = twoNodes('{/* theme-allow-file raw-hex — the swatch is a measured pixel */}')
    expect(rules).toContain('hand-rolled-plot')
  })

  // ── REJECTED — the token inside a string literal, not a comment ────────────

  it('the token inside a string literal is code, not an annotation', () => {
    const { rules } = twoNodes("{'theme-allow hand-rolled-plot — a reason'}")
    expect(rules).toContain('hand-rolled-plot')
  })
})

// ── chart-legend-literal ─────────────────────────────────────────────────────

describe('basalt/chart-legend-literal', () => {
  it('flags a hand-authored items array', () => {
    const { code, rules } = run(
      `${CHARTS_IMPORT}export const C = () => <ChartLegend items={[{ key: 'a', label: 'A', color: 'red' }]} />\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('chart-legend-literal')
  })

  it('does NOT flag items derived from the series descriptor', () => {
    const { code, rules } = run(
      `${CHARTS_IMPORT}export const C = () => <ChartLegend items={deriveLegend(series)} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('chart-legend-literal')
  })

  it('does NOT flag a derived-and-extended list — that is legitimate composition', () => {
    const { code, rules } = run(
      `${CHARTS_IMPORT}export const C = () => <ChartLegend items={[...deriveLegend(series), note]} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('chart-legend-literal')
  })

  it('honors a theme-allow escape', () => {
    const { code, rules } = run(
      `${CHARTS_IMPORT}export const C = () => (
  // theme-allow: static reference legend, no series behind it
  <ChartLegend items={[{ key: 'a', label: 'A', color: 'red' }]} />
)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('chart-legend-literal')
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
    const { rules } = run(`export function ReadingProgress() { return null }\n`)
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

describe('PLUGIN_RULE_GRACE', () => {
  const shipped = JSON.parse(readFileSync(resolve(import.meta.dirname, 'oxlint.json'), 'utf8')) as {
    rules: Record<string, unknown>
  }
  const pkgVersion = (
    JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'package.json'), 'utf8')) as {
      version: string
    }
  ).version
  const graceEntries = Object.entries(PLUGIN_RULE_GRACE) as [string, GraceEntry][]
  const advisoryEntries = Object.entries(PLUGIN_RULE_ADVISORY) as [
    string,
    { since: string; why: string },
  ][]
  const graceIds = graceEntries.map(([id]) => id)
  const advisoryIds = advisoryEntries.map(([id]) => id)
  const shippedBasaltIds = Object.keys(shipped.rules).filter((id) => id.startsWith('basalt/'))

  // The mechanism whose ABSENCE let three rules sit at `warn` for up to twelve minors with nothing
  // tracking them. Deleting a ledger entry IS the promotion, and this test makes flipping the
  // shipped level part of the same commit.
  it('every grace and advisory entry is warn in the shipped preset', () => {
    for (const id of [...graceIds, ...advisoryIds])
      expect(shipped.rules[`basalt/${id}`]).toBe('warn')
  })

  it('every shipped rule NOT in either ledger is error', () => {
    for (const id of shippedBasaltIds) {
      const bareId = id.slice('basalt/'.length)
      if (graceIds.includes(bareId) || advisoryIds.includes(bareId)) continue
      expect([id, shipped.rules[id]]).toEqual([id, 'error'])
    }
  })

  it('every entry carries a written why', () => {
    for (const [id, entry] of [...graceEntries, ...advisoryEntries]) {
      if (entry.why.length <= 40)
        throw new Error(`${id}: \`why\` must be longer than 40 characters.`)
      expect(entry.why.length).toBeGreaterThan(40)
    }
  })

  // The C16 version gate, run against the REAL ledger and REAL package version — covers `since` <
  // `promote` and "no entry has reached its promote version" in one call. ADVISORY entries are
  // exempt by design (see `assertGraceLedger`'s synthetic coverage above for the gate itself).
  it('passes the C16 gate against the real ledger and package version', () => {
    expect(() => assertGraceLedger(Object.fromEntries(graceEntries), pkgVersion)).not.toThrow()
  })
})

// ── chart-legend-literal: the .map() half ────────────────────────────────────

describe('basalt/chart-legend-literal — derived-from-series', () => {
  const IMPORT = `import { ChartLegend } from 'basalt-ui/charts'\n`

  // Deriving from *an* array is not deriving from *the* series: every field of a
  // `refLines.map(...)` / `PACE_ZONES.map(...)` legend is authored at the call site, and the list
  // can keep naming a band the plot no longer draws exactly like a `[...]` literal can.
  it('flags a .map() over a non-series array', () => {
    const { code, rules } = run(
      `${IMPORT}export const C = () => <ChartLegend items={refLines.map((r) => ({ key: r.k, label: r.l }))} />\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('chart-legend-literal')
  })

  it('does NOT flag a .map() over the series', () => {
    const { code, rules } = run(
      `${IMPORT}export const C = () => <ChartLegend items={series.map((s) => ({ key: s.key }))} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('chart-legend-literal')
  })

  it('does NOT flag a .map() over a derived series binding', () => {
    const { code, rules } = run(
      `${IMPORT}export const C = () => <ChartLegend items={visibleSeries.map((s) => ({ key: s.key }))} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('chart-legend-literal')
  })

  it('does NOT flag deriveLegend(series)', () => {
    const { code, rules } = run(
      `${IMPORT}export const C = () => <ChartLegend items={deriveLegend(series)} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('chart-legend-literal')
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
  it('contains nothing else — it is exactly the union of the two registries', () => {
    const expected = [
      ...new Set([...Object.keys(basaltPlugin.rules), ...Object.keys(GUARD_RULES)]),
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
})

describe('basalt/control-size-literal', () => {
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

describe('basalt/page-bar-budget', () => {
  it('flags two PageBars in the SAME returned tree — the pair that mounts together', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}export const C = () => (\n  <>\n    <PageBar title="A" />\n    <PageBar title="B" />\n  </>\n)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('page-bar-budget')
  })

  // The two false positives the per-FILE count produced. Neither renders two bars at once, so
  // nothing races for the portal node — and the only escape was a theme-allow on correct code.
  it('does NOT flag an early-return loading state and the loaded bar', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}export const C = ({ data }) => {\n  if (!data) return <PageBar title="Jobs" />\n  return <PageBar title="Jobs" actions={{ primary: { key: 'r', label: 'Run' } }} />\n}\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('page-bar-budget')
  })

  it('does NOT flag two page components exported from one file', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}export const ListPage = () => <PageBar title="Jobs" />\nexport const DetailPage = () => <PageBar title="Job" />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('page-bar-budget')
  })

  it("does NOT flag a consumer's own PageBar-named component", () => {
    const { code, rules } = run(
      `import { PageBar } from './chrome/page-bar'\nexport const C = () => (\n  <>\n    <PageBar title="A" />\n    <PageBar title="B" />\n  </>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('page-bar-budget')
  })

  it('flags a 5-entry actions.secondary array', () => {
    const five = [1, 2, 3, 4, 5].map((n) => `{ key: '${n}', label: '${n}' }`).join(', ')
    const { code, rules } = run(
      `${BASALT_IMPORT}export const C = () => <PageBar actions={{ secondary: [${five}] }} />\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('page-bar-budget')
  })

  it('does NOT flag a 4-entry actions.secondary array', () => {
    const four = [1, 2, 3, 4].map((n) => `{ key: '${n}', label: '${n}' }`).join(', ')
    const { code, rules } = run(
      `${BASALT_IMPORT}export const C = () => <PageBar actions={{ secondary: [${four}] }} />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('page-bar-budget')
  })

  it('flags a 4-entry Section actions array (budget 3)', () => {
    const four = [1, 2, 3, 4].map((n) => `{ key: '${n}', label: '${n}' }`).join(', ')
    const { rules } = run(
      `${BASALT_IMPORT}export const C = () => <Section actions={[${four}]} />\n`,
    )
    expect(rules).toContain('page-bar-budget')
  })

  it('flags a second variant="filled" inside one slot', () => {
    const { rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => (\n  <PageBar actions={<><Button variant="filled">A</Button><Button variant="filled">B</Button></>} />\n)\n`,
    )
    expect(rules).toContain('page-bar-budget')
  })

  it('does NOT flag one filled action beside a default one', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}${MANTINE_IMPORT}export const C = () => (\n  <PageBar actions={<><Button variant="filled">A</Button><Button variant="default">B</Button></>} />\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('page-bar-budget')
  })

  // The `filled` count is a PRIMARY-ACTION count: a filled Badge is Mantine's default Badge
  // variant and the ordinary way a header states a count (law C11 asks for one), and an overlay's
  // submit button is not in the bar at all.
  it('does NOT flag a filled Badge beside the one filled Button', () => {
    const { code, rules } = run(
      `${BASALT_IMPORT}import { Badge, Button } from '@mantine/core'\n` +
        `export const C = () => (\n  <Section title="T" actions={<><Button variant="filled">Run</Button><Badge variant="filled">3</Badge></>} />\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('page-bar-budget')
  })

  it('does NOT flag a filled ThemeIcon beside the one filled Button', () => {
    const { rules } = run(
      `${BASALT_IMPORT}import { Button, ThemeIcon } from '@mantine/core'\n` +
        `export const C = () => (\n  <Section title="T" actions={<><Button variant="filled">Run</Button><ThemeIcon variant="filled" /></>} />\n)\n`,
    )
    expect(rules).not.toContain('page-bar-budget')
  })

  it("does NOT flag a Modal's own filled submit button colocated in the slot", () => {
    const { rules } = run(
      `${BASALT_IMPORT}import { Button, Modal } from '@mantine/core'\n` +
        `export const C = () => (\n  <PageBar actions={<><Button variant="filled">New</Button><Modal opened><Button variant="filled">Save</Button></Modal></>} />\n)\n`,
    )
    expect(rules).not.toContain('page-bar-budget')
  })

  it('honors a scoped theme-allow', () => {
    const { rules } = run(
      `${BASALT_IMPORT}export const C = () => (\n  <>\n    <PageBar title="A" />\n    {/* theme-allow page-bar-budget — the print-only variant */}\n    <PageBar title="B" />\n  </>\n)\n`,
    )
    expect(rules).not.toContain('page-bar-budget')
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
    const { code, rules } = run(
      `export const C = () => (\n  <div>\n    <SegmentedControl visibleFrom="sm" data={[]} />\n    <SegmentedControl hiddenFrom="md" data={[]} />\n  </div>\n)\n`,
    )
    expect(code).toBe(0)
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
      'control-outside-home',
      'control-size-literal',
      'hand-rolled-filter',
      'responsive-twin',
    ])
  })
})
