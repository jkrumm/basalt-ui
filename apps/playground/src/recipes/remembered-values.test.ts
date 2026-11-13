/**
 * The four cases that specify docs/recipes/remembered-values.md (controls-url-state 4.5): adopt,
 * deep link wins, write-through, explicit default beats remembered.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { forgetWindow, rememberedSearch, resolveWindow } from './remembered-values'
import { persisted } from 'basalt-ui'

const store = persisted('garmin-health:window', { version: 1, initial: '30d' as string })

beforeEach(() => forgetWindow())

describe('remembered values', () => {
  test('adopt: a nav click after leaving the page carries the remembered window', () => {
    store.set('3m')
    expect(rememberedSearch()).toEqual({ window: '3m' })
  })

  test('deep link wins: the page reads the URL alone and leaves the memory untouched', () => {
    store.set('3m')
    expect(resolveWindow({ window: '1y' })).toBe('1y')
    expect(store.get()).toBe('3m')
  })

  test('write-through: the resolved window of a visit is what the next click carries', () => {
    store.set(resolveWindow({ window: '1y' }))
    expect(rememberedSearch()).toEqual({ window: '1y' })
  })

  test('explicit default beats remembered: choosing the default clears the carried window', () => {
    store.set('3m')
    store.set(resolveWindow({}))
    expect(rememberedSearch()).toEqual({})
  })

  test('an unknown stored or linked value falls back to the default', () => {
    expect(resolveWindow({ window: '5y' })).toBe('30d')
  })
})
