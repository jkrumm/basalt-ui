import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'bun:test'

/** The CLI modules that must not reach back into `index.ts` (the cycle `sync` -> `doctor-upgrade` -> `index` -> `sync`). */
const LEAVES = [
  'basalt-install',
  'doctor-upgrade',
  'provider-tags',
  'render-imports',
  'router-wiring',
  'source-text',
]

describe('cli leaf modules', () => {
  it.each(LEAVES)('%s imports nothing from ./index', (name) => {
    const src = readFileSync(resolve(import.meta.dir, `${name}.ts`), 'utf8')
    expect(src).not.toMatch(/from\s+['"]\.\/index['"]/)
  })
})
