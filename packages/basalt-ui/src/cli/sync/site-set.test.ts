/**
 * The agent set a profile receives (`AGENT_SETS` in render.ts): a `site` root gets the tokens rule,
 * the site rule and the site skill, and no placed text cites a lint rule its preset turns off or a
 * skill it was not given.
 */
import { describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'

import { checkRuleTags, loadSources } from '../../../scripts/check-rule-tags'
import type { Manifest, Profile } from '../manifest'
import { offLintIds, renderBlock, renderManaged, withoutOffTags } from './render'

const PKG = resolve(import.meta.dir, '../../..')

const manifest = (roots: Record<string, Profile>): Manifest => ({
  profile: Object.values(roots)[0] ?? 'app',
  version: '',
  roots,
  ejected: {},
  managed: {},
  deepRender: [],
  authoredContent: [],
  viewports: [],
  tokens: [],
  rest: {},
})

const APP_ONLY = [
  'basalt-app',
  'basalt-charts',
  'basalt-design',
  'basalt-page',
  'basalt-state',
  'basalt-ui',
]

describe('the agent set per profile', () => {
  const site = renderManaged(PKG, manifest({ '.': 'site' }))

  it('a site root gets the tokens rule, the site rule and the site skill, nothing else', () => {
    expect(site.map((u) => u.path)).toEqual([
      '.claude/rules/basalt-site.md',
      '.claude/rules/basalt-tokens.md',
      '.claude/skills/basalt-site/SKILL.md',
    ])
  })

  it('an app root gets every file but the site ones', () => {
    const paths = renderManaged(PKG, manifest({ src: 'app' })).map((u) => u.path)
    expect(paths.some((p) => p.includes('basalt-site'))).toBe(false)
    for (const name of APP_ONLY) expect(paths.some((p) => p.includes(`/${name}`))).toBe(true)
  })

  it('every tag a site root is placed resolves against the site preset and the published entries', () => {
    const all = loadSources()
    const off = offLintIds(PKG, 'site')
    expect(off.size).toBeGreaterThan(0)
    const sources = { ...all, lintIds: new Set([...all.lintIds].filter((id) => !off.has(id))) }
    for (const unit of site.filter((u) => u.path.startsWith('.claude/rules/'))) {
      expect({ path: unit.path, failures: checkRuleTags(unit.content, sources).failures }).toEqual({
        path: unit.path,
        failures: [],
      })
    }
  })

  it('no placed text or block cites an off lint id or a skill, rule or subagent the site was not given', () => {
    const off = offLintIds(PKG, 'site')
    const block = renderBlock(PKG, manifest({ '.': 'site' }), '3.0.0') ?? ''
    expect(block).toContain('basalt-site')
    for (const text of [...site.map((u) => u.content), block]) {
      for (const [, id] of text.matchAll(/\[lint:([a-z0-9-]+)\]/g))
        expect(off.has(id ?? '')).toBe(false)
      for (const name of [
        'basalt-app',
        'basalt-charts',
        'basalt-design',
        'basalt-design-reviewer',
      ]) {
        expect(text).not.toMatch(new RegExp(`\\b${name}(?![\\w-])`))
      }
      for (const name of ['basalt-page', 'basalt-state', 'basalt-ui', 'basalt-charts']) {
        expect(text).not.toContain(`${name}.md`)
      }
    }
  })

  it('a mixed install keys each rule on the roots that receive it', () => {
    const units = renderManaged(PKG, manifest({ site: 'site', src: 'app' }))
    const rule = (name: string): string =>
      units.find((u) => u.path === `.claude/rules/${name}.md`)?.content ?? ''
    expect(rule('basalt-site')).toContain("paths:\n  - 'site/**'\n---")
    expect(rule('basalt-page')).toContain("paths:\n  - 'src/**'\n---")
    expect(rule('basalt-tokens')).toContain("  - 'site/**'\n  - 'src/**'\n")
    expect(rule('basalt-tokens')).toContain('[lint:app-spacing]')
  })
})

describe('withoutOffTags', () => {
  it('drops an off tag, and a bullet left with none', () => {
    const text = [
      '# R',
      '',
      '- Kept. [lint:a] [lint:b]',
      '- Gone, wrapped',
      '  over two lines. [lint:b]',
      '- Typed. [type:T]',
      '',
    ].join('\n')
    expect(withoutOffTags(text, new Set(['b']))).toBe(
      ['# R', '', '- Kept. [lint:a]', '- Typed. [type:T]', ''].join('\n'),
    )
  })
})
