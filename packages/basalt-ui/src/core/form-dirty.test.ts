/** `isPristine` — structural compare of form values against the default values. */
import { describe, expect, test } from 'bun:test'
import { isPristine } from './form-dirty'

const form = (values: unknown, defaultValues?: unknown) => ({
  state: { values },
  options: { defaultValues },
})

describe('isPristine', () => {
  test('equal plain objects are pristine regardless of key order', () => {
    expect(isPristine(form({ a: 1, b: 'x' }, { b: 'x', a: 1 }))).toBe(true)
    expect(isPristine(form({ a: 1, b: 'y' }, { b: 'x', a: 1 }))).toBe(false)
  })

  test('missing defaultValues compare against an empty object', () => {
    expect(isPristine(form({}))).toBe(true)
    expect(isPristine(form({ a: 1 }))).toBe(false)
  })

  test('undefined-valued properties equal missing ones', () => {
    expect(isPristine(form({ a: 1, b: undefined }, { a: 1 }))).toBe(true)
    expect(isPristine(form({ a: 1 }, { a: 1, b: undefined }))).toBe(true)
    expect(isPristine(form({ a: 1, b: null }, { a: 1 }))).toBe(false)
  })

  test('a key the form never rendered counts when defaults hold it', () => {
    const defaults = { name: 'x', hidden: { id: 4 } }
    expect(isPristine(form({ name: 'x', hidden: { id: 4 } }, defaults))).toBe(true)
    expect(isPristine(form({ name: 'x', hidden: { id: 5 } }, defaults))).toBe(false)
    expect(isPristine(form({ name: 'x' }, defaults))).toBe(false)
  })

  test('arrays compare in order and by length', () => {
    const defaults = { rows: [{ id: 1 }, { id: 2 }] }
    expect(isPristine(form({ rows: [{ id: 1 }, { id: 2 }] }, defaults))).toBe(true)
    expect(isPristine(form({ rows: [{ id: 1 }] }, defaults))).toBe(false)
    expect(isPristine(form({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] }, defaults))).toBe(false)
    expect(isPristine(form({ rows: [{ id: 2 }, { id: 1 }] }, defaults))).toBe(false)
  })

  test('dates compare by time', () => {
    expect(isPristine(form({ d: new Date(5) }, { d: new Date(5) }))).toBe(true)
    expect(isPristine(form({ d: new Date(5) }, { d: new Date(6) }))).toBe(false)
    expect(isPristine(form({ d: new Date(5) }, { d: 5 }))).toBe(false)
  })

  test('primitives use Object.is', () => {
    expect(isPristine(form({ n: NaN }, { n: NaN }))).toBe(true)
    expect(isPristine(form({ n: 0 }, { n: -0 }))).toBe(false)
    expect(isPristine(form({ n: 1 }, { n: '1' }))).toBe(false)
  })

  test('an array is not an object with the same keys', () => {
    expect(isPristine(form({ a: [] }, { a: {} }))).toBe(false)
  })
})
