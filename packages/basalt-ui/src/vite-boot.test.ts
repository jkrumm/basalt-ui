import { describe, expect, test } from 'bun:test'
import type { HtmlTagDescriptor } from 'vite'
import { buildBootTags } from './vite-boot'

type BootInput = Parameters<typeof buildBootTags>[0]

const THEME_COLOR = { light: '#ffffff', dark: '#111111' } as const
const SCOPE = 'html:not([data-mantine-color-scheme])'
const LIGHT_VARIANT = `${SCOPE}[data-basalt-boot=light]{background-color:#ffffff;color-scheme:light}`
const DARK_VARIANT = `${SCOPE}[data-basalt-boot=dark]{background-color:#111111;color-scheme:dark}`

const input = (overrides: Partial<BootInput> = {}): BootInput => ({
  colorScheme: 'dark',
  themeColor: THEME_COLOR,
  backgroundColor: '#111111',
  explicitBackground: false,
  bootScript: true,
  ...overrides,
})

const tagChildren = (tags: HtmlTagDescriptor[], tag: string): string =>
  String(tags.find((candidate) => candidate.tag === tag)?.children ?? '')

const styleOf = (overrides: Partial<BootInput> = {}): string =>
  tagChildren(buildBootTags(input(overrides)), 'style')

describe('boot style — base rule', () => {
  test('every mode scopes the rule so Mantine can take it back', () => {
    // An UNLAYERED `html{color-scheme:dark}` outranks Mantine's layered `:root{color-scheme:…}`;
    // scoping to the absence of the attribute Mantine writes is what expires it.
    for (const colorScheme of ['dark', 'light', 'auto', false] as const) {
      const css = styleOf({ colorScheme })
      expect(css).toContain(SCOPE)
      expect(css).not.toMatch(/(^|[};])html\{/)
    }
  })

  test('dark (default) paints the dark surface', () => {
    expect(styleOf()).toBe(
      `${SCOPE}{background-color:#111111;color-scheme:dark}` + LIGHT_VARIANT + DARK_VARIANT,
    )
  })

  test('light paints the light surface', () => {
    expect(styleOf({ colorScheme: 'light', backgroundColor: '#ffffff' })).toBe(
      `${SCOPE}{background-color:#ffffff;color-scheme:light}` + LIGHT_VARIANT + DARK_VARIANT,
    )
  })

  test('auto follows prefers-color-scheme for the paint', () => {
    expect(styleOf({ colorScheme: 'auto' })).toBe(
      `${SCOPE}{background-color:#ffffff;color-scheme:light dark}` +
        `@media(prefers-color-scheme:dark){${SCOPE}{background-color:#111111}}` +
        LIGHT_VARIANT +
        DARK_VARIANT,
    )
  })

  test('bootScript: false emits the base rule only, and no script', () => {
    const tags = buildBootTags(input({ bootScript: false }))
    expect(tags).toHaveLength(1)
    expect(tagChildren(tags, 'style')).toBe(`${SCOPE}{background-color:#111111;color-scheme:dark}`)
  })
})

describe('boot style — stored-scheme variants', () => {
  test('the variants sit inside BOOT_SCOPE, so they expire with the rule', () => {
    const variants = styleOf().match(/html:not\([^)]*\)\[data-basalt-boot=[a-z]+\]/g)
    expect(variants).toHaveLength(2)
  })

  test('colorScheme light without an explicit background still overrides the base for dark', () => {
    const css = styleOf({ colorScheme: 'light', backgroundColor: '#ffffff' })
    expect(css).toContain(
      `${SCOPE}[data-basalt-boot=dark]{background-color:#111111;color-scheme:dark}`,
    )
  })

  test('explicit backgroundColor on auto: only color-scheme follows storage', () => {
    expect(
      styleOf({ colorScheme: 'auto', backgroundColor: '#abcdef', explicitBackground: true }),
    ).toBe(
      `${SCOPE}{background-color:#abcdef;color-scheme:light dark}` +
        `${SCOPE}[data-basalt-boot=light]{color-scheme:light}` +
        `${SCOPE}[data-basalt-boot=dark]{color-scheme:dark}`,
    )
  })

  test('explicit backgroundColor on fixed dark: color-scheme variants only', () => {
    const css = styleOf({ backgroundColor: '#abcdef', explicitBackground: true })
    expect(css).not.toMatch(/\[data-basalt-boot=[a-z]+\]\{background-color/)
    expect(css).toContain(`${SCOPE}[data-basalt-boot=light]{color-scheme:light}`)
  })

  test('colorScheme false, no explicit background: background variants, no color-scheme', () => {
    expect(styleOf({ colorScheme: false })).toBe(
      `${SCOPE}{background-color:#111111}` +
        `${SCOPE}[data-basalt-boot=light]{background-color:#ffffff}` +
        `${SCOPE}[data-basalt-boot=dark]{background-color:#111111}`,
    )
  })

  test('colorScheme false with an explicit background emits no variant rules at all', () => {
    expect(
      styleOf({ colorScheme: false, backgroundColor: '#abcdef', explicitBackground: true }),
    ).toBe(`${SCOPE}{background-color:#abcdef}`)
  })
})

