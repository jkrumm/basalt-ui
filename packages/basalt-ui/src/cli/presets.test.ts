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

  it('zone E merges the Base UI vars with the grid track allow', () => {
    const path = 'src/components/ui/button.tsx'
    const zone = overridesOf(manifest({ ejected: { '.#button': row(path) } })).find(
      (o) => o.files.includes(path) && 'shadcn/no-restyle' in o.rules,
    )
    const rule = zone?.rules['shadcn/no-arbitrary-values'] as [string, { allow: string[] }]
    const options = rule[1]
    expect(options.allow).toContain('origin-(--transform-origin)')
    expect(options.allow).toContain('grid-cols-[*]')
  })

  it('classPrefixes allow a third-party prefix, bare and under a variant', () => {
    expect(rulesOf(manifest({}))['shadcn/no-unknown-classes']).toBe('error')
    expect(
      rulesOf(manifest({ classPrefixes: ['maplibregl-'] }))['shadcn/no-unknown-classes'],
    ).toEqual(['error', { allow: ['maplibregl-*', '*:maplibregl-*'] }])
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
