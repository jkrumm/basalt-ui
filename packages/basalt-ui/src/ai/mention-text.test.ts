import { describe, expect, test } from 'bun:test'
import { insertMention, mentionQuery, rebaseMentions } from './mention-text'
import type { Mention } from './mention-text'

const token = (start: number, label: string, value = label): Mention<string> => ({
  value,
  label,
  start,
  end: start + 1 + label.length,
})

describe('mentionQuery', () => {
  test('an @ at the start or after white space opens a query up to the caret', () => {
    expect(mentionQuery('@acm', 4, [])).toEqual({ start: 0, query: 'acm' })
    expect(mentionQuery('ask @', 5, [])).toEqual({ start: 4, query: '' })
    expect(mentionQuery('line\n@ro', 8, [])).toEqual({ start: 5, query: 'ro' })
  })

  test('an @ inside a word, a space after it or a caret in a token opens none', () => {
    expect(mentionQuery('mail@acme', 9, [])).toBeUndefined()
    expect(mentionQuery('@acme bearings', 14, [])).toBeUndefined()
    expect(mentionQuery('@Acme', 3, [token(0, 'Acme')])).toBeUndefined()
  })
})

describe('rebaseMentions', () => {
  const text = 'ask @Acme about @Rotor'
  const tokens = [token(4, 'Acme'), token(16, 'Rotor')]

  test('an edit before a token moves it; one after leaves it', () => {
    const moved = rebaseMentions(tokens, text, `please ${text}`)
    expect(moved.map((t) => [t.start, t.end])).toEqual([
      [11, 16],
      [23, 29],
    ])
    expect(rebaseMentions(tokens, text, `${text}!`)).toEqual(tokens)
  })

  test('typing right after a token keeps it; an edit inside drops it', () => {
    expect(rebaseMentions(tokens, text, 'ask @Acme, about @Rotor').map((t) => t.label)).toEqual([
      'Acme',
      'Rotor',
    ])
    expect(rebaseMentions(tokens, text, 'ask @Acne about @Rotor').map((t) => t.label)).toEqual([
      'Rotor',
    ])
  })

  test('clearing the text drops every token', () => {
    expect(rebaseMentions(tokens, text, '')).toEqual([])
  })
})

describe('insertMention', () => {
  test('the query becomes the label and a space, and later tokens move', () => {
    const before = 'ask @ro then @Acme'
    const result = insertMention({
      text: before,
      tokens: [token(13, 'Acme')],
      start: 4,
      caret: 7,
      value: 'p-17',
      label: 'Rotor seal',
    })
    expect(result.text).toBe('ask @Rotor seal then @Acme')
    expect(result.caret).toBe(16)
    expect(result.tokens).toEqual([
      { value: 'p-17', label: 'Rotor seal', start: 4, end: 15 },
      { value: 'Acme', label: 'Acme', start: 21, end: 26 },
    ])
    for (const t of result.tokens) expect(result.text.slice(t.start, t.end)).toBe(`@${t.label}`)
  })
})