describe('boot script', () => {
  const script = tagChildren(buildBootTags(input()), 'script')

  type Env = {
    getItem?: (key: string) => string | null
    prefersDark?: boolean
    matchMedia?: ((query: string) => { matches: boolean }) | undefined
    storageGetterThrows?: boolean
  }

  /** Runs the script against a fake document; returns what it set on <html> and the keys it read. */
  const run = (env: Env): { attributes: Record<string, string>; keys: string[] } => {
    const attributes: Record<string, string> = {}
    const keys: string[] = []
    const fakeDocument = {
      documentElement: { setAttribute: (k: string, v: string) => void (attributes[k] = v) },
    }
    const fakeScope: Record<string, unknown> = {
      document: fakeDocument,
      matchMedia:
        'matchMedia' in env
          ? env.matchMedia
          : (query: string) => ({
              matches: query === '(prefers-color-scheme: dark)' && env.prefersDark === true,
            }),
    }
    // The localStorage accessor itself throws in a sandboxed iframe — model it as a global getter.
    const names = Object.keys(fakeScope)
    const values = names.map((name) => fakeScope[name])
    const storage = {
      getItem: (key: string) => {
        keys.push(key)
        return env.getItem ? env.getItem(key) : null
      },
    }
    const localStorageArg = env.storageGetterThrows
      ? new Proxy(
          {},
          {
            get: () => {
              throw new Error('SecurityError')
            },
          },
        )
      : storage
    new Function(...names, 'localStorage', script)(...values, localStorageArg)
    return { attributes, keys }
  }

  test('is an IIFE: no top-level declaration leaks into the page scope', () => {
    expect(script.startsWith('(function(){')).toBe(true)
    expect(script.endsWith('})()')).toBe(true)
    expect(script.match(/\bvar\b/g)).toHaveLength(1)
    expect(script).not.toMatch(/^(var|let|const)\b/)
  })

  test("reads exactly Mantine's storage key", () => {
    expect(run({ getItem: () => 'light' }).keys).toEqual(['mantine-color-scheme-value'])
  })

  test('stored light and dark set the boot attribute', () => {
    expect(run({ getItem: () => 'light' }).attributes).toEqual({ 'data-basalt-boot': 'light' })
    expect(run({ getItem: () => 'dark' }).attributes).toEqual({ 'data-basalt-boot': 'dark' })
  })

  test('stored auto follows prefers-color-scheme', () => {
    expect(run({ getItem: () => 'auto', prefersDark: true }).attributes).toEqual({
      'data-basalt-boot': 'dark',
    })
    expect(run({ getItem: () => 'auto', prefersDark: false }).attributes).toEqual({
      'data-basalt-boot': 'light',
    })
  })

  test('nothing stored, or an unknown value, sets nothing', () => {
    expect(run({ getItem: () => null }).attributes).toEqual({})
    expect(run({ getItem: () => 'sepia' }).attributes).toEqual({})
  })

  test('throwing getItem sets nothing', () => {
    const getItem = (): string => {
      throw new Error('SecurityError')
    }
    expect(run({ getItem }).attributes).toEqual({})
  })

  test('a throwing localStorage accessor (sandboxed iframe) sets nothing', () => {
    expect(run({ storageGetterThrows: true }).attributes).toEqual({})
  })

  test('stored auto with matchMedia undefined or throwing sets nothing', () => {
    expect(run({ getItem: () => 'auto', matchMedia: undefined }).attributes).toEqual({})
    const matchMedia = (): { matches: boolean } => {
      throw new Error('boom')
    }
    expect(run({ getItem: () => 'auto', matchMedia }).attributes).toEqual({})
  })

  test('never writes data-mantine-color-scheme (it would expire the boot rule early)', () => {
    expect(script).not.toContain('data-mantine-color-scheme')
  })
})
