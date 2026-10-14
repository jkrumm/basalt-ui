import { describe, expect, test } from 'bun:test'
import { DELTA_MS, richParts, richTransport } from './agent-scenarios'

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

describe('richTransport.stream', () => {
  const drain = async (gen: AsyncGenerator<unknown>): Promise<unknown[]> => {
    const out: unknown[] = []
    for await (const part of gen) out.push(part)
    return out
  }

  test('yields exactly richParts()', async () => {
    expect(await drain(richTransport.stream('hi'))).toEqual(richParts())
  })

  test('yields nothing on a pre-aborted signal', async () => {
    expect(await drain(richTransport.stream('hi', AbortSignal.abort()))).toEqual([])
  })

  test('stops after a mid-stream abort', async () => {
    const controller = new AbortController()
    const out: unknown[] = []
    for await (const part of richTransport.stream('hi', controller.signal)) {
      out.push(part)
      if (out.length === 3) controller.abort()
    }
    expect(out).toHaveLength(3)
  })
})
