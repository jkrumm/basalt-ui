/**
 * P3b (docs/v3/concepts/ai-mdx.md section 7; Issue v3-ai-i3): the argo-shaped scenario against the
 * reference recipe, in real Chrome with the AI SDK's own `Chat`, `useChat` and `DefaultChatTransport`
 * over a fake server (`ai-part-kit.tsx`). The questions it answers: does a component-owned Chat
 * seeded from a loader hold up under a last-message-only POST, a hydrate that lands mid-stream, a
 * 409 with rollback by message id, and two threads at once? Each test is one of them; a red one
 * means P3b is refuted and the recipe needs a runtime (the concept's fallback).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildAiPartDocument } from './ai-part-build'
import {
  CLOSE_BUDGET_MS,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const DESKTOP: Viewport = { name: 'desktop 1800', width: 1800, height: 1200 }
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const TEXT_LENGTH = 86
const SEED_T1 = ['t1-u1', 't1-a1', 't1-u2', 't1-a2']
const SEED_T2 = ['t2-u1', 't2-a1', 't2-u2', 't2-a2']

let documentPath = ''
let dispose = (): void => undefined

beforeAll(async () => {
  const built = await buildAiPartDocument('ai-part-argo-fixture.tsx', 'ai-part-argo')
  documentPath = serveDocument(built.html)
  dispose = built.dispose
})

afterAll(() => dispose())

type Thread = {
  ids: string[]
  texts: string[]
  dom: string[]
  status: string
  error: string | undefined
}

type HydrateReport = {
  during: string
  lengthRightAfter: number
  serverIds: string[]
  client: Thread
}

/** Calls `window.argo[name](...args)` on a fresh page and returns its JSON report. */
async function scenario<T>(name: string, ...args: unknown[]): Promise<T> {
  const page = await openFixture(EMPTY_SPEC, DESKTOP, documentPath, 'reduce', 'fine')
  return page.raw.evaluate(
    ([n, a]) =>
      (window as unknown as { argo: Record<string, (...x: unknown[]) => Promise<unknown>> }).argo[
        n as string
      ]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>
}

layout('P3b: the argo-shaped workload against the component-owned Chat recipe', () => {
  test('history seeded from a loader is what the Chat starts with, and rendered', async () => {
    const r = await scenario<{ server: string[]; client: Thread; posts: number }>('seeded')
    expect(r.client.ids).toEqual(SEED_T1)
    expect(r.client.ids).toEqual(r.server)
    expect(r.client.dom).toHaveLength(4)
    expect(r.client.dom[1]).toContain('t1 first answer')
    expect(r.posts).toBe(0)
  })

  test('a send POSTs the last message only and the Chat converges on the server history', async () => {
    const r = await scenario<{
      posts: { chatId: string; keys: string[]; message: { id: string; role: string } }[]
      serverIds: string[]
      client: Thread
    }>('lastOnly')
    expect(r.posts).toHaveLength(1)
    expect(r.posts[0]!.chatId).toBe('t1')
    expect(r.posts[0]!.keys).toEqual(['id', 'message'])
    expect(r.posts[0]!.message).toMatchObject({ id: 'u3', role: 'user' })
    expect(r.client.status).toBe('ready')
    expect(r.client.ids).toEqual(r.serverIds)
    expect(r.client.texts.at(-1)!.length).toBe(TEXT_LENGTH)
  })

  test('a hydrate that lands mid-stream is held and reloaded on ready: the stream is whole, nothing doubles', async () => {
    const r = await scenario<HydrateReport>('hydrateMidStream', 'refetch')
    expect(r.during).toBe('streaming')
    // Held, not applied: the Chat still shows its own optimistic turn plus the streaming reply.
    expect(r.lengthRightAfter).toBeGreaterThanOrEqual(5)
    expect(r.client.status).toBe('ready')
    expect(r.client.texts.at(-1)!.length).toBe(TEXT_LENGTH)
    expect(r.client.ids).toEqual(r.serverIds)
    expect(new Set(r.client.ids).size).toBe(r.client.ids.length)
    expect(r.client.dom).toHaveLength(6)
  })

  test('control: applying the payload that landed mid-stream drops the finished reply, so the recipe reloads', async () => {
    const r = await scenario<HydrateReport>('hydrateMidStream', 'stale-queue')
    expect(r.client.status).toBe('ready')
    expect(r.client.ids).not.toEqual(r.serverIds)
    expect(r.client.ids.at(-1)).toBe('u3')
  })

  for (const code of ['stream_in_progress', 'duplicate_turn'] as const) {
    test(`a 409 ${code} rolls back exactly the optimistic message, a streaming sibling thread is untouched`, async () => {
      const r = await scenario<{
        seedIds: string[]
        seedIdsB: string[]
        optimistic: Thread
        rolled: Thread
        posts: string[]
        serverBefore: string[]
        serverAfterRollback: string[]
        sibling: Thread
        retried: Thread
      }>('rollback', code, true)
      // the failed POST left the optimistic turn in place and named the 409
      expect(r.optimistic.status).toBe('error')
      expect(r.optimistic.error).toContain(code)
      expect(r.optimistic.ids).toEqual([...SEED_T1, 'opt-1'])
      expect(r.optimistic.dom.at(-1)).toContain('oops')
      // the rollback removed that one message and nothing else, on screen too
      expect(r.rolled.ids).toEqual(SEED_T1)
      expect(r.rolled.status).toBe('ready')
      expect(r.rolled.dom).toHaveLength(4)
      expect(r.rolled.dom.join(' ')).not.toContain('oops')
      expect(r.serverAfterRollback).toEqual(r.serverBefore)
      // thread 2 streamed through it, whole and on its own ids
      expect(r.sibling.status).toBe('ready')
      expect(r.sibling.texts.at(-1)!.length).toBe(TEXT_LENGTH)
      expect(r.sibling.texts.at(-1)!.startsWith('B')).toBe(true)
      expect(r.sibling.ids.slice(0, 4)).toEqual(SEED_T2)
      expect(r.sibling.dom.join(' ')).not.toContain('oops')
      expect(r.posts.toSorted()).toEqual(['t1', 't1', 't2'])
      // and the rolled-back thread takes the next send
      expect(r.retried.status).toBe('ready')
      expect(r.retried.ids.slice(0, 4)).toEqual(SEED_T1)
      expect(r.retried.ids).toHaveLength(6)
    })
  }

  test('two threads stream at once and switch through an app-owned Map without crossing', async () => {
    const r = await scenario<{
      a: { ids: string[]; texts: string[]; status: string }
      b: { ids: string[]; texts: string[]; status: string }
      shownTexts: string[]
      posts: { chatId: string; text: string }[]
      serverA: string[]
      serverB: string[]
      aborted: number
      textA: string
      textB: string
    }>('twoThreads')
    expect(r.aborted).toBe(0)
    expect(r.a.texts.at(-1)).toBe(r.textA)
    expect(r.b.texts.at(-1)).toBe(r.textB)
    expect(r.a.ids.slice(0, 4)).toEqual(SEED_T1)
    expect(r.b.ids.slice(0, 4)).toEqual(SEED_T2)
    expect(r.a.ids).toEqual(r.serverA)
    expect(r.b.ids).toEqual(r.serverB)
    expect(r.a.texts.join(' ')).not.toContain('ask B')
    expect(r.b.texts.join(' ')).not.toContain('ask A')
    expect(r.posts.toSorted((x, y) => x.chatId.localeCompare(y.chatId))).toEqual([
      { chatId: 't1', text: 'ask A' },
      { chatId: 't2', text: 'ask B' },
    ])
    // switching back to the thread that kept streaming in the background shows all of it
    expect(r.shownTexts.at(-1)).toBe(r.textA)
  })
})
