import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { REACT_PEERS, SUBPATH_REQUIRED_PEERS } from '../../scripts/surface-gates'
import { SURFACES } from '../surfaces'
import { ALLOTMENT } from './allotment'
import { VITE_DOC_PATH, renderViteDoc } from './doc'
import { closureOf, packageGraph, requiredPeers, subpathOf } from './graph'
import type { PackageGraph } from './graph'

const SRC = fileURLToPath(new URL('..', import.meta.url))

describe('allotment', () => {
  it('holds the peers the surface gates require, subpath by subpath', () => {
    for (const [key, entry] of Object.entries(ALLOTMENT.subpaths)) {
      const required = SUBPATH_REQUIRED_PEERS[key === '.' ? '.' : `./${key}`] ?? []
      const own = entry.peers.filter((p) => !REACT_PEERS.includes(p))
      if (key === 'ui') continue
      expect(own.toSorted(), key).toEqual([...required].toSorted())
    }
  })

  it('names only subpaths and optional peers the registry knows', () => {
    for (const key of Object.keys(ALLOTMENT.subpaths)) {
      expect(SURFACES, key).toHaveProperty([key === '.' ? '.' : `./${key === 'ui' ? 'ui/*' : key}`])
    }
    for (const dir of ALLOTMENT.composites) expect(ALLOTMENT.subpaths[dir], dir).toBeDefined()
  })

  it('lists every src/ui module as a primitive, and each composite as a src directory', () => {
    const modules = readdirSync(`${SRC}ui`)
      .filter((f) => /^[a-z][a-z-]*\.tsx$/.test(f) && !f.includes('.test.'))
      .map((f) => f.replace(/\.tsx$/, ''))
    for (const name of ALLOTMENT.primitives) {
      expect(modules.includes(name) || name === 'table', name).toBe(true)
    }
    for (const dir of ALLOTMENT.composites)
      expect(readdirSync(`${SRC}${dir}`).length).toBeGreaterThan(0)
  })

  it('reads the fourteen runtime subpaths, 39 primitives and the five primitive peers', () => {
    expect(Object.keys(ALLOTMENT.subpaths)).toHaveLength(14)
    expect(ALLOTMENT.primitives).toHaveLength(39)
    expect(ALLOTMENT.primitivePeers).toEqual({
      calendar: ['react-day-picker'],
      'date-picker': ['react-day-picker'],
      resizable: ['react-resizable-panels'],
      'virtual-list': ['@tanstack/react-virtual'],
      'sortable-list': ['@atlaskit/pragmatic-drag-and-drop'],
    })
    expect(ALLOTMENT.subpaths['content']?.lazy).toEqual(['shiki', 'pele'])
    expect(ALLOTMENT.subpaths['ai']?.reaches).toEqual(['.', 'content'])
    expect(ALLOTMENT.subpaths['shell']?.reaches).toEqual(['.', 'page', 'router'])
  })
})

describe('closure', () => {
  const graph: PackageGraph = {
    siblings: new Map([
      ['dialog', ['button']],
      ['button', []],
      ['date-picker', ['popover']],
      ['popover', []],
    ]),
    composites: new Map([['cards', ['card']]]),
  }

  it('follows declared edges, composite -> primitive and primitive -> sibling', () => {
    expect(closureOf(['shell', 'ui/dialog'], graph)).toEqual({
      subpaths: ['.', 'page', 'router', 'shell', 'ui'],
      primitives: ['button', 'dialog'],
    })
    expect(closureOf(['cards'], graph).primitives).toEqual(['card'])
  })

  it('names the import that needs each peer', () => {
    const peers = requiredPeers(closureOf(['ui/date-picker', 'table'], graph))
    expect(peers.get('react-day-picker')).toBe('basalt-ui/ui/date-picker')
    expect(peers.get('@tanstack/react-table')).toBe('basalt-ui/table')
    expect(peers.get('@base-ui/react')).toBe('basalt-ui/controls')
    expect(peers.has('shiki')).toBe(false)
  })

  it('reads composite -> primitive edges from this package, relative spelling included', () => {
    const real = packageGraph(fileURLToPath(new URL('../..', import.meta.url)))
    // src/cards/stat-card.tsx imports '../ui/card'; src/ui/dialog.tsx imports './button'.
    expect(real.composites.get('cards')).toContain('card')
    expect(real.siblings.get('dialog')).toContain('button')
    expect(closureOf(['cards'], real).subpaths).toContain('ui')
  })

  it('tracks only runtime subpaths', () => {
    expect(subpathOf('basalt-ui')).toBe('.')
    expect(subpathOf('basalt-ui/ui/button')).toBe('ui/button')
    expect(subpathOf('basalt-ui/cards')).toBe('cards')
    expect(subpathOf('basalt-ui/tokens.css')).toBeNull()
    expect(subpathOf('basalt-ui/vite')).toBeNull()
    expect(subpathOf('basalt-ui/ui')).toBeNull()
  })
})

describe('docs/vite.md', () => {
  it('is generated from src/vite/doc.ts (regenerate: bun packages/basalt-ui/src/vite/doc.ts)', () => {
    expect(readFileSync(VITE_DOC_PATH, 'utf8')).toBe(renderViteDoc())
  })
})
