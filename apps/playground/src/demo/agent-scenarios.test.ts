import { describe, expect, test } from 'bun:test'
import { DELTA_MS, richParts } from './agent-scenarios'

describe('richParts', () => {
  const parts = richParts()
  const text = parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('')

  test('is a ~1500-word reply over ~3 s', () => {
    const words = (text.match(/\S+/g) ?? []).length
    expect(words).toBeGreaterThan(1400)
    expect(words).toBeLessThan(1700)
    expect(parts.length * DELTA_MS).toBeGreaterThan(2700)
    expect(parts.length * DELTA_MS).toBeLessThan(3500)
  })

  test('covers every block the lane measures', () => {
    expect(parts.some((part) => part.type === 'reasoning')).toBe(true)
    expect(parts.some((part) => part.type === 'tool' && part.state === 'output-available')).toBe(
      true,
    )
    for (const needle of ['```ts', '```mermaid', '> [!NOTE]', '](https://', '\n- ', '\n1. ']) {
      expect(text).toContain(needle)
    }
  })

  test('is deterministic', () => {
    expect(richParts()).toEqual(parts)
  })
})
