import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { VX } from './core'

/**
 * `VX.*` is a set of `var(--vx-*)` refs, so a member naming a variable the emitted sheet lacks paints
 * nothing (an unset SVG fill is black, an unset colour is inherited). `check-tokens` reads `var()`
 * strings in source, never `VX.*` members, so this is the gate that holds them: every ref a `VX` member
 * carries is one `css/tokens.css` defines.
 */
const SHEET = readFileSync(join(import.meta.dir, '..', 'css', 'tokens.css'), 'utf8')
const DEFINED = new Set(SHEET.match(/--vx-[a-z0-9-]+(?=\s*:)/g))

const leaves = (node: unknown, path: string): Array<[string, string]> =>
  typeof node === 'string'
    ? [[path, node]]
    : node !== null && typeof node === 'object'
      ? Object.entries(node).flatMap(([k, v]) => leaves(v, `${path}.${k}`))
      : []

describe('VX refs resolve in the v3 token sheet', () => {
  const refs = leaves(VX, 'VX').flatMap(([path, value]) =>
    (value.match(/--vx-[a-z0-9-]+/g) ?? []).map((name): [string, string] => [path, name]),
  )

  test('VX carries colour and radius refs to check', () => {
    expect(refs.length).toBeGreaterThan(20)
  })

  test('every --vx-* a VX member names is defined by tokens.css', () => {
    expect(
      refs.filter(([, name]) => !DEFINED.has(name)).map(([path, name]) => `${path} -> ${name}`),
    ).toEqual([])
  })
})
