import { describe, expect, test } from 'bun:test'
import { renamedBase, rewrite } from './rename-legacy.ts'

const at = (text: string, path = 'packages/basalt-ui/src/a.ts') => rewrite(text, path, 'basalt')

describe('rewrite', () => {
  test.each([
    ['var(--vx-ink)', 'var(--basalt-ink)'],
    ['`--vx-${name}`', '`--basalt-${name}`'],
    ['className="vx-prose"', 'className="basalt-prose"'],
    ["'basalt/unknown-vx-token'", "'basalt/unknown-basalt-token'"],
    ['VX.ink', 'BASALT.ink'],
    ['type K = VxKey | VxVar', 'type K = BasaltKey | BasaltVar'],
    ['collectVxNames(prevVx)', 'collectBasaltNames(prevBasalt)'],
    ['vxFamilyOf(x)', 'basaltFamilyOf(x)'],
    ['BASALT_VX_NAMES, basaltVxFamilies', 'BASALT_NAMES, basaltFamilies'],
    ['REMOVED_VX_NAMES, VX_PATH', 'REMOVED_BASALT_NAMES, BASALT_PATH'],
    ['/^--(vx-)?radius-/, --(?!vx-)', '/^--(basalt-)?radius-/, --(?!basalt-)'],
    ['runs over --vx tokens; the vx names', 'runs over --basalt tokens; the basalt names'],
  ])('%s', (from, to) => {
    expect(at(from)).toBe(to)
  })

  test('base64 runs and the removed 1.x API names pass through', () => {
    expect(at("'1YVxB/QVxL3' VxThemeProvider useVxTheme")).toBe(
      "'1YVxB/QVxL3' VxThemeProvider useVxTheme",
    )
  })

  test('it is idempotent', () => {
    const once = at('VX.ink var(--vx-ink) .vx-prose')
    expect(at(once)).toBe(once)
  })

  test('a migration row keeps its 2.x from and renames the v3 name it maps to', () => {
    const path = 'packages/basalt-ui/migrations/areas/tokens.json'
    const row = '      "from": "--vx-accent",\n      "to": "--vx-brand",\n      "note": "VX.x"'
    expect(rewrite(row, path, 'basalt')).toBe(
      '      "from": "--vx-accent",\n      "to": "--basalt-brand",\n      "note": "VX.x"',
    )
  })

  test('the prefix is the one parameter', () => {
    expect(rewrite('VX.ink var(--vx-ink) VxVar', 'a.ts', 'kit')).toBe(
      'KIT.ink var(--kit-ink) KitVar',
    )
  })
})

describe('renamedBase', () => {
  test('a vx-named file moves, any other keeps its name', () => {
    expect(renamedBase('src/tokens/vx-names.ts', 'basalt')).toBe('basalt-names.ts')
    expect(renamedBase('scripts/gen-vx-names.test.ts', 'basalt')).toBe('gen-basalt-names.test.ts')
    expect(renamedBase('src/tokens/core.ts', 'basalt')).toBeNull()
  })
})
