import { describe, expect, it } from 'bun:test'

import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { closureOf, packageGraph, requiredPeers, subpathOf } from '../vite/graph'
import { BUILD_PEERS, peerAddLine, peerSpec, RUNTIME_PEERS, satisfiesRange } from './peers'

const PKG_ROOT = resolve(import.meta.dir, '../..')
const TEMPLATES = join(PKG_ROOT, 'agent/templates')
const SEED_IMPORT = /\bfrom\s*(['"])(basalt-ui(?:\/[\w./-]+)?)\1/g

describe('the app profile', () => {
  // What `init --profile app` wires (the router seeds) must build with what it installs: the peers
  // `basalt()` requires for the seeds' import closure all sit in the profile's peer set, so a peer a
  // shell part starts to import statically fails here before a fresh install fails its first build.
  it('installs every peer the seeds it writes reach', () => {
    const imports = new Set<string>()
    for (const name of readdirSync(TEMPLATES).filter((f) => f.endsWith('.tpl'))) {
      for (const [, , spec] of readFileSync(join(TEMPLATES, name), 'utf8').matchAll(SEED_IMPORT)) {
        const key = subpathOf(spec ?? '')
        if (key !== null) imports.add(key)
      }
    }
    expect(imports).toContain('shell')
    const needed = requiredPeers(closureOf([...imports], packageGraph(PKG_ROOT)))
    const installed = new Set(['react', 'react-dom', ...RUNTIME_PEERS.app, ...BUILD_PEERS.app])
    expect([...needed.keys()].filter((peer) => !installed.has(peer))).toEqual([])
  })
})

describe('satisfiesRange', () => {
  it.each([
    ['9.2.8', '9.2.8', true],
    ['9.3.1', '9.2.8', false],
    ['5.107.1', '^5.104.0', true],
    ['5.103.9', '^5.104.0', false],
    ['6.0.0', '^5.104.0', false],
    ['1.9.4', '~1.9.0', true],
    ['1.10.0', '~1.9.0', false],
    ['3.14.14', '>=3.14.0 <4', true],
    ['4.0.0', '>=3.14.0 <4', false],
    ['8.1.0', '^7 || ^8', true],
    ['6.9.0', '^7 || ^8', false],
    ['0.2.5', '^0.2.0', true],
    ['0.3.0', '^0.2.0', false],
    ['1.169.0', '^1.168.40', true],
    ['1.168.39', '^1.168.40', false],
    // a stable peer one patch or minor ahead of the tested floor is met; the next major is not
    ['4.3.6', '^4.3.5', true],
    ['4.4.0', '^4.3.5', true],
    ['5.0.0', '^4.3.5', false],
    ['1.5.9', '~1.5.0', true],
    ['1.6.0', '~1.5.0', false],
    ['1.93.1', '1.93.0', false],
  ])('%s against %s is %p', (version, range, met) => {
    expect(satisfiesRange(version, range)).toBe(met)
  })

  it('does not meet a range it cannot read', () => {
    expect(satisfiesRange('1.0.0', 'latest')).toBe(false)
    expect(satisfiesRange('not-a-version', '^1.0.0')).toBe(false)
  })
})

describe('peerSpec', () => {
  it('names the range, quoted when the shell would read it', () => {
    expect(peerSpec('@tanstack/react-table', '9.2.8')).toBe('@tanstack/react-table@9.2.8')
    expect(peerSpec('@tanstack/react-virtual', '>=3.14.0 <4')).toBe(
      "'@tanstack/react-virtual@>=3.14.0 <4'",
    )
    expect(peerSpec('react-day-picker', undefined)).toBe('react-day-picker')
  })
})

describe('peerAddLine', () => {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-peer-line-'))
  it('saves a pin exactly and a range as the range, never --exact beside a caret', () => {
    expect(peerAddLine(dir, [['@tanstack/charts', '0.4.2']], false)).toBe(
      'npm install --save --save-exact @tanstack/charts@0.4.2',
    )
    expect(peerAddLine(dir, [['@atlaskit/pragmatic-drag-and-drop', '^4.0.0']], false)).toBe(
      'npm install --save @atlaskit/pragmatic-drag-and-drop@^4.0.0',
    )
    expect(
      peerAddLine(
        dir,
        [
          ['@tanstack/router-plugin', '~1.168.40'],
          ['d3-scale', '4.0.2'],
        ],
        true,
      ),
    ).toBe(
      'npm install --save-dev --save-exact d3-scale@4.0.2 && npm install --save-dev @tanstack/router-plugin@~1.168.40',
    )
  })
})
