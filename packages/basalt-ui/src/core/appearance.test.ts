import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  APPEARANCE_KEY,
  appearanceSnapshot,
  parseAppearance,
  readAppearance,
  resetAppearance,
  setAppearance,
  subscribeAppearance,
} from './appearance'
import { setScheme } from './scheme'

const root = (): HTMLElement => document.documentElement
const ATTRS = ['data-theme', 'data-density', 'data-frame', 'data-accent']

function reset(): void {
  localStorage.clear()
  for (const a of ATTRS) root().removeAttribute(a)
}

beforeEach(reset)
afterEach(reset)

const stored = (): unknown => JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? 'null')

describe('setAppearance', () => {
  test('applies each attribute at once and stores the three under one key', () => {
    setAppearance({ density: 'normal', frame: 'flush', accent: 'violet' })
    expect(ATTRS.slice(1).map((a) => root().getAttribute(a))).toEqual(['normal', 'flush', 'violet'])
    expect(stored()).toEqual({ density: 'normal', frame: 'flush', accent: 'violet' })
  })

  test('a partial change keeps the other keys; null removes one', () => {
    setAppearance({ density: 'comfortable', accent: 'teal' })
    setAppearance({ accent: null, frame: 'panel' })
    expect(root().hasAttribute('data-accent')).toBe(false)
    expect(root().getAttribute('data-density')).toBe('comfortable')
    expect(stored()).toEqual({ density: 'comfortable', frame: 'panel' })
  })

  test('an invalid value is ignored, never applied or stored', () => {
    setAppearance({ density: 'huge' as never, accent: 'red' as never })
    expect(root().hasAttribute('data-density')).toBe(false)
    expect(localStorage.getItem(APPEARANCE_KEY)).toBeNull()
  })

  test('setAppearance() re-applies what is stored, overriding the page', () => {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ frame: 'flush', density: 'x' }))
    root().setAttribute('data-density', 'normal')
    setAppearance()
    expect(root().getAttribute('data-frame')).toBe('flush')
    expect(root().hasAttribute('data-density')).toBe(false)
  })

  test('resetAppearance removes the attributes and the key, and leaves the scheme', () => {
    setScheme('dark')
    setAppearance({ density: 'normal', frame: 'flush', accent: 'rose' })
    resetAppearance()
    expect(ATTRS.slice(1).map((a) => root().hasAttribute(a))).toEqual([false, false, false])
    expect(localStorage.getItem(APPEARANCE_KEY)).toBeNull()
    expect(root().getAttribute('data-theme')).toBe('dark')
  })

  test('throwing storage still applies the attributes', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota')
    }
    try {
      setAppearance({ accent: 'green' })
    } finally {
      Storage.prototype.setItem = original
    }
    expect(root().getAttribute('data-accent')).toBe('green')
  })
})

describe('reading', () => {
  test('parseAppearance keeps the valid keys only', () => {
    expect(parseAppearance({ density: 'dense', frame: 'round', accent: 'teal', extra: 1 })).toEqual(
      {
        density: 'dense',
        accent: 'teal',
      },
    )
    expect(parseAppearance('violet')).toEqual({})
    expect(parseAppearance(null)).toEqual({})
  })

  test('readAppearance survives a malformed key', () => {
    localStorage.setItem(APPEARANCE_KEY, '{not json')
    expect(readAppearance()).toEqual({})
  })

  test('the snapshot reads <html>, auto with no data-theme, and keeps its identity while unchanged', () => {
    expect(appearanceSnapshot()).toEqual({ scheme: 'auto' })
    root().setAttribute('data-theme', 'dark')
    root().setAttribute('data-accent', 'violet')
    root().setAttribute('data-frame', 'nonsense')
    const a = appearanceSnapshot()
    expect(a).toEqual({ scheme: 'dark', accent: 'violet' })
    expect(appearanceSnapshot()).toBe(a)
  })

  test('subscribeAppearance fires for any writer of the four attributes', async () => {
    let calls = 0
    const off = subscribeAppearance(() => {
      calls += 1
    })
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
    root().setAttribute('data-unrelated', '1')
    await tick()
    expect(calls).toBe(0)
    setAppearance({ density: 'normal' })
    await tick()
    expect(calls).toBe(1)
    setScheme('light')
    await tick()
    off()
    root().removeAttribute('data-unrelated')
    expect(calls).toBe(2)
  })

  test("another tab's write is applied here", () => {
    const off = subscribeAppearance(() => {})
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ accent: 'orange' }))
    window.dispatchEvent(new StorageEvent('storage', { key: APPEARANCE_KEY }))
    off()
    expect(root().getAttribute('data-accent')).toBe('orange')
  })
})
