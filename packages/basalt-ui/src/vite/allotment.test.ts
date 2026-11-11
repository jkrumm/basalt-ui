import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

import { ALLOTMENT } from './allotment.gen'
import { ARCHITECTURE, parseAllotment } from './allotment'
import { VITE_DOC_PATH, renderViteDoc } from './doc'
import { closureOf, requiredPeers, subpathOf } from './graph'
import type { PackageGraph } from './graph'

describe('allotment.gen.ts', () => {
  it('is the parse of ARCHITECTURE.md (regenerate: bun packages/basalt-ui/src/vite/allotment.ts)', () => {
    expect(ALLOTMENT).toEqual(parseAllotment(readFileSync(ARCHITECTURE, 'utf8')))
  })

  it('reads the twelve runtime subpaths, 36 primitives and the two primitive peers', () => {
    expect(Object.keys(ALLOTMENT.subpaths)).toHaveLength(12)
    expect(ALLOTMENT.primitives).toHaveLength(36)
    expect(ALLOTMENT.primitivePeers).toEqual({
      'date-picker': ['react-day-picker'],
      'virtual-list': ['@tanstack/react-virtual'],
    })
    expect(ALLOTMENT.subpaths['content']?.lazy).toEqual(['shiki', 'beautiful-mermaid'])
    expect(ALLOTMENT.subpaths['ai']).toEqual({
      peers: ['react-markdown', 'remark-gfm', 'rehype-sanitize', 'remend'],
      lazy: [],
      reaches: ['.', 'content'],
    })
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
    expect(peers.get('@base-ui/react')).toBe('basalt-ui/ui/date-picker')
    expect(peers.has('shiki')).toBe(false)
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
