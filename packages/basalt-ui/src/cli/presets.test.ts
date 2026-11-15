/**
 * The consumer oxlint preset `sync` writes: the zone blocks `buildPreset` lays out for the shipped
 * files, over the manifest's roots and ejected paths (lint cycle 1, lint-1.3).
 */
import { describe, expect, it } from 'bun:test'

import { packageRoot } from './index'
import type { Manifest } from './manifest'
import { renderOxlintPreset } from './presets'

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

  it('without roots or ejected rows the preset is the shipped profile', () => {
    expect(overridesOf(manifest({}))).toEqual([])
  })
})
