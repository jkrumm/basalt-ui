import { describe, expect, test } from 'bun:test'
import { blockSplit } from './block-split'

describe('blockSplit', () => {
  test('returns an empty array for an empty string', () => {
    expect(blockSplit('')).toEqual([])
  })

  test('join invariant holds for arbitrary input', () => {
    const input = `# Title

Paragraph one.

- item one
- item two

\`\`\`ts
const x = 1

const y = 2
\`\`\`

Trailing paragraph.
`
    expect(blockSplit(input).join('')).toBe(input)
  })

  test('splits simple paragraphs on blank-line boundaries', () => {
    const input = 'First paragraph.\n\nSecond paragraph.\n'
    const blocks = blockSplit(input)
    expect(blocks).toEqual(['First paragraph.\n\n', 'Second paragraph.\n'])
  })

  test('keeps a fenced code block containing blank lines as one block', () => {
    const input = '```ts\nconst x = 1\n\nconst y = 2\n```\n\nAfter.\n'
    const blocks = blockSplit(input)
    expect(blocks).toEqual(['```ts\nconst x = 1\n\nconst y = 2\n```\n\n', 'After.\n'])
  })

  test('an unterminated fence at EOF stays one block', () => {
    const input = 'Intro.\n\n```ts\nconst x = 1\n\nstill inside'
    const blocks = blockSplit(input)
    expect(blocks).toEqual(['Intro.\n\n', '```ts\nconst x = 1\n\nstill inside'])
  })

  test('a tilde fence is not closed by a backtick run of the same length', () => {
    const input = '~~~\ncode\n```\nstill inside\n~~~\n\nAfter.\n'
    const blocks = blockSplit(input)
    expect(blocks).toEqual(['~~~\ncode\n```\nstill inside\n~~~\n\n', 'After.\n'])
  })

  test('keeps blank-line-separated list items in one block', () => {
    const input = '- item one\n\n- item two\n\n- item three\n\nNew paragraph.\n'
    const blocks = blockSplit(input)
    expect(blocks).toEqual(['- item one\n\n- item two\n\n- item three\n\n', 'New paragraph.\n'])
  })

  test('keeps an indented continuation line attached to its list item', () => {
    const input = '- item one\n\n  continuation text\n\nNew paragraph.\n'
    const blocks = blockSplit(input)
    expect(blocks).toEqual(['- item one\n\n  continuation text\n\n', 'New paragraph.\n'])
  })

  test('keeps consecutive table lines together with no blank line to split on', () => {
    const input = '| a | b |\n| - | - |\n| 1 | 2 |\n\nAfter.\n'
    const blocks = blockSplit(input)
    expect(blocks).toEqual(['| a | b |\n| - | - |\n| 1 | 2 |\n\n', 'After.\n'])
  })

  test('keeps consecutive blockquote lines together', () => {
    const input = '> line one\n> line two\n\nAfter.\n'
    const blocks = blockSplit(input)
    expect(blocks).toEqual(['> line one\n> line two\n\n', 'After.\n'])
  })
})
