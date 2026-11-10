import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { LEGACY_SCHEME_KEY, readScheme, SCHEME_KEY, setScheme } from '../core/scheme'
import type { Scheme } from '../core/scheme'
import { themeScript } from './theme-script'

// happy-dom drops path-scoped cookies on about:blank
;(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
  'http://localhost/',
)

const root = (): HTMLElement => document.documentElement

function reset(): void {
  localStorage.clear()
  root().removeAttribute('data-theme')
  document.cookie = 'sf=; path=/; max-age=0'
}

beforeEach(reset)
afterEach(reset)

function run(options?: Parameters<typeof themeScript>[0]): string | null {
  new Function(themeScript(options))()
  return root().getAttribute('data-theme')
}

interface Golden {
  name: string
  key?: string
  legacy?: string
  cookie?: string
  default?: Scheme
  expected: string | null
}

const GOLDEN: Golden[] = [
  { name: 'new key dark', key: 'dark', expected: 'dark' },
  { name: 'new key light', key: 'light', expected: 'light' },
  { name: 'new key auto stamps nothing', key: 'auto', default: 'dark', expected: null },
  { name: 'legacy key when new absent', legacy: 'dark', expected: 'dark' },
  { name: 'new key beats legacy', key: 'light', legacy: 'dark', expected: 'light' },
  { name: 'invalid new key falls to legacy', key: 'bogus', legacy: 'dark', expected: 'dark' },
  { name: 'cookie when storage empty', cookie: 'dark', expected: 'dark' },
  { name: 'storage beats cookie', legacy: 'light', cookie: 'dark', expected: 'light' },
  { name: 'invalid everywhere ignored', key: 'x', legacy: '{}', cookie: 'y', expected: null },
  { name: 'default light', default: 'light', expected: 'light' },
  { name: 'default dark', default: 'dark', expected: 'dark' },
  { name: 'default auto', default: 'auto', expected: null },
  { name: 'nothing set', expected: null },
]

describe('themeScript golden fixture (script and setScheme() agree)', () => {
  for (const g of GOLDEN) {
    const seed = (): void => {
      if (g.key !== undefined) localStorage.setItem(SCHEME_KEY, g.key)
      if (g.legacy !== undefined) localStorage.setItem(LEGACY_SCHEME_KEY, g.legacy)
      if (g.cookie !== undefined) document.cookie = `sf=${g.cookie}; path=/`
    }

    test(`script: ${g.name}`, () => {
      seed()
      expect(run({ cookie: 'sf', ...(g.default ? { default: g.default } : {}) })).toBe(g.expected)
    })

    test(`readScheme parity: ${g.name}`, () => {
      seed()
      root().removeAttribute('data-theme')
      const value = readScheme({ cookie: 'sf' }) ?? g.default
      if (value) {
        setScheme(value)
        localStorage.clear()
      }
      expect(root().getAttribute('data-theme')).toBe(g.expected)
    })
  }
})

describe('themeScript behavior', () => {
  test('cookie is ignored when not given', () => {
    document.cookie = 'sf=dark; path=/'
    expect(run()).toBeNull()
  })

  test('no action when data-theme is already set', () => {
    root().setAttribute('data-theme', 'light')
    localStorage.setItem(SCHEME_KEY, 'dark')
    expect(run()).toBe('light')
    expect(localStorage.getItem(SCHEME_KEY)).toBe('dark')
  })

  test('honours custom key and attribute', () => {
    localStorage.setItem('app:scheme', 'dark')
    new Function(themeScript({ key: 'app:scheme', attribute: 'data-mode' }))()
    expect(root().getAttribute('data-mode')).toBe('dark')
    expect(root().hasAttribute('data-theme')).toBe(false)
    root().removeAttribute('data-mode')
  })

  test('never writes storage', () => {
    localStorage.setItem(LEGACY_SCHEME_KEY, 'dark')
    run()
    expect(localStorage.getItem(SCHEME_KEY)).toBeNull()
  })

  test('tolerates throwing storage and still reads the cookie', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('denied')
      },
    })
    try {
      document.cookie = 'sf=dark; path=/'
      expect(run({ cookie: 'sf' })).toBe('dark')
      root().removeAttribute('data-theme')
      expect(run({ default: 'light' })).toBe('light')
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
    }
  })

  test('is at most 10 lines and has no colorScheme or theme-color write', () => {
    const script = themeScript({ cookie: 'sf' })
    expect(script.split('\n').length).toBeLessThanOrEqual(10)
    expect(script).not.toContain('colorScheme')
    expect(script).not.toContain('theme-color')
  })

  test('escaping: quotes in options cannot break out of the string', () => {
    const evil = `x"+(globalThis.pwned=1)+"`
    const script = themeScript({ cookie: evil, key: evil, attribute: evil })
    expect(() => new Function(script)).not.toThrow()
    new Function(script)()
    expect((globalThis as { pwned?: number }).pwned).toBeUndefined()
    expect(script).toContain(JSON.stringify(evil))
  })

  test('an invalid default falls back to auto', () => {
    expect(run({ default: 'purple' as Scheme })).toBeNull()
  })
})

describe('themeScript and readScheme agree on edge rows', () => {
  test('duplicate cookie names: the first match wins in both', () => {
    const own = Object.getOwnPropertyDescriptor(document, 'cookie')
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => 'sf=dark; sf=light',
    })
    try {
      expect(readScheme({ cookie: 'sf' })).toBe('dark')
      expect(run({ cookie: 'sf' })).toBe('dark')
    } finally {
      if (own) Object.defineProperty(document, 'cookie', own)
      else delete (document as unknown as { cookie?: string }).cookie
    }
  })

  test('a custom key written by setScheme is read back by the script and readScheme', () => {
    try {
      setScheme('dark', { key: 'app:scheme' })
      expect(localStorage.getItem('app:scheme')).toBe('dark')
      expect(localStorage.getItem(SCHEME_KEY)).toBeNull()
      expect(readScheme({ key: 'app:scheme' })).toBe('dark')
      root().removeAttribute('data-theme')
      expect(run({ key: 'app:scheme' })).toBe('dark')
      localStorage.setItem('app:scheme', 'light')
      setScheme()
      expect(root().getAttribute('data-theme')).toBe('light')
    } finally {
      setScheme(undefined, { key: SCHEME_KEY })
    }
  })
})
