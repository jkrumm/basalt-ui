import { describe, expect, test } from 'bun:test'
import { createFormat } from '../../../src/core/format'
import { en } from '../../../src/core/messages'
import { pseudo, pseudoMessages } from './pseudo-messages'

describe('pseudoMessages', () => {
  test('accents every letter, wraps in brackets and adds 40 percent', () => {
    expect(pseudo('Retry')).toBe('[Ŕéţŕý~~]')
    expect(pseudo('')).toBe('')
  })

  test('covers every key of the English catalog, strings and functions alike', () => {
    const messages = pseudoMessages()
    expect(Object.keys(messages).toSorted()).toEqual(Object.keys(en).toSorted())
    const f = createFormat()
    for (const [key, message] of Object.entries(messages) as [string, unknown][]) {
      const text =
        typeof message === 'function'
          ? (message as (...a: unknown[]) => string)(f, ...ARGS)
          : message
      expect(text, key).toMatch(/^\[.*\]$/s)
    }
  })

  test('every message grows by at least 40 percent of its English length', () => {
    const messages = pseudoMessages()
    const f = createFormat()
    for (const [key, message] of Object.entries(en) as [string, unknown][]) {
      const english =
        typeof message === 'function'
          ? (message as (...a: unknown[]) => string)(f, ...ARGS)
          : (message as string)
      const long = (messages as Record<string, unknown>)[key]
      const text =
        typeof long === 'function'
          ? (long as (...a: unknown[]) => string)(f, ...ARGS)
          : (long as string)
      expect(text.length, key).toBeGreaterThanOrEqual(Math.ceil(english.length * 1.4) + 2)
    }
  })
})

/** Enough arguments for any message function: numbers print, strings print. */
const ARGS = [3, 25, 4210, 'x', 'y']
