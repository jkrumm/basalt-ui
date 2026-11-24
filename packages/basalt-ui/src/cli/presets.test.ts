/**
 * The consumer oxlint preset `sync` writes: the zone blocks `buildPreset` lays out for the shipped
 * files, over the manifest's roots and ejected paths (lint cycle 1, lint-1.3).
 */
import { describe, expect, it } from 'bun:test'

import { packageRoot } from './index'
import type { Manifest } from './manifest'
import { parseManifest, serializeManifest } from './manifest'
import { renderOxlintPreset, renderStylelintPreset } from './presets'

type Override = { files: string[]; rules: Record<string, unknown> }

const manifest = (over: Partial<Manifest>): Manifest => ({
  profile: 'app',
  version: '3.0.0',
  roots: {},
  ejected: {},
  managed: {},
  deepRender: [],
  authoredContent: [],
  viewports: [],
  tokens: [],
  rest: {},
  ...over,
})

const overridesOf = (m: Manifest): Override[] => {
  const text = renderOxlintPreset(m, packageRoot())
  return (JSON.parse(text ?? '{}') as { overrides: Override[] }).overrides
}

const rulesOf = (m: Manifest): Record<string, unknown> =>
  (JSON.parse(renderOxlintPreset(m, packageRoot()) ?? '{}') as { rules: Record<string, unknown> })
    .rules

const row = (path: string): Record<string, unknown> => ({
  path,
  fromVersion: '3.0.0',
  seedDigest: 'x',
  reason: 'probe',
  origin: 'seed',
})

