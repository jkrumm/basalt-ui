/**
 * `optimistic`: rollback, overlapping mutations (spike D) and the `mutationKey` the invalidate
 * gate needs (spike F). Mutations are built on the client's own cache, no React involved.
 */
import { describe, expect, mock, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import type { MutationOptions } from '@tanstack/react-query'
import { optimistic } from './optimistic'

type Todo = { title: string }
const KEY = ['todo', 1]

const settle = () => new Promise((r) => setTimeout(r, 0))

const deferred = <T = void>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const setup = () => {
  const client = new QueryClient()
  client.setQueryData<Todo>(KEY, { title: 'server' })
  const invalidate = mock((_filters?: unknown) => Promise.resolve())
  client.invalidateQueries = invalidate as unknown as QueryClient['invalidateQueries']
  const handlers = optimistic<string>({
    key: KEY,
    targets: [{ queryKey: KEY, apply: (prev, title) => ({ ...(prev as Todo), title }) }],
  })
  const run = (mutationFn: (title: string) => Promise<unknown>, title: string) => {
    const options = { mutationFn, ...handlers } as MutationOptions<unknown, Error, string>
    return client.getMutationCache().build(client, options).execute(title)
  }
  const title = () => client.getQueryData<Todo>(KEY)?.title
  return { client, invalidate, handlers, run, title }
}

describe('optimistic', () => {
  test('writes the cache before the server answers and invalidates on success', async () => {
    const { run, title, invalidate } = setup()
    const gate = deferred()
    const pending = run(() => gate.promise, 'optimistic')
    await settle()
    await settle()
    expect(title()).toBe('optimistic')
    gate.resolve()
    await pending
    expect(invalidate).toHaveBeenCalledTimes(1)
  })

  test('rolls back to the snapshot on error, then invalidates', async () => {
    const { run, title, invalidate } = setup()
    await expect(run(() => Promise.reject(new Error('nope')), 'optimistic')).rejects.toThrow('nope')
    expect(title()).toBe('server')
    expect(invalidate).toHaveBeenCalledTimes(1)
  })

  test('returns the mutationKey and a scope id derived from it', () => {
    const { handlers } = setup()
    expect(handlers.mutationKey).toEqual(KEY)
    expect(handlers.scope.id).toBe(JSON.stringify(KEY))
    expect(optimistic({ key: KEY, scope: 'custom', targets: [] }).scope).toEqual({ id: 'custom' })
  })

  test('skips a target with no cached data: nothing is written, nothing to restore', async () => {
    const { client, handlers } = setup()
    const empty = ['empty']
    const h = optimistic<string>({
      key: ['x'],
      targets: [{ queryKey: empty, apply: () => 'invented' }],
    })
    const options = { mutationFn: () => Promise.reject(new Error('x')), ...h } as MutationOptions<
      unknown,
      Error,
      string
    >
    await expect(client.getMutationCache().build(client, options).execute('v')).rejects.toThrow()
    expect(client.getQueryData(empty)).toBeUndefined()
    expect(handlers.scope.id).toBeDefined()
  })

  describe('two overlapping mutations (spike D)', () => {
    test('a failing first mutation does not revert the second one on screen', async () => {
      const { run, title, invalidate } = setup()
      const a = deferred()
      const b = deferred()
      const pendingA = run(() => a.promise, 'A')
      await settle()
      await settle()
      const pendingB = run(() => b.promise, 'B')
      await settle()
      expect(title()).toBe('B')

      a.reject(new Error('A failed'))
      await expect(pendingA).rejects.toThrow('A failed')
      expect(title()).toBe('B')
      expect(invalidate).not.toHaveBeenCalled()

      b.resolve()
      await pendingB
      expect(title()).toBe('B')
      expect(invalidate).toHaveBeenCalledTimes(1)
    })

    test('the invalidate runs once, when the last mutation settles', async () => {
      const { run, invalidate } = setup()
      const a = deferred()
      const b = deferred()
      const pendingA = run(() => a.promise, 'A')
      await settle()
      await settle()
      const pendingB = run(() => b.promise, 'B')
      await settle()
      a.resolve()
      await pendingA
      expect(invalidate).not.toHaveBeenCalled()
      b.resolve()
      await pendingB
      expect(invalidate).toHaveBeenCalledTimes(1)
    })
  })

  test('an unrelated pending mutation does not block the invalidate', async () => {
    const { client, run, invalidate } = setup()
    const unrelated = client
      .getMutationCache()
      .build(client, { mutationKey: ['other'], mutationFn: () => new Promise<void>(() => {}) })
    void unrelated.execute(undefined)
    await settle()
    expect(client.isMutating()).toBe(1)

    await run(() => Promise.resolve(), 'optimistic')
    expect(invalidate).toHaveBeenCalledTimes(1)
  })

  describe('the returned mutationKey is what makes the gate work (spike F)', () => {
    test('without a key, isMutating counts every pending mutation', async () => {
      const { client } = setup()
      const never = () => new Promise<void>(() => {})
      void client.getMutationCache().build(client, { mutationFn: never }).execute(undefined)
      void client
        .getMutationCache()
        .build(client, { mutationKey: ['other'], mutationFn: never })
        .execute(undefined)
      await settle()
      expect(client.isMutating()).toBe(2)
      expect(client.isMutating({ mutationKey: KEY })).toBe(0)
    })

    test('spreading the handlers without the returned mutationKey never invalidates', async () => {
      const { client, handlers, invalidate } = setup()
      const { mutationKey: _omitted, ...withoutKey } = handlers
      const options = {
        mutationFn: () => Promise.resolve(),
        ...withoutKey,
      } as MutationOptions<unknown, Error, string>
      await client.getMutationCache().build(client, options).execute('v')
      expect(invalidate).not.toHaveBeenCalled()
    })

    test('with the key spread (the documented form) the invalidate runs', async () => {
      const { run, invalidate } = setup()
      await run(() => Promise.resolve(), 'v')
      expect(invalidate).toHaveBeenCalledTimes(1)
    })
  })
})
