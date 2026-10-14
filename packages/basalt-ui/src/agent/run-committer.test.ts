import { describe, expect, test } from 'bun:test'
import { createRunCommitter, isContentPart } from './run-committer'
import type { LiveRunStatus } from './thread'

describe('isContentPart', () => {
  test.each([
    ['text', true],
    ['reasoning', true],
    ['tool', true],
    ['source', false],
    ['start', false],
    ['error', false],
  ])('%s -> %p', (type, content) => {
    expect(isContentPart({ id: 'p', type })).toBe(content)
  })
})

describe('createRunCommitter', () => {
  function setup(wait: number) {
    const commits: Array<{ parts: string[]; status: LiveRunStatus }> = []
    const committer = createRunCommitter<string>(wait, (parts, status) => {
      commits.push({ parts, status })
    })
    return { commits, committer }
  }

  test('wait 0 commits every push', () => {
    const { commits, committer } = setup(0)
    committer.push(['a'], 'submitted')
    committer.push(['a', 'b'], 'streaming')
    expect(commits.map((c) => c.parts.length)).toEqual([1, 2])
  })

  test('inside the window only the first push commits; flush commits the LATEST snapshot once', () => {
    const { commits, committer } = setup(60_000)
    committer.push(['a'], 'streaming')
    committer.push(['a', 'b'], 'streaming')
    committer.push(['a', 'b', 'c'], 'streaming')
    expect(commits.map((c) => c.parts.length)).toEqual([1])
    committer.flush()
    expect(commits.map((c) => c.parts.length)).toEqual([1, 3])
    committer.flush()
    expect(commits).toHaveLength(2)
  })

  test('an immediate push bypasses the window and supersedes the pending snapshot', () => {
    const { commits, committer } = setup(60_000)
    committer.push(['a'], 'submitted')
    committer.push(['a', 'b'], 'submitted')
    committer.push(['a', 'b', 'c'], 'streaming', true)
    expect(commits.map((c) => [c.parts.length, c.status])).toEqual([
      [1, 'submitted'],
      [3, 'streaming'],
    ])
    committer.flush()
    expect(commits).toHaveLength(2)
  })

  test('cancel drops the pending snapshot', () => {
    const { commits, committer } = setup(60_000)
    committer.push(['a'], 'streaming')
    committer.push(['a', 'b'], 'streaming')
    committer.cancel()
    committer.flush()
    expect(commits).toHaveLength(1)
  })

  test('the trailing timer commits the pending snapshot after the window', async () => {
    const { commits, committer } = setup(20)
    committer.push(['a'], 'streaming')
    committer.push(['a', 'b'], 'streaming')
    expect(commits).toHaveLength(1)
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(commits.map((c) => c.parts.length)).toEqual([1, 2])
  })
})
