/**
 * `boot.ts` is the SSR-safe, Mantine-free half of the theme lab — the three functions a production
 * `main.tsx` calls (`applyOverrides(loadOverrides())`) plus `readVar`, split out of `index.tsx` so a
 * prod entry importing `basalt-ui/theme-lab` doesn't pull in `ThemeLabControls`'s eleven
 * `@mantine/core` imports and doesn't crash under SSR (no `document` global). Three invariants:
 *
 * 1. Every DOM-touching export is a no-op / empty-result with no `document`, never a throw.
 * 2. The module itself statically imports nothing from `@mantine/*` — the idiom mirrors
 *    `controls/peer-boundary.test.ts`'s source-level regex check, which is cheaper than the
 *    pack-test and fails on the line that broke it.
 * 3. `index.tsx` still re-exports everything here, so `basalt-ui/theme-lab` resolves both halves
 *    unchanged for an existing consumer.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyOverrides, loadOverrides, readVar } from './boot'
import * as themeLab from './index'

const BOOT_FILE = join(import.meta.dir, 'boot.ts')

/** Runs `fn` with `document` (and `window`) temporarily removed from `globalThis`, then restores it. */
function withoutDocument<T>(fn: () => T): T {
  const originalDocument = globalThis.document
  const originalWindow = (globalThis as { window?: unknown }).window
  delete (globalThis as { document?: unknown }).document
  delete (globalThis as { window?: unknown }).window
  try {
    return fn()
  } finally {
    globalThis.document = originalDocument
    ;(globalThis as { window?: unknown }).window = originalWindow
  }
}

describe('SSR safety — every export no-ops with no document', () => {
  test('loadOverrides() returns an empty result with no document', () => {
    expect(withoutDocument(() => loadOverrides())).toEqual({})
  })

  test('applyOverrides() is a no-op with no document', () => {
    expect(() => withoutDocument(() => applyOverrides({ '--vx-line': '#ff0000' }))).not.toThrow()
  })

  test('readVar() returns an empty string with no document', () => {
    expect(withoutDocument(() => readVar('--vx-line'))).toBe('')
  })
})

describe('boot.ts imports nothing from @mantine/* or React', () => {
  const source = readFileSync(BOOT_FILE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  test('no @mantine/* import', () => {
    expect(/from\s+['"]@mantine\//.test(source)).toBe(false)
  })

  test('no react import', () => {
    expect(/from\s+['"]react['"]/.test(source)).toBe(false)
  })
})

describe('index.tsx still re-exports the boot surface', () => {
  test('applyOverrides / loadOverrides / readVar / saveOverrides resolve from ./index', () => {
    expect(themeLab.applyOverrides).toBe(applyOverrides)
    expect(themeLab.loadOverrides).toBe(loadOverrides)
    expect(themeLab.readVar).toBe(readVar)
  })
})
