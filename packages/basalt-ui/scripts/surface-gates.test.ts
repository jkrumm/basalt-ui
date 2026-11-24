/** Fixture-driven tests for the three § 1 gates; no real dist or snapshot is read. */
import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  REQUIRED_PEERS,
  consumerViolations,
  duplicateSymbols,
  packageOf,
  peerClassViolations,
  reachedPeers,
  surfacePeerDrift,
} from './surface-gates'

describe('duplicateSymbols', () => {
  test('flags a name under two subpaths only', () => {
    const surface = { '.': ['A', 'B'], './state': ['B', 'C'], './format': ['D'] }
    expect(duplicateSymbols(surface)).toEqual(['B (., ./state)'])
  })
  test('a legacy root name shadowed by a subpath is not a second home', () => {
    const surface = { '.': ['A', 'B'], './router': ['A'] }
    expect(duplicateSymbols(surface, new Set(['A']))).toEqual([])
  })
  test('two non-legacy homes still fail, and a legacy name with no v3 home is irrelevant', () => {
    const surface = { '.': ['A', 'B'], './router': ['A'], './state': ['B'] }
    expect(duplicateSymbols(surface, new Set(['B']))).toEqual(['A (., ./router)'])
    expect(duplicateSymbols({ '.': ['A'] }, new Set(['A']))).toEqual([])
  })
  test('a legacy name under two non-root subpaths still fails', () => {
    expect(duplicateSymbols({ './a': ['A'], './b': ['A'] }, new Set(['A']))).toEqual([
      'A (./a, ./b)',
    ])
  })
  test('a baselined 2.x subpath home is a shadow of a v3 root name', () => {
    const surface = { '.': ['A'], './state': ['A'] }
    expect(duplicateSymbols(surface, new Set(), new Set(['basalt-ui/state#A']))).toEqual([])
    expect(duplicateSymbols(surface, new Set(), new Set())).toEqual(['A (., ./state)'])
  })
  test('green when every name has one home', () => {
    expect(duplicateSymbols({ '.': ['A'], './state': ['B'] })).toEqual([])
  })
})

describe('consumerViolations', () => {
  const surface = { '.': ['A', 'B'], './charts': ['ChartOnly'] }
  test('a symbol without a consumer fails, chart symbols included (W4)', () => {
    expect(consumerViolations(surface, { A: 'argo:x.tsx' })).toEqual([
      'B: public symbol has no named consumer in scripts/consumers.json',
      'ChartOnly: public symbol has no named consumer in scripts/consumers.json',
    ])
  })
  test('an entry naming no public symbol is stale', () => {
    expect(consumerViolations(surface, { A: 'x', B: 'y', ChartOnly: 'w', Gone: 'z' })).toEqual([
      'Gone: in scripts/consumers.json but not a public value symbol',
    ])
  })
  test('consumers.json is value-only: a type name (absent from the value snapshot) is stale', () => {
    expect(consumerViolations(surface, { A: 'x', B: 'y', ChartOnly: 'w', SomeProps: 'z' })).toEqual(
      ['SomeProps: in scripts/consumers.json but not a public value symbol'],
    )
  })
})

test('packageOf', () => {
  expect(packageOf('@tanstack/charts/react')).toBe('@tanstack/charts')
  expect(packageOf('motion/react')).toBe('motion')
  expect(packageOf('react')).toBe('react')
})

