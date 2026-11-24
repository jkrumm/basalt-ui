import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASALT } from './core'

/**
 * `BASALT.*` is a set of `var(--basalt-*)` refs, so a member naming a variable the emitted sheet lacks paints
 * nothing (an unset SVG fill is black, an unset color is inherited). `check-tokens` reads `var()`
 * strings in source, never `BASALT.*` members, so this is the gate that holds them: every ref a `BASALT` member
 * carries is one `css/tokens.css` defines.
 */
const SHEET = readFileSync(join(import.meta.dir, '..', 'css', 'tokens.css'), 'utf8')
const DEFINED = new Set(SHEET.match(/--basalt-[a-z0-9-]+(?=\s*:)/g))

const leaves = (node: unknown, path: string): Array<[string, string]> =>
  typeof node === 'string'
    ? [[path, node]]
    : node !== null && typeof node === 'object'
      ? Object.entries(node).flatMap(([k, v]) => leaves(v, `${path}.${k}`))
      : []

describe('BASALT refs resolve in the v3 token sheet', () => {
  const refs = leaves(BASALT, 'BASALT').flatMap(([path, value]) =>
    (value.match(/--basalt-[a-z0-9-]+/g) ?? []).map((name): [string, string] => [path, name]),
  )

  test('BASALT carries color and radius refs to check', () => {
    expect(refs.length).toBeGreaterThan(20)
  })

  test('every --basalt-* a BASALT member names is defined by tokens.css', () => {
    expect(
      refs.filter(([, name]) => !DEFINED.has(name)).map(([path, name]) => `${path} -> ${name}`),
    ).toEqual([])
  })
})
