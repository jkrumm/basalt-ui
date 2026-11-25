import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { APPEARANCE_KEY, readAppearance, setAppearance } from '../core/appearance'
import { readScheme, SCHEME_KEY, setScheme } from '../core/scheme'
import type { Scheme } from '../core/scheme'
import { themeScript } from './theme-script'

// happy-dom drops path-scoped cookies on about:blank
;(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
  'http://localhost/',
)

const root = (): HTMLElement => document.documentElement

function reset(): void {
  localStorage.clear()
  for (const a of ['data-theme', 'data-density', 'data-frame', 'data-accent'])
    root().removeAttribute(a)
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
  cookie?: string
  default?: Scheme
  expected: string | null
}

const GOLDEN: Golden[] = [
  { name: 'new key dark', key: 'dark', expected: 'dark' },
  { name: 'new key light', key: 'light', expected: 'light' },
  { name: 'new key auto stamps nothing', key: 'auto', default: 'dark', expected: null },
  { name: 'cookie when storage empty', cookie: 'dark', expected: 'dark' },
  { name: 'storage beats cookie', key: 'light', cookie: 'dark', expected: 'light' },
  { name: 'invalid everywhere ignored', key: 'x', cookie: 'y', expected: null },
  { name: 'default light', default: 'light', expected: 'light' },
  { name: 'default dark', default: 'dark', expected: 'dark' },
  { name: 'default auto', default: 'auto', expected: null },
  { name: 'nothing set', expected: null },
]

describe('themeScript golden fixture (script and setScheme() agree)', () => {
  for (const g of GOLDEN) {
    const seed = (): void => {
      if (g.key !== undefined) localStorage.setItem(SCHEME_KEY, g.key)
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
    run({ default: 'dark' })
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
  test.each([
    ['sf=dark; sf=light', 'dark'],
    ['sf=; sf=dark', 'dark'],
  ] as const)(
    'duplicate cookie names (%s): the first non-empty match wins in both',
    (jar, want) => {
      const own = Object.getOwnPropertyDescriptor(document, 'cookie')
      Object.defineProperty(document, 'cookie', { configurable: true, get: () => jar })
      try {
        expect(readScheme({ cookie: 'sf' })).toBe(want)
        expect(run({ cookie: 'sf' })).toBe(want)
      } finally {
        if (own) Object.defineProperty(document, 'cookie', own)
        else delete (document as unknown as { cookie?: string }).cookie
      }
    },
  )

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

describe('themeScript stamps the stored appearance before paint', () => {
  const attrs = (): (string | null)[] =>
    ['data-density', 'data-frame', 'data-accent'].map((a) => root().getAttribute(a))

  test('what setAppearance stored is on <html> after a reload, with the scheme', () => {
    setScheme('dark')
    setAppearance({ density: 'comfortable', frame: 'flush', accent: 'violet' })
    for (const a of ['data-theme', 'data-density', 'data-frame', 'data-accent'])
      root().removeAttribute(a)
    expect(run()).toBe('dark')
    expect(attrs()).toEqual(['comfortable', 'flush', 'violet'])
  })

  test('an invalid value is dropped, the valid ones kept: the script and readAppearance agree', () => {
    const raw = { density: 'huge', frame: 'panel', accent: 'red' }
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(raw))
    run()
    expect(attrs()).toEqual([null, 'panel', null])
    expect(readAppearance()).toEqual({ frame: 'panel' })
  })

  test('an attribute the page already has is kept', () => {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ density: 'normal', accent: 'teal' }))
    root().setAttribute('data-density', 'comfortable')
    run()
    expect(attrs()).toEqual(['comfortable', null, 'teal'])
  })

  test('a data-theme already on the page does not stop the appearance being stamped', () => {
    localStorage.setItem(SCHEME_KEY, 'light')
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ accent: 'rose' }))
    root().setAttribute('data-theme', 'dark')
    run()
    expect(root().getAttribute('data-theme')).toBe('dark')
    expect(root().getAttribute('data-accent')).toBe('rose')
  })

  test('malformed JSON, a non-object and throwing storage stamp nothing and never throw', () => {
    for (const value of ['{nope', '"violet"', '42', 'null']) {
      localStorage.setItem(APPEARANCE_KEY, value)
      expect(() => run()).not.toThrow()
      expect(attrs()).toEqual([null, null, null])
    }
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('denied')
    }
    try {
      expect(() => run()).not.toThrow()
    } finally {
      Storage.prototype.getItem = original
    }
  })

  test('appearance: false leaves the attributes alone', () => {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ frame: 'flush' }))
    run({ appearance: false })
    expect(attrs()).toEqual([null, null, null])
  })
})

describe('themeScript viewport zoom', () => {
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  const IPAD =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
  const ANDROID =
    'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
  const CONTENT = 'width=device-width, initial-scale=1, viewport-fit=cover'
  const original = { ua: navigator.userAgent, touch: navigator.maxTouchPoints }

  function viewport(): HTMLMetaElement {
    document.head.querySelector('meta[name="viewport"]')?.remove()
    const meta = document.createElement('meta')
    meta.name = 'viewport'
    meta.content = CONTENT
    document.head.append(meta)
    return meta
  }

  function visit(ua: string, touch: number, options?: Parameters<typeof themeScript>[0]): string {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
    Object.defineProperty(navigator, 'maxTouchPoints', { value: touch, configurable: true })
    const meta = viewport()
    new Function(themeScript(options))()
    return meta.content
  }

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: original.ua, configurable: true })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: original.touch,
      configurable: true,
    })
    document.head.querySelector('meta[name="viewport"]')?.remove()
  })

  test('an iPhone gets maximum-scale=1', () => {
    expect(visit(IPHONE, 5)).toBe(`${CONTENT}, maximum-scale=1`)
  })

  test('an iPad, which reports as a touch Mac, gets it too', () => {
    expect(visit(IPAD, 5)).toBe(`${CONTENT}, maximum-scale=1`)
  })

  test('a Mac without touch and Android Chrome keep their pinch zoom', () => {
    expect(visit(IPAD, 0)).toBe(CONTENT)
    expect(visit(ANDROID, 5)).toBe(CONTENT)
  })

  test('a viewport that names maximum-scale already is left alone; zoom: false skips it', () => {
    Object.defineProperty(navigator, 'userAgent', { value: IPHONE, configurable: true })
    const meta = viewport()
    meta.content = 'width=device-width, maximum-scale=5'
    new Function(themeScript())()
    expect(meta.content).toBe('width=device-width, maximum-scale=5')
    expect(visit(IPHONE, 5, { zoom: false })).toBe(CONTENT)
  })
})