describe('peerClassViolations', () => {
  const root = mkdtempSync(join(tmpdir(), 'peer-classes-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))
  const write = (rel: string, body: string) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), body)
  }

  write('dist/index.js', "import { clsx } from 'clsx'\nexport * from './lazy-host.js'\n")
  write('dist/index.d.ts', "export type { A } from './a.js'\n")
  write('dist/a.d.ts', "export type A = import('@tanstack/react-router').Router\n")
  write('dist/lazy-host.js', "export const load = () => import('shiki')\n")
  write(
    'dist/table/index.js',
    "import { useReactTable } from '@tanstack/react-table'\nimport 'remend'\n",
  )
  write('dist/table/index.d.ts', "export type { Meter } from '@base-ui/react'\n")

  const peers = Object.fromEntries(
    [...REQUIRED_PEERS, '@tanstack/react-table', '@base-ui/react', 'remend', 'shiki'].map((n) => [
      n,
      '*',
    ]),
  )
  const meta = Object.fromEntries(
    ['@tanstack/react-table', '@base-ui/react', 'remend', 'shiki'].map((n) => [
      n,
      { optional: true },
    ]),
  )
  const entry = (js: string, types: string) => ({ import: js, types })
  const exportsMap = {
    '.': entry('./dist/index.js', './dist/index.d.ts'),
    './table': entry('./dist/table/index.js', './dist/table/index.d.ts'),
  }

  test('a lazy import() is optional, a static or .d.ts reach is not', () => {
    const v = peerClassViolations(root, {
      exports: exportsMap,
      peerDependencies: peers,
      peerDependenciesMeta: meta,
    })
    // `shiki` (lazy) passes; `remend` (static, unclassified) fails; `./table`'s classification of
    // its other peers is absent from the fixture, so only the entries it reaches matter.
    expect(v).toContain(
      './table imports the optional peer remend without it being subpath-required for ./table',
    )
    expect(v.some((m) => m.includes('shiki'))).toBe(false)
    expect(v.some((m) => m.startsWith('./table') && m.includes('react-table'))).toBe(false)
    expect(v.some((m) => m.startsWith('./table') && m.includes('@base-ui/react'))).toBe(false)
  })

  test('a null export target is skipped, not dereferenced', () => {
    const v = peerClassViolations(root, {
      exports: { ...exportsMap, './llms.txt': null },
      peerDependencies: peers,
      peerDependenciesMeta: meta,
    })
    expect(v.some((m) => m.startsWith('./llms.txt'))).toBe(false)
  })

  test('reachedPeers counts the lazy, static and .d.ts reach of declared peers', () => {
    const reached = reachedPeers(root, {
      exports: { ...exportsMap, './core/cn': entry('./dist/index.js', './dist/index.d.ts') },
      peerDependencies: { ...peers, '@tanstack/react-router': '*' },
    })
    // `clsx` is no declared peer; an eject path (`./core/*`) is the `./ui/*` row's, never its own
    expect(reached).toEqual({
      '.': ['@tanstack/react-router', 'shiki'],
      './table': ['@base-ui/react', '@tanstack/react-table', 'remend'],
    })
  })

  test('surfacePeerDrift fails a SURFACES list the graph does not match', () => {
    const reached = { '.': ['shiki'], './astro': [] }
    expect(
      surfacePeerDrift(reached, {
        '.': { optionalPeers: ['react', 'shiki'] },
        './astro': { optionalPeers: ['@tailwindcss/vite', 'tailwindcss'] },
      }),
    ).toEqual([])
    expect(surfacePeerDrift(reached, { '.': { optionalPeers: ['remend'] } })).toEqual([
      '.: SURFACES optionalPeers [remend] but the graph reaches [shiki]',
      './astro: SURFACES optionalPeers [] but the graph reaches [@tailwindcss/vite, tailwindcss]',
    ])
  })

  test('the .d.ts walk follows a .d.ts, never the sibling .js of the same specifier', () => {
    // `./sib.js` in a .d.ts resolves to `sib.d.ts`; the sibling `sib.js` imports `remend`, which a
    // JS-following walk would wrongly report as named by the public types.
    write('dist/sib/index.js', 'export const x = 1\n')
    write('dist/sib/index.d.ts', "export type { S } from './sib.js'\n")
    write('dist/sib/sib.js', "import 'remend'\nexport const S = 1\n")
    write('dist/sib/sib.d.ts', 'export type S = string\n')
    const v = peerClassViolations(root, {
      exports: { './sib': entry('./dist/sib/index.js', './dist/sib/index.d.ts') },
      peerDependencies: peers,
      peerDependenciesMeta: meta,
    })
    expect(v.some((m) => m.startsWith('./sib') && m.includes('remend'))).toBe(false)
  })

  test('a primitive reached by its published name is followed into dist', () => {
    // The build rewrites `../ui/card` to `basalt-ui/ui/card`; the walk must still reach its peers.
    write('dist/comp/index.js', "export { C } from 'basalt-ui/ui/prim'\n")
    write('dist/comp/index.d.ts', "export type { C } from 'basalt-ui/ui/prim'\n")
    write('dist/ui/prim.js', "import 'remend'\nexport const C = 1\n")
    write('dist/ui/prim.d.ts', 'export type C = number\n')
    const v = peerClassViolations(root, {
      exports: { './comp': entry('./dist/comp/index.js', './dist/comp/index.d.ts') },
      peerDependencies: peers,
      peerDependenciesMeta: meta,
    })
    expect(v).toContain(
      './comp imports the optional peer remend without it being subpath-required for ./comp',
    )
  })

  test('a non-required peer that is not optional fails', () => {
    const v = peerClassViolations(root, {
      exports: {},
      peerDependencies: peers,
      peerDependenciesMeta: { ...meta, shiki: {} },
    })
    expect(v).toContain('shiki: non-required peer must be optional in peerDependenciesMeta')
  })
})
