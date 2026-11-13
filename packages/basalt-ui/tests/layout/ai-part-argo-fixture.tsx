/* oxlint-disable react/immutability -- a fixture host publishes its handles into a module-level probe on purpose */
/**
 * P3b (docs/v3/concepts/ai-mdx.md section 7): the argo-shaped scenario against the reference
 * recipe. History is seeded from a loader before the Chat is constructed, a POST carries the last
 * message only, a loader refetch that lands mid-stream is held until the Chat is `ready`, a 409
 * (`stream_in_progress`, `duplicate_turn`) rolls back exactly the optimistic message by id, and
 * threads kept in an app-owned `Map<string, Chat>` stay separate while one streams in the
 * background. `window.argo.*` mount a scenario and report what it saw.
 */
import { Chat, useChat } from '@ai-sdk/react' // basalt-agent-allow: the fixture exists to drive the raw recipe
import type { UIMessage } from 'ai'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  FakeServer,
  TEXT,
  Transcript,
  deltasFor,
  installFixtureHost,
  mount,
  newProbe,
  sleep,
  textOf,
  transportFor,
  until,
} from './ai-part-kit'
import type { Probe } from './ai-part-kit'

const turn = (id: string, role: 'user' | 'assistant', text: string): UIMessage => ({
  id,
  role,
  parts: [{ type: 'text', text, ...(role === 'assistant' && { state: 'done' as const }) }],
})

/** Two finished turns: the history a loader returns for a thread. */
const history = (tag: string): UIMessage[] => [
  turn(`${tag}-u1`, 'user', `${tag} first question`),
  turn(`${tag}-a1`, 'assistant', `${tag} first answer`),
  turn(`${tag}-u2`, 'user', `${tag} second question`),
  turn(`${tag}-a2`, 'assistant', `${tag} second answer`),
]

const loader = async (server: FakeServer, id: string): Promise<UIMessage[]> => {
  await sleep(20)
  return server.history(id)
}

/** The recipe: seed from the loader, then build the Chat once; reconcile only when `ready`. */
function ThreadHost({
  server,
  id,
  seed,
  probe,
}: {
  server: FakeServer
  id: string
  seed: UIMessage[]
  probe: Probe
}): ReactNode {
  const [chat] = useState(
    () => new Chat<UIMessage>({ id, messages: seed, transport: transportFor(server) }),
  )
  const { messages, status, error } = useChat({ chat })
  const held = useRef<{ load: () => Promise<UIMessage[]> } | { fresh: UIMessage[] } | null>(null)
  useEffect(() => {
    probe.chat = chat
    probe.send = (m) =>
      chat.sendMessage({
        role: 'user',
        parts: [{ type: 'text', text: m.text }],
        ...(m.id && { id: m.id }),
      })
    probe.hydrate = async (load, mode = 'refetch') => {
      const fresh = await load()
      if (chat.status === 'ready') chat.messages = fresh
      else held.current = mode === 'refetch' ? { load } : { fresh }
    }
    probe.rollback = (messageId) => {
      chat.messages = chat.messages.filter((m) => m.id !== messageId)
      chat.clearError()
    }
  }, [chat, probe])
  useEffect(() => {
    const h = held.current
    if (status !== 'ready' || !h) return
    held.current = null
    if ('fresh' in h) chat.messages = h.fresh
    else
      void h.load().then((fresh) => {
        if (chat.status === 'ready') chat.messages = fresh
      })
  }, [status, chat])
  useEffect(() => {
    probe.snapshot = { status, error: error?.message, messages }
  })
  return (
    <section data-thread={id}>
      <Transcript messages={messages} status={status} />
    </section>
  )
}

function Seeded({
  server,
  id,
  probe,
}: {
  server: FakeServer
  id: string
  probe: Probe
}): ReactNode {
  const [seed, setSeed] = useState<UIMessage[] | undefined>()
  useEffect(() => {
    let live = true
    void loader(server, id).then((h) => live && setSeed(h))
    return () => {
      live = false
    }
  }, [server, id])
  return seed ? <ThreadHost server={server} id={id} seed={seed} probe={probe} /> : null
}

