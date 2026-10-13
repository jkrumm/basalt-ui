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
} from './surface-gates'

describe('duplicateSymbols', () => {
  test('flags a name under two subpaths only', () => {
    const surface = { '.': ['A', 'B'], './state': ['B', 'C'], './format': ['D'] }
    expect(duplicateSymbols(surface)).toEqual(['B (., ./state)'])
  })
  test('green when every name has one home', () => {
    expect(duplicateSymbols({ '.': ['A'], './state': ['B'] })).toEqual([])
  })
})

describe('consumerViolations', () => {
  const surface = { '.': ['A', 'B'], './charts': ['ChartOnly'] }
  test('a symbol without a consumer fails; charts are exempt', () => {
    expect(consumerViolations(surface, { A: 'argo:x.tsx' })).toEqual([
      'B: public symbol has no named consumer in scripts/consumers.json',
    ])
  })
  test('an entry naming no public symbol is stale', () => {
    expect(consumerViolations(surface, { A: 'x', B: 'y', Gone: 'z' })).toEqual([
      'Gone: in scripts/consumers.json but not a public non-chart symbol',
    ])
  })
})

test('packageOf', () => {
  expect(packageOf('@mantine/core/styles.css')).toBe('@mantine/core')
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

  write(
    'dist/index.js',
    "import { MantineProvider } from '@mantine/core'\nexport * from './lazy-host.js'\n",
  )
  write('dist/index.d.ts', "export type { A } from './a.js'\n")
  write('dist/a.d.ts', "export type A = import('@tanstack/react-router').Router\n")
  write('dist/lazy-host.js', "export const load = () => import('shiki')\n")
  write('dist/agent/index.js', "import { motion } from 'motion/react'\nimport 'remend'\n")
  write('dist/agent/index.d.ts', "export type { LanguageModel } from 'ai'\n")

  const peers = Object.fromEntries(
    [...REQUIRED_PEERS, 'motion', 'ai', 'remend', 'shiki', '@ai-sdk/provider'].map((n) => [n, '*']),
  )
  const meta = Object.fromEntries(
    ['motion', 'ai', 'remend', 'shiki', '@ai-sdk/provider'].map((n) => [n, { optional: true }]),
  )
  const entry = (js: string, types: string) => ({ import: js, types })
  const exportsMap = {
    '.': entry('./dist/index.js', './dist/index.d.ts'),
    './agent': entry('./dist/agent/index.js', './dist/agent/index.d.ts'),
  }

  test('a lazy import() is optional, a static or .d.ts reach is not', () => {
    const v = peerClassViolations(root, {
      exports: exportsMap,
      peerDependencies: peers,
      peerDependenciesMeta: meta,
    })
    // `shiki` (lazy) passes; `remend` (static, unclassified) fails; `./agent`'s classification of
    // `@tanstack/react-hotkeys` etc. is absent from the fixture, so only the entries it reaches matter.
    expect(v).toContain(
      './agent imports the optional peer remend without it being subpath-required for ./agent',
    )
    expect(v.some((m) => m.includes('shiki'))).toBe(false)
    expect(v.some((m) => m.startsWith('./agent') && m.includes('motion'))).toBe(false)
    expect(v.some((m) => m.startsWith('./agent') && m.includes(' ai '))).toBe(false)
  })

  test('a required peer marked optional fails', () => {
    const v = peerClassViolations(root, {
      exports: {},
      peerDependencies: peers,
      peerDependenciesMeta: { ...meta, react: { optional: true } },
    })
    expect(v).toContain('react: required peer is marked optional')
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
