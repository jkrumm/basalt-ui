import { describe, expect, test } from 'bun:test'
import { mergeText } from './merge-json'

const doc = (managed: Record<string, string>, version = '2.29.0'): string =>
  `${JSON.stringify({ profile: 'site', version, managed }, null, 2)}\n`

const base = doc({ 'a.md': '1', 'b.md': '1', 'c.md': '1' })

describe('merge-json', () => {
  test('two branches that change neighbouring keys merge with no conflict', () => {
    const ours = doc({ 'a.md': '2', 'b.md': '1', 'c.md': '1' })
    const theirs = doc({ 'a.md': '1', 'b.md': '3', 'c.md': '1' })
    expect(mergeText(base, ours, theirs)).toBe(doc({ 'a.md': '2', 'b.md': '3', 'c.md': '1' }))
  })

  test('a key one side adds lands in sorted place; a key one side drops stays dropped', () => {
    const ours = doc({ 'a.md': '1', 'b.md': '1' })
    const theirs = doc({ 'a.md': '1', 'ab.md': '9', 'b.md': '1', 'c.md': '1' })
    expect(mergeText(base, ours, theirs)).toBe(doc({ 'a.md': '1', 'ab.md': '9', 'b.md': '1' }))
  })

  test('the same key changed apart on both sides is a conflict', () => {
    const ours = doc({ 'a.md': '2', 'b.md': '1', 'c.md': '1' })
    const theirs = doc({ 'a.md': '3', 'b.md': '1', 'c.md': '1' })
    expect(mergeText(base, ours, theirs)).toBeNull()
  })

  test('a side that is not in canonical form falls back to the line merge', () => {
    const ours = JSON.stringify({ profile: 'site', version: '2.29.0', managed: {} })
    expect(mergeText(base, ours, base)).toBeNull()
  })
})
