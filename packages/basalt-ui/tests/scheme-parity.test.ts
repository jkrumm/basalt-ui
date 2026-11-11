import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { themeScript } from '../src/css/theme-script'
import { LEGACY_SCHEME_KEY, readScheme, SCHEME_KEY, setScheme } from '../src/core/scheme'
import type { Scheme } from '../src/core/scheme'

interface ParityCase {
  name: string
  stored?: string
  legacy?: string
  cookie?: string
  os?: 'light' | 'dark'
  default?: Scheme
  storage?: 'throws'
  attribute?: string
  expected: string | null
  expectedScript?: string | null
}

const table = JSON.parse(
  readFileSync(join(import.meta.dir, '../test/fixtures/scheme-parity/cases.json'), 'utf8'),
) as { cookieName: string; cases: ParityCase[] }
const COOKIE = table.cookieName

// happy-dom drops path-scoped cookies on about:blank
;(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
  'http://localhost/',
)

const root = (): HTMLElement => document.documentElement
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

function reset(): void {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  localStorage.clear()
  root().removeAttribute('data-theme')
  document.cookie = `${COOKIE}=; path=/; max-age=0`
}

beforeEach(reset)
afterEach(reset)

function seed(c: ParityCase): void {
  if (c.stored !== undefined) localStorage.setItem(SCHEME_KEY, c.stored)
  if (c.legacy !== undefined) localStorage.setItem(LEGACY_SCHEME_KEY, c.legacy)
  if (c.cookie !== undefined) document.cookie = `${COOKIE}=${c.cookie}; path=/`
  if (c.attribute !== undefined) root().setAttribute('data-theme', c.attribute)
  if (c.storage === 'throws') {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('denied')
      },
    })
  }
}

describe('scheme parity: themeScript() and setScheme() read one table', () => {
  for (const c of table.cases) {
    test(`themeScript: ${c.name}`, () => {
      seed(c)
      new Function(themeScript({ cookie: COOKIE, ...(c.default ? { default: c.default } : {}) }))()
      expect(root().getAttribute('data-theme')).toBe(
        c.expectedScript !== undefined ? c.expectedScript : c.expected,
      )
    })

    test(`setScheme: ${c.name}`, () => {
      seed(c)
      setScheme(undefined, { cookie: COOKIE })
      if (!readScheme({ cookie: COOKIE }) && c.default && !c.attribute) setScheme(c.default)
      expect(root().getAttribute('data-theme')).toBe(c.expected)
    })
  }
})
