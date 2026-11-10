import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  LEGACY_SCHEME_KEY,
  parseScheme,
  readScheme,
  SCHEME_ATTRIBUTE,
  SCHEME_KEY,
  setScheme,
} from './scheme'

// happy-dom drops path-scoped cookies on about:blank
;(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
  'http://localhost/',
)

const root = (): HTMLElement => document.documentElement

function reset(): void {
  localStorage.clear()
  root().removeAttribute(SCHEME_ATTRIBUTE)
  for (const part of document.cookie.split(/;\s*/)) {
    const name = part.split('=')[0]
    if (name) document.cookie = `${name}=; path=/; max-age=0`
  }
}

beforeEach(reset)
afterEach(reset)

describe('parseScheme', () => {
  test('accepts only light, dark, auto strings', () => {
    expect(parseScheme('light')).toBe('light')
    expect(parseScheme('dark')).toBe('dark')
    expect(parseScheme('auto')).toBe('auto')
    for (const bad of ['', 'Dark', '"dark"', '{"v":1,"value":"dark"}', null, undefined, 1, {}]) {
      expect(parseScheme(bad)).toBeUndefined()
    }
  })
})

describe('readScheme', () => {
  test('reads the basalt:scheme key first', () => {
    localStorage.setItem(SCHEME_KEY, 'dark')
    localStorage.setItem(LEGACY_SCHEME_KEY, 'light')
    document.cookie = 'sf=light; path=/'
    expect(readScheme({ cookie: 'sf' })).toBe('dark')
  })

  test('reads the legacy key when the new key is absent or invalid', () => {
    localStorage.setItem(LEGACY_SCHEME_KEY, 'light')
    expect(readScheme()).toBe('light')
    localStorage.setItem(SCHEME_KEY, 'bogus')
    expect(readScheme()).toBe('light')
  })

  test('reads the cookie only when named, after both storage keys', () => {
    document.cookie = 'sf=dark; path=/'
    expect(readScheme()).toBeUndefined()
    expect(readScheme({ cookie: 'sf' })).toBe('dark')
    localStorage.setItem(LEGACY_SCHEME_KEY, 'light')
    expect(readScheme({ cookie: 'sf' })).toBe('light')
  })

  test('tolerates throwing storage', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('denied')
      },
    })
    try {
      document.cookie = 'sf=dark; path=/'
      expect(readScheme()).toBeUndefined()
      expect(readScheme({ cookie: 'sf' })).toBe('dark')
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
    }
  })
})

describe('setScheme', () => {
  test('dark and light stamp the attribute, overriding, and write only the new key', () => {
    root().setAttribute(SCHEME_ATTRIBUTE, 'light')
    setScheme('dark')
    expect(root().getAttribute(SCHEME_ATTRIBUTE)).toBe('dark')
    expect(localStorage.getItem(SCHEME_KEY)).toBe('dark')
    expect(localStorage.getItem(LEGACY_SCHEME_KEY)).toBeNull()
    setScheme('light')
    expect(root().getAttribute(SCHEME_ATTRIBUTE)).toBe('light')
    expect(localStorage.getItem(LEGACY_SCHEME_KEY)).toBeNull()
  })

  test('does not touch an existing legacy value', () => {
    localStorage.setItem(LEGACY_SCHEME_KEY, 'light')
    setScheme('dark')
    expect(localStorage.getItem(LEGACY_SCHEME_KEY)).toBe('light')
  })

  test('auto removes the attribute and stores auto', () => {
    root().setAttribute(SCHEME_ATTRIBUTE, 'dark')
    setScheme('auto')
    expect(root().hasAttribute(SCHEME_ATTRIBUTE)).toBe(false)
    expect(localStorage.getItem(SCHEME_KEY)).toBe('auto')
  })

  test('mirrors the declared cookie and keeps mirroring on later calls', () => {
    setScheme('dark', { cookie: 'sf-scheme' })
    expect(document.cookie).toContain('sf-scheme=dark')
    setScheme('light')
    expect(document.cookie).toContain('sf-scheme=light')
    setScheme('auto')
    expect(document.cookie).toContain('sf-scheme=auto')
  })

  test('setScheme() re-applies after storage changed, overriding the attribute', () => {
    setScheme('dark')
    localStorage.setItem(SCHEME_KEY, 'light')
    setScheme()
    expect(root().getAttribute(SCHEME_ATTRIBUTE)).toBe('light')
    localStorage.setItem(SCHEME_KEY, 'auto')
    setScheme()
    expect(root().hasAttribute(SCHEME_ATTRIBUTE)).toBe(false)
  })

  test('setScheme() with nothing stored leaves the attribute alone', () => {
    root().setAttribute(SCHEME_ATTRIBUTE, 'dark')
    setScheme()
    expect(root().getAttribute(SCHEME_ATTRIBUTE)).toBe('dark')
  })

  test('setScheme() restores from the declared cookie when storage was reset', () => {
    setScheme('dark', { cookie: 'sf-restore' })
    localStorage.clear()
    root().removeAttribute(SCHEME_ATTRIBUTE)
    setScheme()
    expect(root().getAttribute(SCHEME_ATTRIBUTE)).toBe('dark')
  })

  test('tolerates throwing storage and still applies the attribute', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('denied')
      },
    })
    try {
      setScheme('dark')
      expect(root().getAttribute(SCHEME_ATTRIBUTE)).toBe('dark')
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
    }
  })
})
