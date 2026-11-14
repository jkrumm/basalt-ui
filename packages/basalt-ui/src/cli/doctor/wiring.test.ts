import { afterEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { a11yComponents } from '../../lint/preset'
import { SLOTS } from '../../ui/slots'
import { cleanupTrees, makeTree, runCheck } from './fixture.test'

afterEach(cleanupTrees)

const read = (dir: string, rel: string): string => readFileSync(resolve(dir, rel), 'utf8')

describe('check 4: preset applied', () => {
  it('passes on a healthy tree', async () => {
    expect((await runCheck(makeTree('app'), 4)).status).toBe('pass')
  })

  it('fails when a managed rule was edited', async () => {
    const dir = makeTree('app')
    const path = '.claude/rules/basalt-tokens.md'
    const r = await runCheck(makeTree('app', { [path]: `${read(dir, path)}\nlocal edit\n` }), 4)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain(path)
  })

  it('fails when .stylelintrc.basalt.json is missing', async () => {
    const r = await runCheck(makeTree('app', { '.stylelintrc.basalt.json': null }), 4)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('.stylelintrc.basalt.json')
  })

  it('fails when the oxlint preset is missing', async () => {
    const r = await runCheck(makeTree('app', { '.oxlintrc.basalt.json': null }), 4)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('.oxlintrc.basalt.json')
  })

  it('fails when settings.jsx-a11y.components misses one ui/* export', async () => {
    const components = a11yComponents(SLOTS)
    delete components['Button']
    const preset = {
      jsPlugins: ['basalt-ui/lint'],
      settings: { 'jsx-a11y': { components }, basalt: { pins: { oxlint: '1.93.0' } } },
    }
    const r = await runCheck(
      makeTree('app', { '.oxlintrc.basalt.json': JSON.stringify(preset) }),
      4,
    )
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('misses 1 ui/* export')
    expect(r.detail).toContain('Button')
  })
})

describe('check 5: lint scans files and something invokes it', () => {
  it('passes on a healthy tree', async () => {
    expect((await runCheck(makeTree('bridge'), 5)).status).toBe('pass')
  })

  it('fails when the declared root holds no script file', async () => {
    const r = await runCheck(makeTree('bridge', { 'src/main.tsx': null }), 5)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('lint scans 0 files')
  })

  it('fails when stylelint would scan no css or astro file', async () => {
    const r = await runCheck(makeTree('bridge', { 'src/styles.css': null }), 5)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('stylelint scans 0 css or astro files')
  })

  it('passes when an astro file is the only stylesheet', async () => {
    const dir = makeTree('bridge', {
      'src/styles.css': null,
      'src/page.astro': '---\n---\n<style>.a { color: red }</style>\n',
    })
    expect((await runCheck(dir, 5)).status).toBe('pass')
  })

  it('fails when nothing invokes basalt-ui lint', async () => {
    const r = await runCheck(makeTree('bridge', { 'lefthook.yml': null }), 5)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('nothing invokes `basalt-ui lint`')
  })

  it('accepts a package script as the invoker', async () => {
    const dir = makeTree('bridge', {
      'lefthook.yml': null,
      'package.json': JSON.stringify({ name: 'a', scripts: { lint: 'basalt-ui lint --changed' } }),
    })
    expect((await runCheck(dir, 5)).status).toBe('pass')
  })
})

describe('check 6: AGENTS block, no CLAUDE.md', () => {
  it('passes on a healthy tree', async () => {
    expect((await runCheck(makeTree('app'), 6)).status).toBe('pass')
  })

  it('fails when AGENTS.md is missing', async () => {
    const r = await runCheck(makeTree('app', { 'AGENTS.md': null }), 6)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('AGENTS.md is missing')
  })

  it('fails when AGENTS.md has no basalt block', async () => {
    const r = await runCheck(makeTree('app', { 'AGENTS.md': '# Mine\n' }), 6)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('no basalt block')
  })

  it('fails when a CLAUDE.md shadows AGENTS.md', async () => {
    const r = await runCheck(makeTree('app', { 'CLAUDE.md': '# shadow\n' }), 6)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('CLAUDE.md')
  })
})

describe('check 7: skills and rules at the install root, named in the block', () => {
  it('passes on a healthy tree', async () => {
    expect((await runCheck(makeTree('app'), 7)).status).toBe('pass')
  })

  it('passes with no agent layer for a tokens profile', async () => {
    const r = await runCheck(makeTree('tokens'), 7)
    expect(r.status).toBe('pass')
    expect(r.detail).toContain('no agent layer')
  })

  it('fails when a skill file is missing', async () => {
    const path = '.claude/skills/basalt-design/SKILL.md'
    const r = await runCheck(makeTree('app', { [path]: null }), 7)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain(path)
  })

  it('fails when the block does not name a skill', async () => {
    const dir = makeTree('app')
    const agents = read(dir, 'AGENTS.md').replaceAll('basalt-app', 'something-else')
    const r = await runCheck(makeTree('app', { 'AGENTS.md': agents }), 7)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('does not name the basalt-app skill')
  })
})
