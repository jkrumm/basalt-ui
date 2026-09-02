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
  DEPRECATED_EXPORTS,
  KNOWN_RULE_IDS,
  PLUGIN_RULE_ADVISORY,
  PLUGIN_RULE_GRACE,
  RETIRED_RULE_IDS,
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
        'basalt/provider-above-router': 'error',
        'basalt/duplicate-notifications-mount': 'error',
        'basalt/query-dual-import': 'error',
        'basalt/query-fn-unwrap': 'error',
        'basalt/deprecated-export': 'error',
        'basalt/forms-field-key': 'error',
        'basalt/no-raw-font-size': 'error',
        'basalt/raw-size-literal': 'error',
        'basalt/card-inset': 'error',
        'basalt/chart-in-raw-surface': 'error',
        'basalt/hand-rolled-plot': 'error',
        'basalt/chart-legend-literal': 'error',
        'basalt/shadow-basalt-export': 'error',
        'basalt/hand-rolled-shell': 'error',
        'basalt/raw-scroll-container': 'error',
        'basalt/hand-rolled-filter': 'error',
        'basalt/control-outside-home': 'error',
        'basalt/bound-control-outside-home': 'error',
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
  // `RETIRED_RULE_IDS` adds a third component: an id that used to be a guard kind, is in neither
  // live registry, and must still parse as a (dead) waiver rather than a typo.
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

  // FormRow/FormGroup (`basalt-ui/forms`) are law C1's third home written for a `<form>` rather
  // than a settings page — the same non-home treatment SettingsRow gets, via the same
  // CONTROL_HOST_TAGS ancestry walk.
  it.each(['FormRow', 'FormGroup'])(
    'does NOT flag a raw Select nested inside a %s imported from basalt-ui/forms',
    (host) => {
      const { code, rules } = run(
        `import { ${host} } from 'basalt-ui/forms'\n${MANTINE_IMPORT}` +
          `export const C = () => <${host} label="L"><Select data={[]} /></${host}>\n`,
      )
      expect(code).toBe(0)
      expect(rules).not.toContain('control-outside-home')
    },
  )

  it('still flags a bare Select in a page body with no FormRow/FormGroup around it', () => {
    const { rules } = run(
      `${MANTINE_IMPORT}export const C = () => <div><Select data={[]} /></div>\n`,
    )
    expect(rules).toContain('control-outside-home')
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
    // CLAUDE.md included) can never write `foo-panel.tsx`, so the kebab form alone exempted nothing
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
      `import { ${host} } from 'basalt-ui/forms'\n${CONTROLS_IMPORT}` +
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

// ── provider-above-router (F5) ───────────────────────────────────────────────

describe('basalt/provider-above-router', () => {
  const IMPORTS =
    `import { BasaltProvider } from 'basalt-ui'\n` +
    `import { RouterProvider } from '@tanstack/react-router'\n`

  it('flags a BasaltProvider rendered inside a RouterProvider', () => {
    const { code, rules } = run(
      `${IMPORTS}export const App = () => (\n` +
        `  <RouterProvider router={r}>\n    <BasaltProvider>{null}</BasaltProvider>\n` +
        `  </RouterProvider>\n)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('provider-above-router')
  })

  it('does NOT flag the correct order — provider above router', () => {
    const { code, rules } = run(
      `${IMPORTS}export const App = () => (\n` +
        `  <BasaltProvider>\n    <RouterProvider router={r} />\n  </BasaltProvider>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('provider-above-router')
  })

  // Provenance both ways: the tag names alone are not the finding.
  it("does NOT flag a consumer's own BasaltProvider (no basalt import)", () => {
    const { code, rules } = run(
      `import { RouterProvider } from '@tanstack/react-router'\n` +
        `import { BasaltProvider } from './my-provider'\n` +
        `export const App = () => (\n  <RouterProvider router={r}>\n` +
        `    <BasaltProvider>{null}</BasaltProvider>\n  </RouterProvider>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('provider-above-router')
  })

  it('does NOT flag a RouterProvider that is not TanStack s', () => {
    const { code, rules } = run(
      `import { BasaltProvider } from 'basalt-ui'\n` +
        `import { RouterProvider } from 'other-router'\n` +
        `export const App = () => (\n  <RouterProvider router={r}>\n` +
        `    <BasaltProvider>{null}</BasaltProvider>\n  </RouterProvider>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('provider-above-router')
  })

  // The alias is why the ancestry is read by BINDING and not by written tag name.
  it('flags through an aliased RouterProvider import', () => {
    const { code, rules } = run(
      `import { BasaltProvider } from 'basalt-ui'\n` +
        `import { RouterProvider as Router } from '@tanstack/react-router'\n` +
        `export const App = () => (\n  <Router router={r}>\n` +
        `    <BasaltProvider>{null}</BasaltProvider>\n  </Router>\n)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('provider-above-router')
  })

  it('honours a theme-allow naming the rule', () => {
    const { code, rules } = run(
      `${IMPORTS}export const App = () => (\n  <RouterProvider router={r}>\n` +
        `    {/* theme-allow provider-above-router — legacy bootstrap, ported next minor */}\n` +
        `    <BasaltProvider>{null}</BasaltProvider>\n  </RouterProvider>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('provider-above-router')
  })

  // The documented limit of the heuristic — stated in the rule's own JSDoc, pinned here so a
  // future widening has to move this test rather than discover the gap.
  it('does NOT see a cross-file composition (static JSX ancestry only)', () => {
    const { code, rules } = run(
      `import { BasaltProvider } from 'basalt-ui'\n` +
        `import { Routes } from './routes'\n` +
        `export const App = () => (\n  <Routes>\n    <BasaltProvider>{null}</BasaltProvider>\n` +
        `  </Routes>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('provider-above-router')
  })
})

// ── duplicate-notifications-mount (F5) ───────────────────────────────────────

describe('basalt/duplicate-notifications-mount', () => {
  const IMPORTS =
    `import { BasaltOverlays } from 'basalt-ui/commands'\n` +
    `import { BasaltNotifications } from 'basalt-ui/notifications'\n`

  it('flags both mounts in one file', () => {
    const { code, rules } = run(
      `${IMPORTS}export const App = () => (\n  <BasaltOverlays notifications>\n` +
        `    <BasaltNotifications />\n  </BasaltOverlays>\n)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('duplicate-notifications-mount')
  })

  // `notifications` defaults to TRUE, so the attribute being absent is the same defect.
  it('flags when BasaltOverlays writes no notifications prop at all', () => {
    const { code, rules } = run(
      `${IMPORTS}export const App = () => (\n  <BasaltOverlays>\n` +
        `    <BasaltNotifications />\n  </BasaltOverlays>\n)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('duplicate-notifications-mount')
  })

  it('does NOT flag when BasaltOverlays disables its notifications layer', () => {
    const { code, rules } = run(
      `${IMPORTS}export const App = () => (\n  <BasaltOverlays notifications={false}>\n` +
        `    <BasaltNotifications />\n  </BasaltOverlays>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('duplicate-notifications-mount')
  })

  it('does NOT flag a standalone BasaltNotifications on its own', () => {
    const { code, rules } = run(
      `import { BasaltNotifications } from 'basalt-ui/notifications'\n` +
        `export const App = () => <BasaltNotifications />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('duplicate-notifications-mount')
  })

  it("does NOT flag a consumer's own components of the same names", () => {
    const { code, rules } = run(
      `import { BasaltOverlays } from './overlays'\n` +
        `import { BasaltNotifications } from './notifications'\n` +
        `export const App = () => (\n  <BasaltOverlays>\n    <BasaltNotifications />\n` +
        `  </BasaltOverlays>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('duplicate-notifications-mount')
  })

  it('honours a theme-allow naming the rule', () => {
    const { code, rules } = run(
      `${IMPORTS}export const App = () => (\n  <BasaltOverlays notifications>\n` +
        `    {/* theme-allow duplicate-notifications-mount — two roots, never both mounted */}\n` +
        `    <BasaltNotifications />\n  </BasaltOverlays>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('duplicate-notifications-mount')
  })

  // Two mounts WRITTEN, one mount RENDERED — the ternary is the shape a consumer reaches for while
  // migrating from the standalone layer to the composed one, and it was never a double mount.
  it('does NOT flag the two branches of one ternary', () => {
    const { code, rules } = run(
      `${IMPORTS}export const App = ({ composed }) => (\n` +
        `  <div>{composed ? <BasaltOverlays /> : <BasaltNotifications />}</div>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('duplicate-notifications-mount')
  })

  it('does NOT flag the two operands of one logical expression', () => {
    const { code, rules } = run(
      `${IMPORTS}export const App = ({ composed }) => (\n` +
        `  <div>{(composed && <BasaltOverlays />) || <BasaltNotifications />}</div>\n)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('duplicate-notifications-mount')
  })

  // The exemption is the NEAREST common ancestor only. Two separate `&&` guards can both hold, so
  // this stays a finding — the pair is conditional, not exclusive.
  it('DOES flag two independently-guarded mounts under one parent', () => {
    const { code, rules } = run(
      `${IMPORTS}export const App = ({ a, b }) => (\n` +
        `  <div>{a && <BasaltOverlays />}{b && <BasaltNotifications />}</div>\n)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('duplicate-notifications-mount')
  })

  // One exclusive pair does not excuse a second, unconditional overlays mount.
  it('DOES flag when a NON-exclusive overlays mount also exists', () => {
    const { code, rules } = run(
      `${IMPORTS}export const App = ({ composed }) => (\n` +
        `  <BasaltOverlays>\n` +
        `    {composed ? <BasaltOverlays /> : <BasaltNotifications />}\n` +
        `  </BasaltOverlays>\n)\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('duplicate-notifications-mount')
  })
})

// ── query-dual-import (F5) ───────────────────────────────────────────────────

describe('basalt/query-dual-import', () => {
  it('flags a file importing from both @tanstack/react-query and basalt-ui/query', () => {
    const { code, rules, output } = run(
      `import { useQuery } from '@tanstack/react-query'\n` +
        `import { unwrap } from 'basalt-ui/query'\n` +
        `export const useThing = () => useQuery({ queryKey: ['t'], queryFn: () => unwrap(get()) })\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('query-dual-import')
    expect(output).toContain('Dual query import')
  })

  // The softer half — the one that actually catches the drift, and why the rule is `warn`.
  it('flags a raw @tanstack/react-query import beside a basalt root import', () => {
    const { code, rules, output } = run(
      `import { useQuery } from '@tanstack/react-query'\n` +
        `import { QueryState } from 'basalt-ui'\n` +
        `export const useThing = () => useQuery({ queryKey: ['t'], queryFn: get })\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('query-dual-import')
    expect(output).toContain('Raw @tanstack/react-query import')
  })

  it('does NOT flag basalt-ui/query on its own', () => {
    const { code, rules } = run(
      `import { useQuery, unwrap } from 'basalt-ui/query'\n` +
        `export const useThing = () => useQuery({ queryKey: ['t'], queryFn: () => unwrap(get()) })\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('query-dual-import')
  })

  // `import type` is erased at compile time — there is no runtime import to route through the
  // seam, and typing against the library's own result type is what `QueryStateLike` documents as
  // legitimate. Same skip `agent-no-raw-usechat` and `ai-sdk-major` take.
  it('does NOT flag a type-only @tanstack/react-query import beside basalt-ui/query', () => {
    const { code, rules } = run(
      `import type { UseQueryResult } from '@tanstack/react-query'\n` +
        `import { unwrap } from 'basalt-ui/query'\n` +
        `export const pick = (q: UseQueryResult<number>) => unwrap(q.data)\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('query-dual-import')
  })

  it('does NOT flag @tanstack/react-query in a file with no basalt import', () => {
    const { code, rules } = run(
      `import { useQuery } from '@tanstack/react-query'\n` +
        `export const useThing = () => useQuery({ queryKey: ['t'], queryFn: get })\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('query-dual-import')
  })

  // The devtools package is a different package, not a subpath.
  it('does NOT flag @tanstack/react-query-devtools', () => {
    const { code, rules } = run(
      `import { ReactQueryDevtools } from '@tanstack/react-query-devtools'\n` +
        `import { unwrap } from 'basalt-ui/query'\n` +
        `export const D = () => <ReactQueryDevtools />\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('query-dual-import')
  })

  it('honours a theme-allow naming the rule', () => {
    const { code, rules } = run(
      `// theme-allow query-dual-import — the persister API has no basalt re-export yet\n` +
        `import { useQuery } from '@tanstack/react-query'\n` +
        `import { unwrap } from 'basalt-ui/query'\n` +
        `export const useThing = () => useQuery({ queryKey: ['t'], queryFn: () => unwrap(g()) })\n`,
    )
    expect(code).toBe(0)
    expect(rules).not.toContain('query-dual-import')
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

// ── deprecated-export (B4) ───────────────────────────────────────────────────

// deprecated-export's behaviour tests were removed with the last ledger row in 1.29.0; the
// ledger-shape and barrel-scan assertions below keep the mechanism honest until the next row.

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

  // The second message: `field` still RETURNS `key`, so it is reported whether or not the element
  // carries one — the remedy is the rename, never an added attribute.
  it('flags a spread field() even when the element already has a key', () => {
    const { code, rules, output } = run(
      `import { field } from 'basalt-ui/forms'\n` +
        `export const C = () => <TextInput key="e" {...field(form, 'email')} />\n`,
    )
    expect(code).toBe(1)
    expect(rules).toContain('forms-field-key')
    expect(output).toContain('@deprecated 1.27 alias')
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

// ── the deprecation ledger (B4) ──────────────────────────────────────────────

describe('DEPRECATED_EXPORTS', () => {
  const pkgVersion = (
    JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'package.json'), 'utf8')) as {
      version: string
    }
  ).version

  it('carries a replacement and a removeIn at least one minor out on every row', () => {
    const [major, minor] = pkgVersion.split('.').map(Number)
    const floor = `${major}.${(minor as number) + 1}.0`
    for (const row of DEPRECATED_EXPORTS) {
      expect([row.name, row.replacement.length > 0]).toEqual([row.name, true])
      expect([row.name, /^\d+\.\d+\.\d+$/.test(row.removeIn)]).toEqual([row.name, true])
      expect([row.name, compareSemver(row.removeIn, floor) >= 0]).toEqual([row.name, true])
    }
  })

  it('names a real published subpath on every row', () => {
    const exports = Object.keys(
      (
        JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'package.json'), 'utf8')) as {
          exports: Record<string, unknown>
        }
      ).exports,
    )
    for (const row of DEPRECATED_EXPORTS) {
      const subpath = row.subpath === 'basalt-ui' ? '.' : row.subpath.replace('basalt-ui', '.')
      expect([row.subpath, exports.includes(subpath)]).toEqual([row.subpath, true])
    }
  })

  /**
   * The barrel half of the lifecycle: a JSDoc `@deprecated` on a published barrel with no ledger
   * row is an export nothing nudges anyone off. Deliberately scoped to `src/**' + '/index.ts(x)` —
   * the files a consumer's import resolves through. To add one: write the `@deprecated` JSDoc, add
   * the `DEPRECATED_EXPORTS` row, add the `MIGRATING.md` row.
   */
  it('has a row for every @deprecated JSDoc tag on a published barrel', () => {
    const barrels = [
      ...new Bun.Glob('src/**/index.{ts,tsx}').scanSync({
        cwd: resolve(import.meta.dirname, '..'),
        absolute: true,
      }),
    ]
    const names = new Set(DEPRECATED_EXPORTS.map((row) => row.prop ?? row.name))
    for (const file of barrels) {
      const lines = readFileSync(file, 'utf8').split('\n')
      for (const [index, line] of lines.entries()) {
        if (!/^\s*\*\s*@deprecated\b/.test(line)) continue
        const declared = lines
          .slice(index, index + 12)
          .map((l) => /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*[:(]/.exec(l)?.[1])
          .find((name) => name !== undefined)
        expect([file, declared, declared !== undefined && names.has(declared)]).toEqual([
          file,
          declared,
          true,
        ])
      }
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
  const shipped = JSON.parse(readFileSync(resolve(import.meta.dirname, 'oxlint.json'), 'utf8')) as {
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
    it(`${id}: the claim matches oxlint.json`, () => {
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
      if (Object.hasOwn(PLUGIN_RULE_ADVISORY, id)) {
        expect([id, claim]).toEqual([id, 'warn (advisory)'])
        expect([id, level]).toEqual([id, 'warn'])
        return
      }
      expect([id, claim]).toEqual([id, 'error'])
      expect([id, level]).toEqual([id, 'error'])
    })
  }
})