describe('renderOxlintPreset', () => {
  it('tokens everywhere ships no preset', () => {
    expect(renderOxlintPreset(manifest({ profile: 'tokens' }), packageRoot())).toBeNull()
  })

  it('an ejected primitive gets zone E: structure rules off, import-boundary told its path', () => {
    const path = 'src/components/ui/button.tsx'
    const overrides = overridesOf(manifest({ ejected: { '.#button': row(path) } }))
    const zone = overrides.find((o) => o.files.includes(path) && 'shadcn/no-restyle' in o.rules)
    expect(zone?.rules).toMatchObject({
      'shadcn/no-restyle': 'off',
      'basalt/primitive-bypass': 'off',
      'basalt/app-spacing': 'off',
    })
    const boundary = overrides.find((o) => 'basalt/import-boundary' in o.rules)
    expect(boundary).toEqual({
      files: [path],
      rules: { 'basalt/import-boundary': ['error', { ejected: [path] }] },
    })
  })

  it('an ejected file under a bridge root does not switch import-boundary on', () => {
    const path = 'legacy/components/ui/button.tsx'
    const overrides = overridesOf(
      manifest({ roots: { legacy: 'bridge' }, ejected: { 'legacy#button': row(path) } }),
    )
    const boundary = overrides.filter(
      (o) => o.files.includes(path) && 'basalt/import-boundary' in o.rules,
    )
    expect(boundary).toEqual([])
    expect(overrides.some((o) => o.files.includes(path))).toBe(true)
  })

  it('a bridge root below an app default gets its components/ui zone after its rules block', () => {
    const overrides = overridesOf(manifest({ roots: { 'ex-bridge': 'bridge' } }))
    const files = overrides.map((o) => o.files[0])
    const rules = files.indexOf('ex-bridge/**')
    const vendored = files.indexOf('ex-bridge/**/components/ui/**')
    expect(rules).toBeGreaterThanOrEqual(0)
    expect(vendored).toBeGreaterThan(rules)
    expect(overrides[vendored]?.rules).toMatchObject({
      'basalt/tw-off-law': 'off',
      'shadcn/no-restyle': 'off',
    })
  })

  it('without roots or ejected rows the preset is the shipped profile plus the route-file exemption', () => {
    expect(overridesOf(manifest({}))).toEqual([
      { files: ['**/routes/**'], rules: { 'react/only-export-components': 'off' } },
    ])
  })

  it('passes a grid track list and writes the message options at the app profile', () => {
    const rules = rulesOf(manifest({}))
    expect(rules['shadcn/no-arbitrary-values']).toEqual([
      'error',
      {
        allow: ['grid-cols-[*]', 'grid-rows-[*]', '*:grid-cols-[*]', '*:grid-rows-[*]'],
        message: expect.stringContaining('step of the spacing ladder'),
      },
    ])
    const restyle = rules['shadcn/no-restyle'] as [string, { message?: { spacing?: string } }]
    expect(restyle[1].message?.spacing).not.toContain('margin')
  })

  it('zone E turns the structure rules off for the file and the color rules stay on', () => {
    const path = 'src/components/ui/button.tsx'
    const zone = overridesOf(manifest({ ejected: { '.#button': row(path) } })).find(
      (o) => o.files.includes(path) && 'shadcn/no-restyle' in o.rules,
    )
    expect(zone?.rules).toMatchObject({
      'shadcn/no-arbitrary-values': 'off',
      'shadcn/no-inline-styles': 'off',
      'basalt/raw-scroll': 'off',
      'basalt/app-spacing': 'off',
    })
    expect(zone?.rules['shadcn/no-raw-colors']).toBeUndefined()
    expect(zone?.rules['basalt/tw-off-law']).toBeUndefined()
    const forms = overridesOf(manifest({ ejected: { '.#button': row(path) } })).find(
      (o) => o.files.includes(path) && 'basalt/tw-off-law' in o.rules,
    )
    expect(forms?.rules['basalt/tw-off-law']).toEqual([
      'error',
      { formsOff: ['surface-recipe', 'app-color', 'app-color-arbitrary'] },
    ])
  })

  it('classPrefixes allow a third-party prefix, bare and under a variant', () => {
    const allowOf = (rule: unknown): string[] => (rule as [string, { allow: string[] }])[1].allow
    const plain = allowOf(rulesOf(manifest({}))['shadcn/no-unknown-classes'])
    expect(plain).not.toContain('maplibregl-*')
    const prefixed = allowOf(
      rulesOf(manifest({ classPrefixes: ['maplibregl-'] }))['shadcn/no-unknown-classes'],
    )
    expect(prefixed).toEqual([...plain, 'maplibregl-*', '*:maplibregl-*'])
  })

  it('no-unknown-classes leaves a viewport variant to viewport-keyed', () => {
    const rule = rulesOf(manifest({}))['shadcn/no-unknown-classes'] as [string, { allow: string[] }]
    expect(rule[1].allow).toEqual(
      expect.arrayContaining(['lg:*', '*:lg:*', 'max-md:*', 'min-[*]:*']),
    )
  })

  it('no-raw-colors passes a shadow size and a pre-mixed theme class, which alpha-on-premixed owns', () => {
    const rule = rulesOf(manifest({}))['shadcn/no-raw-colors'] as [string, { allow: string[] }]
    expect(rule[1].allow).toEqual(expect.arrayContaining(['shadow-sm', '*-accent', '*-scrim']))
    expect(rule[1].allow).not.toContain('shadow-*')
    // `bg-hover` is a token name, no class: no-raw-colors reports it and names `bg-accent`.
    expect(rule[1].allow).not.toContain('*-hover')
  })

  it('no-arbitrary-values names the fix by kind of value', () => {
    const rule = rulesOf(manifest({}))['shadcn/no-arbitrary-values'] as [
      string,
      { message: string },
    ]
    for (const part of [
      'Status, Lozenge, DeltaBadge',
      'ui/scroll-area',
      'gap on the parent',
      'spacing ladder',
    ]) {
      expect(rule[1].message).toContain(part)
    }
  })
})

const formsOff = (rule: unknown): unknown => (rule as [string, { formsOff?: unknown }])[1].formsOff

