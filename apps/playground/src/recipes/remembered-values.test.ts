/**
 * The four cases that specify docs/recipes/remembered-values.md (controls-url-state 4.5): adopt,
 * deep link wins, write-through, explicit default beats remembered.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { forgetWindow, rememberedSearch, resolveWindow } from './remembered-values'
import { persisted } from 'basalt-ui'

const store = persisted<{ window?: unknown; kind?: unknown }>('garmin-health:window', {
  version: 1,
  initial: {},
})
const remember = (window: string) => store.set((record) => ({ ...record, window }))

beforeEach(() => forgetWindow())

describe('remembered values', () => {
  test('adopt: a nav click after leaving the page carries the remembered window', () => {
    remember('3m')
    expect(rememberedSearch()).toEqual({ window: '3m' })
  })

  test('deep link wins: the page reads the URL alone and leaves the memory untouched', () => {
    remember('3m')
    expect(resolveWindow({ window: '1y' })).toBe('1y')
    expect(store.get().window).toBe('3m')
  })

  test('write-through: the resolved window of a visit is what the next click carries', () => {
    remember(resolveWindow({ window: '1y' }))
    expect(rememberedSearch()).toEqual({ window: '1y' })
  })

  test('explicit default beats remembered: choosing the default clears the carried window', () => {
    remember('3m')
    remember(resolveWindow({}))
    expect(rememberedSearch()).toEqual({})
  })

  test('a value written by 2.x is read as it stands, and a sibling field of the record survives', () => {
    localStorage.setItem(
      'basalt:garmin-health:window',
      JSON.stringify({ v: 1, value: { window: '1y', kind: 'a' } }),
    )
    expect(rememberedSearch()).toEqual({ window: '1y' })
    remember('3m')
    expect(store.get()).toEqual({ window: '3m', kind: 'a' })
  })

  test('an unknown stored or linked value falls back to the default', () => {
    expect(resolveWindow({ window: '5y' })).toBe('30d')
  })
})