function Threads({
  server,
  ids,
  probes,
}: {
  server: FakeServer
  ids: string[]
  probes: Probe[]
}): ReactNode {
  return ids.map((id, i) => <Seeded key={id} server={server} id={id} probe={probes[i]!} />)
}

/** Thread switching the way the reference does it: a `Map` in app code, `useChat({chat})` on the active one. */
function Switcher({
  chats,
  probe,
}: {
  chats: Map<string, Chat<UIMessage>>
  probe: Probe & { setActive?: (id: string) => void }
}): ReactNode {
  const [active, setActive] = useState('t1')
  useEffect(() => {
    probe.setActive = setActive
  }, [probe])
  return <Shown key="shown" chat={chats.get(active)!} id={active} />
}

function Shown({ chat, id }: { chat: Chat<UIMessage>; id: string }): ReactNode {
  const { messages, status } = useChat({ chat })
  return (
    <section data-thread={id}>
      <Transcript messages={messages} status={status} />
    </section>
  )
}

const domTexts = (id: string): string[] =>
  [...document.querySelectorAll(`[data-thread="${id}"] [data-testid^="msg-"]`)].map(
    (n) => n.textContent ?? '',
  )

const settled = (p: Probe): boolean =>
  p.snapshot.status === 'ready' || p.snapshot.status === 'error'

async function booted(server: FakeServer, ids: string[]): Promise<Probe[]> {
  for (const id of ids) server.seed(id, history(id))
  const probes = ids.map(() => newProbe())
  mount(<Threads server={server} ids={ids} probes={probes} />, true)
  await until(
    () => probes.every((p) => p.chat && p.snapshot.messages.length === 4),
    'the seeded threads',
  )
  return probes
}

export type ThreadReport = {
  ids: string[]
  texts: string[]
  dom: string[]
  status: string
  error: string | undefined
}

function thread(p: Probe, id: string): ThreadReport {
  const { messages, status, error } = p.snapshot
  return {
    ids: messages.map((m) => m.id),
    texts: messages.map(textOf),
    dom: domTexts(id),
    status,
    error,
  }
}

async function seeded() {
  const server = new FakeServer()
  const [p] = await booted(server, ['t1'])
  return {
    server: server.history('t1').map((m) => m.id),
    client: thread(p!, 't1'),
    posts: server.posts.length,
  }
}

async function lastOnly() {
  const server = new FakeServer()
  const [p] = await booted(server, ['t1'])
  void p!.send!({ text: 'q3', id: 'u3' })
  await until(() => server.completed >= 1 && settled(p!), 'the stream to settle')
  await sleep(100)
  return {
    posts: server.posts.map((x) => ({
      chatId: x.chatId,
      keys: Object.keys(x.body).toSorted(),
      message: x.body['message'] as UIMessage,
    })),
    serverIds: server.history('t1').map((m) => m.id),
    client: thread(p!, 't1'),
  }
}

async function hydrateMidStream(mode: 'refetch' | 'stale-queue') {
  const server = new FakeServer()
  const [p] = await booted(server, ['t1'])
  void p!.send!({ text: 'q3', id: 'u3' })
  await until(() => p!.snapshot.status === 'streaming', 'streaming')
  await sleep(200)
  const during = p!.snapshot.status
  await p!.hydrate!(() => loader(server, 't1'), mode)
  const lengthRightAfter = p!.snapshot.messages.length
  await until(() => server.completed >= 1 && settled(p!), 'the stream to settle')
  await sleep(150)
  return {
    during,
    lengthRightAfter,
    serverIds: server.history('t1').map((m) => m.id),
    client: thread(p!, 't1'),
  }
}