describe('manifest bespoke (zone B)', () => {
  it('turns off only the geometry and mark forms of primitive-bypass for the directory', () => {
    const overrides = overridesOf(manifest({ bespoke: ['src/table/'] }))
    const zone = overrides.find((o) => o.files.includes('src/table/**'))
    expect(zone).toEqual({
      files: ['src/table/**'],
      rules: {
        'basalt/primitive-bypass': ['error', { formsOff: ['svg-data-marks', 'html-data-marks'] }],
      },
    })
  })

  it('writes the block before an ejected file, so a copy inside the directory keeps the rule off', () => {
    const path = 'src/table/ui/button.tsx'
    const overrides = overridesOf(
      manifest({ bespoke: ['src/table'], ejected: { '.#button': row(path) } }),
    )
    const bespoke = overrides.findIndex((o) => o.files.includes('src/table/**'))
    const ejected = overrides.findIndex(
      (o) => o.files.includes(path) && o.rules['basalt/primitive-bypass'] === 'off',
    )
    expect(bespoke).toBeGreaterThanOrEqual(0)
    expect(ejected).toBeGreaterThan(bespoke)
  })

  it('a directory under a bridge root gets no block: primitive-bypass does not run there', () => {
    const overrides = overridesOf(
      manifest({ roots: { legacy: 'bridge' }, bespoke: ['legacy/table'] }),
    )
    expect(overrides.some((o) => o.files.includes('legacy/table/**'))).toBe(false)
    expect(formsOff(rulesOf(manifest({ bespoke: ['src/table'] }))['basalt/primitive-bypass'])).toBe(
      undefined,
    )
  })

  it('round-trips, is absent when unset, and refuses the root, a glob or a parent path', () => {
    const parsed = parseManifest(serializeManifest(manifest({ bespoke: ['src/table'] })))
    expect('manifest' in parsed && parsed.manifest.bespoke).toEqual(['src/table'])
    const bare = parseManifest(JSON.stringify({ profile: 'app', version: '3.0.0' }))
    expect('manifest' in bare && bare.manifest.bespoke).toBeUndefined()
    for (const dir of ['.', './', './.', '././', 'src/**', '../table', '/abs']) {
      expect([
        dir,
        'error' in parseManifest(JSON.stringify({ profile: 'app', bespoke: [dir] })),
      ]).toEqual([dir, true])
    }
  })
})

describe('manifest classPrefixes', () => {
  it('round-trips, is absent when unset, and rejects a non-string list', () => {
    const text = serializeManifest(manifest({ classPrefixes: ['maplibregl-'] }))
    const parsed = parseManifest(text)
    expect('manifest' in parsed && parsed.manifest.classPrefixes).toEqual(['maplibregl-'])
    const bare = parseManifest(JSON.stringify({ profile: 'app', version: '3.0.0' }))
    expect('manifest' in bare && bare.manifest.classPrefixes).toBeUndefined()
    expect('error' in parseManifest(JSON.stringify({ profile: 'app', classPrefixes: [1] }))).toBe(
      true,
    )
  })
})

const bansScroll = (rules: Record<string, unknown>): boolean =>
  JSON.stringify(rules['declaration-property-value-disallowed-list']).includes('overflow')

describe('renderStylelintPreset', () => {
  type Config = { rules: Record<string, unknown>; overrides: { files: string[] }[] }
  const configOf = (over: Partial<Manifest>): Config =>
    JSON.parse(renderStylelintPreset(manifest(over))) as Config

  it('a tokens or bridge manifest renders without the scroll ban', () => {
    for (const profile of ['tokens', 'bridge'] as const) {
      expect(bansScroll(configOf({ profile }).rules)).toBe(false)
    }
  })

  it('a parts or app manifest keeps it', () => {
    for (const profile of ['parts', 'app'] as const) {
      expect(bansScroll(configOf({ profile }).rules)).toBe(true)
    }
  })

  it('a root at another scroll state gets an override', () => {
    const config = configOf({ profile: 'app', roots: { site: 'tokens', src: 'app' } })
    expect(bansScroll(config.rules)).toBe(true)
    expect(config.overrides.slice(1).map((o) => o.files)).toEqual([['site/**']])
  })
})
