import { afterEach, describe, expect, it } from 'bun:test'

import { cleanupTrees, editManifest, makeTree, runCheck } from './fixture.test'

afterEach(cleanupTrees)

describe('check 1: manifest', () => {
  it('passes on a healthy tree', async () => {
    expect((await runCheck(makeTree('app'), 1)).status).toBe('pass')
  })

  it('fails when the manifest is missing', async () => {
    const r = await runCheck(makeTree('app', { '.basalt/manifest.json': null }), 1)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('missing')
  })

  it('fails when the declared profile is below the subpaths the code imports', async () => {
    const dir = makeTree('bridge', {
      'src/page.tsx': "import { Button } from 'basalt-ui/ui/button'\nexport const x = Button\n",
    })
    const r = await runCheck(dir, 1)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('basalt-ui/ui/button')
    expect(r.detail).toContain('needs parts')
  })

  it('fails when the recorded version is below the gate floor', async () => {
    const dir = makeTree('app')
    editManifest(dir, (m) => void (m.version = '1.0.0'))
    const r = await runCheck(dir, 1)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('gate floor')
  })
})

describe('check 2: installed against declared version', () => {
  it('passes when they match', async () => {
    expect((await runCheck(makeTree('app'), 2)).status).toBe('pass')
  })

  it('fails on drift and names the way back', async () => {
    const dir = makeTree('app')
    editManifest(dir, (m) => void (m.version = '2.0.0'))
    const r = await runCheck(dir, 2)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('bun install')
  })

  it('fails when basalt-ui is not installed', async () => {
    const r = await runCheck(makeTree('app', { 'node_modules/basalt-ui': null }), 2)
    expect(r.status).toBe('fail')
  })

  it('is SKIPPED when there is no manifest to compare against', async () => {
    const r = await runCheck(makeTree('app', { '.basalt/manifest.json': null }), 2)
    expect(r.status).toBe('skipped')
  })
})

describe('check 3: peers and ai-major-parity', () => {
  it('passes on a healthy tree', async () => {
    expect((await runCheck(makeTree('app'), 3)).status).toBe('pass')
  })

  it('fails when a peer the profile needs is not declared', async () => {
    const dir = makeTree('app', {
      'package.json': JSON.stringify({ name: 'app', dependencies: { react: '^19.3.0' } }),
    })
    const r = await runCheck(dir, 3)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('tailwindcss is not declared')
  })

  it('fails when a declared peer is not installed', async () => {
    const r = await runCheck(makeTree('app', { 'node_modules/react': null }), 3)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('react is declared but not installed')
  })

  it('does not ask a tokens-only app for peers', async () => {
    const r = await runCheck(makeTree('tokens', { 'node_modules/react': null }), 3)
    expect(r.status).toBe('pass')
  })

  const withAi = (ai: string, sdk: string): Record<string, string> => ({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: {
        'basalt-ui': '2.29.0',
        react: '^19.3.0',
        'react-dom': '^19.3.0',
        tailwindcss: '4.3.5',
        '@base-ui/react': '~1.9.0',
        '@tanstack/react-router': '^1.170.0',
        '@tanstack/react-query': '^5.104.0',
        ai,
        '@ai-sdk/react': sdk,
      },
    }),
  })

  it('fails when ai and @ai-sdk/react differ by major', async () => {
    const r = await runCheck(makeTree('app', withAi('^6.0.0', '^7.0.0')), 3)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('ai-major-parity')
  })

  it('passes when ai and @ai-sdk/react share a major', async () => {
    expect((await runCheck(makeTree('app', withAi('^7.0.1', '^7.2.0')), 3)).status).toBe('pass')
  })
})
