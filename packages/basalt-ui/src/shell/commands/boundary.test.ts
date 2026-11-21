import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SHELL = join(import.meta.dir, '..')
const OWNED = [
  ...readdirSync(import.meta.dir).map((file) => join(import.meta.dir, file)),
  join(SHELL, 'chrome.tsx'),
  join(SHELL, 'menu-template.ts'),
].filter(
  (file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'),
)

const BANNED = /from\s+'(cmdk|@radix-ui\/[^']*)'/
const HOTKEYS = /from\s+'@tanstack\/react-hotkeys'/

describe('the commands and chrome sources', () => {
  test('import no cmdk or Radix: the palette is our own', () => {
    expect(OWNED.length).toBeGreaterThan(5)
    for (const file of OWNED)
      expect([file, BANNED.test(readFileSync(file, 'utf8'))]).toEqual([file, false])
  })

  test('bindings.ts is the only file that imports the hotkeys library', () => {
    const importers = OWNED.filter((file) => HOTKEYS.test(readFileSync(file, 'utf8')))
    expect(importers.map((file) => file.slice(import.meta.dir.length + 1))).toEqual(['bindings.ts'])
  })

  test('the shell barrel exports AppShell and this surface only', () => {
    const barrel = readFileSync(join(SHELL, 'index.ts'), 'utf8')
    const names = [...barrel.matchAll(/export\s*\{([^}]*)\}/g)].flatMap((m) =>
      (m[1] ?? '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
    )
    expect(names.toSorted()).toEqual([
      'AppShell',
      'CommandPalette',
      'defineCommands',
      'toMenuTemplate',
      'useWindowChrome',
    ])
  })
})