async function rollback(code: 'stream_in_progress' | 'duplicate_turn', sibling: boolean) {
  const server = new FakeServer()
  server.scripts.set('t2', { deltas: deltasFor('B') })
  const probes = await booted(server, sibling ? ['t1', 't2'] : ['t1'])
  const [a, b] = probes as [Probe, Probe | undefined]
  const seedIds = a.snapshot.messages.map((m) => m.id)
  const seedIdsB = b?.snapshot.messages.map((m) => m.id)
  if (code === 'stream_in_progress') server.busy.add('t1')
  else server.threads.get('t1')!.push(turn('opt-1', 'user', 'already processed'))
  const serverBefore = server.history('t1').map((m) => m.id)
  if (b) void b.send!({ text: 'sibling question', id: 'sibling-u' })
  await sleep(100)
  void a.send!({ text: 'oops', id: 'opt-1' }).catch(() => undefined)
  await until(() => a.snapshot.status === 'error', 'the 409 to land')
  const optimistic = thread(a, 't1')
  a.rollback!('opt-1')
  await until(() => a.snapshot.status === 'ready', 'the rollback to clear the error')
  await sleep(50)
  const rolled = thread(a, 't1')
  const serverAfterRollback = server.history('t1').map((m) => m.id)
  if (b) await until(() => server.completed >= 1 && settled(b), 'the sibling stream to settle')
  await sleep(150)
  // The thread works again once the server lets it (a retry with a fresh id).
  server.busy.delete('t1')
  void a.send!({ text: 'retry', id: 'u-retry' })
  await until(() => a.snapshot.messages.length === 6 && settled(a), 'the retry to settle', 6_000)
  return {
    seedIds,
    seedIdsB,
    optimistic,
    rolled,
    posts: server.posts.map((x) => x.chatId),
    serverBefore,
    serverAfterRollback,
    sibling: b ? thread(b, 't2') : null,
    retried: thread(a, 't1'),
  }
}

async function twoThreads() {
  const server = new FakeServer()
  server.scripts.set('t1', { deltas: deltasFor('A') })
  server.scripts.set('t2', { deltas: deltasFor('B') })
  for (const id of ['t1', 't2']) server.seed(id, history(id))
  const chats = new Map<string, Chat<UIMessage>>()
  for (const id of ['t1', 't2']) {
    chats.set(
      id,
      new Chat<UIMessage>({
        id,
        messages: await loader(server, id),
        transport: transportFor(server),
      }),
    )
  }
  const probe: Probe & { setActive?: (id: string) => void } = newProbe()
  mount(<Switcher chats={chats} probe={probe} />, true)
  await until(() => probe.setActive !== undefined, 'the switcher')
  void chats.get('t1')!.sendMessage({ text: 'ask A' })
  void chats.get('t2')!.sendMessage({ text: 'ask B' })
  await sleep(250)
  probe.setActive!('t2')
  await sleep(300)
  probe.setActive!('t1')
  await until(
    () => server.completed >= 2 && [...chats.values()].every((c) => c.status === 'ready'),
    'both streams',
  )
  await sleep(200)
  const view = (id: string) => {
    const c = chats.get(id)!
    return { ids: c.messages.map((m) => m.id), texts: c.messages.map(textOf), status: c.status }
  }
  return {
    a: view('t1'),
    b: view('t2'),
    shownTexts: domTexts('t1'),
    posts: server.posts.map((x) => ({
      chatId: x.chatId,
      text: textOf(x.body['message'] as UIMessage),
    })),
    serverA: server.history('t1').map((m) => m.id),
    serverB: server.history('t2').map((m) => m.id),
    aborted: server.aborted,
    textA: deltasFor('A').join(''),
    textB: deltasFor('B').join(''),
  }
}

installFixtureHost()
const api = { seeded, lastOnly, hydrateMidStream, rollback, twoThreads, text: TEXT }
;(window as unknown as { argo: typeof api }).argo = api
