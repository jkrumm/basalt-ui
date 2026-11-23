import { afterEach, describe, expect, it } from 'bun:test'

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { cleanupTrees, editManifest, HEALTHY, makeTree, runCheck } from './fixture.test'

/** Commits the tree with its manifest, so `HEAD` holds the roots declared now. */
function commitManifest(dir: string): void {
  const git = (...args: string[]): void => {
    execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      stdio: 'ignore',
    })
  }
  git('init', '-q')
  git('add', '-f', '.basalt/manifest.json')
  git('commit', '-q', '-m', 'base')
}

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

  it('passes a site root whose Astro page imports the static parts', async () => {
    const page = readFileSync(
      new URL('../../../test/fixtures/site/src/pages/index.astro', import.meta.url),
      'utf8',
    )
    expect((await runCheck(makeTree('site', { 'src/pages/index.astro': page }), 1)).status).toBe(
      'pass',
    )
  })

  it('fails a site root that imports a parts subpath', async () => {
    const dir = makeTree('site', {
      'src/pages/index.astro': "---\nimport { Button } from 'basalt-ui/ui/button'\n---\n",
    })
    const r = await runCheck(dir, 1)
    expect(r.status).toBe('fail')
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

describe('check 1: declared roots', () => {
  it('fails when a root is a file', async () => {
    const dir = makeTree('app', { 'src/index.ts': 'export {}\n' })
    editManifest(dir, (m) => void (m.roots = { 'src/index.ts': 'app' }))
    const r = await runCheck(dir, 1, { ...HEALTHY, baseRef: null })
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('src/index.ts is a file')
  })

  it('fails when a root declared at the base ref is narrowed to a subdirectory', async () => {
    const dir = makeTree('app', { 'src/features/x.ts': 'export {}\n' })
    editManifest(dir, (m) => void (m.roots = { src: 'app' }))
    commitManifest(dir)
    editManifest(dir, (m) => void (m.roots = { 'src/features': 'app' }))
    const r = await runCheck(dir, 1, { ...HEALTHY, baseRef: 'HEAD' })
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('root src was declared at HEAD and is no longer covered')
  })

  it('passes a root widened or kept against the base ref', async () => {
    const dir = makeTree('app', { 'src/features/x.ts': 'export {}\n' })
    editManifest(dir, (m) => void (m.roots = { 'src/features': 'app' }))
    commitManifest(dir)
    editManifest(dir, (m) => void (m.roots = { src: 'app' }))
    expect((await runCheck(dir, 1, { ...HEALTHY, baseRef: 'HEAD' })).status).toBe('pass')
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
    expect(r.detail).toContain('run `npm install`, then `basalt-ui sync`')
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

  it('names the build peers init installs: the Tailwind Vite plugin and the router plugin', async () => {
    const files = (drop: string): Record<string, string | null> => ({
      [`node_modules/${drop}`]: null,
      'package.json': JSON.stringify({
        name: 'app',
        dependencies: Object.fromEntries(
          Object.entries({
            'basalt-ui': '2.29.0',
            react: '^19.3.0',
            'react-dom': '^19.3.0',
            tailwindcss: '4.3.5',
            '@base-ui/react': '~1.9.0',
            '@tanstack/react-router': '^1.170.0',
            '@tanstack/react-query': '^5.104.0',
            '@tailwindcss/vite': '4.3.5',
            '@tanstack/router-plugin': '1.168.40',
          }).filter(([name]) => name !== drop),
        ),
      }),
    })
    for (const peer of ['@tailwindcss/vite', '@tanstack/router-plugin']) {
      const r = await runCheck(makeTree('app', files(peer)), 3)
      expect(r.status).toBe('fail')
      expect(r.detail).toContain(`${peer} is not declared`)
    }
  })

  it('fails a declared optional peer installed outside its range, naming both versions', async () => {
    const withTable = (installed: string): Record<string, string | null> => {
      const base = JSON.parse(readFileSync(`${makeTree('app')}/package.json`, 'utf8')) as {
        dependencies: Record<string, string>
      }
      return {
        'package.json': JSON.stringify({
          name: 'app',
          dependencies: { ...base.dependencies, '@tanstack/react-table': installed },
        }),
        'node_modules/@tanstack/react-table/package.json': JSON.stringify({ version: installed }),
      }
    }
    const bad = await runCheck(makeTree('app', withTable('9.2.8')), 3)
    expect(bad.status).toBe('fail')
    expect(bad.detail).toContain('@tanstack/react-table 9.2.8')
    expect(bad.detail).toContain('9.3.1')
    expect(bad.detail).toContain('npm install --save --save-exact @tanstack/react-table@~9.3.1')
    expect((await runCheck(makeTree('app', withTable('9.3.1')), 3)).status).toBe('pass')
  })

  it('fails a profile peer installed outside its range and prints the declared spec', async () => {
    const r = await runCheck(
      makeTree('app', {
        'node_modules/tailwindcss/package.json': JSON.stringify({ version: '5.0.0' }),
      }),
      3,
    )
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('tailwindcss 5.0.0')
    expect(r.detail).toContain('npm install --save --save-exact tailwindcss@^4.3.5')
  })

  it('passes a stable peer ahead of the tested floor but inside its caret range', async () => {
    const r = await runCheck(
      makeTree('app', {
        'node_modules/tailwindcss/package.json': JSON.stringify({ version: '4.3.6' }),
        'node_modules/@tailwindcss/vite/package.json': JSON.stringify({ version: '4.3.6' }),
      }),
      3,
    )
    expect(r.status).toBe('pass')
  })

  it('asks the site profile for astro and @astrojs/react', async () => {
    const r = await runCheck(makeTree('site', {}), 3)
    expect(r.status).toBe('pass')
    const base = JSON.parse(readFileSync(`${makeTree('site')}/package.json`, 'utf8')) as {
      dependencies: Record<string, string>
    }
    const { astro: _astro, ...rest } = base.dependencies
    const missing = await runCheck(
      makeTree('site', { 'package.json': JSON.stringify({ name: 'app', dependencies: rest }) }),
      3,
    )
    expect(missing.status).toBe('fail')
    expect(missing.detail).toContain('astro is not declared')
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

  const withAi = (ai: string, sdk: string, extra: object = {}): Record<string, string> => ({
    'package.json': JSON.stringify({
      name: 'app',
      ...extra,
      dependencies: {
        'basalt-ui': '2.29.0',
        react: '^19.3.0',
        'react-dom': '^19.3.0',
        tailwindcss: '4.3.5',
        '@base-ui/react': '~1.9.0',
        '@tanstack/react-router': '^1.170.0',
        '@tanstack/react-query': '^5.104.0',
        '@tailwindcss/vite': '4.3.5',
        '@tanstack/router-plugin': '1.168.40',
        ai,
        '@ai-sdk/react': sdk,
      },
    }),
  })

  it('fails when @ai-sdk/react does not pair with the ai major', async () => {
    const r = await runCheck(makeTree('app', withAi('^6.0.0', '^7.0.0')), 3)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('ai-major-parity')
  })

  it('passes the real pairing: ai 7 with @ai-sdk/react 4', async () => {
    expect((await runCheck(makeTree('app', withAi('^7.0.1', '^4.0.2')), 3)).status).toBe('pass')
  })

  it('fails when ai is on two majors across packages, and a written reason exempts it', async () => {
    const files = {
      ...withAi('^7.0.1', '^4.0.2'),
      'apps/api/package.json': JSON.stringify({ name: 'api', dependencies: { ai: '^5.0.0' } }),
      'apps/api/src/index.ts': 'export {}\n',
    }
    const dir = makeTree('app', files)
    editManifest(dir, (m) => void (m.roots['apps/api/src'] = 'bridge'))
    const split = await runCheck(dir, 3)
    expect(split.status).toBe('fail')
    expect(split.detail).toContain('majors 5 and 7')

    const reasoned = makeTree('app', {
      ...files,
      ...withAi('^7.0.1', '^4.0.2', {
        basalt: { aiMajorSkewReason: 'api streams on ai 5, neutralized upstream' },
      }),
    })
    editManifest(reasoned, (m) => void (m.roots['apps/api/src'] = 'bridge'))
    expect((await runCheck(reasoned, 3)).status).toBe('pass')
  })
})
