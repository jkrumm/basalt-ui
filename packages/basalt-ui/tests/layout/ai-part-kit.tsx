/* oxlint-disable react/immutability -- a fixture host publishes its handles into a module-level probe on purpose */
/**
 * The browser half of the P3 and P3b fixtures (docs/v3/concepts/ai-mdx.md section 7): a fake
 * server behind `fetch`, a real `DefaultChatTransport` and a real `Chat` from `@ai-sdk/react`, so
 * the scenarios exercise the AI SDK's own request, stream and resume code rather than a stand-in.
 *
 * The server is argo-shaped: it holds each thread's history, takes ONE message per POST
 * (`prepareSendMessagesRequest` sends only the last), answers 409 `stream_in_progress` or
 * `duplicate_turn`, and keeps a run going when the client goes away so `reconnectToStream` replays
 * it. A run is 24 text deltas, 25 ms apart, 86 characters in all.
 */
import { Chat, useChat } from '@ai-sdk/react' // basalt-agent-allow: the fixture exists to drive the raw recipe
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import { Activity, StrictMode, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { partView } from '../../src/ai/part-view'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../src/ui/collapsible'
import type { MessagePart } from '../../src/ai/contract'

// ── The scripted reply ─────────────────────────────────────────────────────────────────────────

/** 14 four-character deltas, 9 three-character ones and a closing `bz.`: 24 deltas, 86 characters. */
export const DELTAS: readonly string[] = [
  ...Array.from({ length: 14 }, (_, i) => `a${String(i).padStart(2, '0')} `),
  ...Array.from({ length: 9 }, (_, i) => `b${i} `),
  'bz.',
]
export const TEXT = DELTAS.join('')

/** The same reply, one character different per thread, so two threads can be told apart. */
export const deltasFor = (tag: string): readonly string[] =>
  DELTAS.map((d, i) => (i === 0 ? `${tag}${d.slice(1)}` : d))

export type Script = { deltas: readonly string[]; failAt?: number; intervalMs?: number }

// ── The fake server ────────────────────────────────────────────────────────────────────────────

type Run = {
  chunks: string[]
  done: boolean
  subs: Set<() => void>
  assistantId: string
}

const sse = (chunk: unknown): string => `data: ${JSON.stringify(chunk)}\n\n`
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export async function until(test: () => boolean, label: string, ms = 10_000): Promise<void> {
  const end = Date.now() + ms
  while (!test()) {
    if (Date.now() > end) throw new Error(`timed out waiting for: ${label}`)
    await wait(10)
  }
}

export class FakeServer {
  threads = new Map<string, UIMessage[]>()
  runs = new Map<string, Run>()
  posts: { chatId: string; body: Record<string, unknown> }[] = []
  gets = 0
  /** Client requests abandoned mid-stream (an abort or a cancelled reader). */
  aborted = 0
  completed = 0
  /** Threads another client holds: a POST answers 409 `stream_in_progress`. */
  busy = new Set<string>()
  scripts = new Map<string, Script>()
  private count = 0

  scriptFor(chatId: string): Script {
    return this.scripts.get(chatId) ?? { deltas: DELTAS }
  }

  seed(chatId: string, messages: UIMessage[]): void {
    this.threads.set(chatId, structuredClone(messages))
  }

  history(chatId: string): UIMessage[] {
    return structuredClone(this.threads.get(chatId) ?? [])
  }

  startRun(chatId: string): Run {
    const script = this.scriptFor(chatId)
    const assistantId = `a-${++this.count}`
    const run: Run = { chunks: [], done: false, subs: new Set(), assistantId }
    this.runs.set(chatId, run)
    const emit = (chunk: unknown): void => {
      run.chunks.push(sse(chunk))
      for (const sub of run.subs) sub()
    }
    emit({ type: 'start', messageId: assistantId })
    emit({ type: 'text-start', id: 't1' })
    const finish = (text: string): void => {
      run.done = true
      const thread = this.threads.get(chatId) ?? []
      thread.push({
        id: assistantId,
        role: 'assistant',
        parts: [{ type: 'text', text, state: 'done' }],
      })
      this.threads.set(chatId, thread)
      this.completed += 1
      for (const sub of run.subs) sub()
    }
    let sent = ''
    const step = (i: number): void => {
      if (script.failAt === i) {
        emit({ type: 'error', errorText: 'boom' })
        finish(sent)
        return
      }
      const delta = script.deltas[i]
      if (delta === undefined) {
        emit({ type: 'text-end', id: 't1' })
        emit({ type: 'finish' })
        finish(sent)
        return
      }
      sent += delta
      emit({ type: 'text-delta', id: 't1', delta })
      setTimeout(() => step(i + 1), script.intervalMs ?? 25)
    }
    setTimeout(() => step(0), script.intervalMs ?? 25)
    return run
  }

  private stream(run: Run, signal: AbortSignal | null | undefined): Response {
    const encoder = new TextEncoder()
    let sent = 0
    let closed = false
    let pump: () => void = () => undefined
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        pump = () => {
          if (closed) return
          while (sent < run.chunks.length) controller.enqueue(encoder.encode(run.chunks[sent++]))
          if (run.done) {
            closed = true
            run.subs.delete(pump)
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          }
        }
        run.subs.add(pump)
        pump()
        signal?.addEventListener('abort', () => {
          if (closed) return
          closed = true
          run.subs.delete(pump)
          this.aborted += 1
          controller.error(new DOMException('aborted', 'AbortError'))
        })
      },
      cancel: () => {
        if (closed) return
        closed = true
        run.subs.delete(pump)
        this.aborted += 1
      },
    })
    return new Response(body, {
      headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
    })
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href, location.href)
    const reconnect = /^\/api\/chat\/([^/]+)\/stream$/.exec(url.pathname)
    if (reconnect) {
      this.gets += 1
      const run = this.runs.get(reconnect[1]!)
      if (!run || run.done) return new Response(null, { status: 204 })
      return this.stream(run, init?.signal)
    }
    const body = JSON.parse(String(init?.body)) as {
      id: string
      message: UIMessage
    }
    this.posts.push({ chatId: body.id, body })
    const thread = this.threads.get(body.id) ?? []
    if (this.busy.has(body.id)) {
      return new Response(JSON.stringify({ code: 'stream_in_progress' }), { status: 409 })
    }
    if (thread.some((m) => m.id === body.message.id)) {
      return new Response(JSON.stringify({ code: 'duplicate_turn' }), { status: 409 })
    }
    thread.push(body.message)
    this.threads.set(body.id, thread)
    return this.stream(this.startRun(body.id), init?.signal)
  }
}

/** The recipe's transport: the last message only, the thread id in the body. */
export function transportFor(server: FakeServer): DefaultChatTransport<UIMessage> {
  return new DefaultChatTransport<UIMessage>({
    api: '/api/chat',
    fetch: server.fetch as typeof fetch,
    resumeStreamIsReplay: true,
    prepareSendMessagesRequest: ({ id, messages }) => ({
      body: { id, message: messages.at(-1) },
    }),
  })
}

export const textOf = (m: UIMessage | undefined): string =>
  (m?.parts ?? []).map((p) => (p.type === 'text' ? p.text : '')).join('')

// ── The views ──────────────────────────────────────────────────────────────────────────────────

export type Container = 'none' | 'collapsible-keep' | 'collapsible' | 'css-hide'

export type Snapshot = {
  status: string
  error: string | undefined
  messages: UIMessage[]
}

/** What a host publishes so the runner can drive and read it without owning React state. */
export type Probe = {
  chat?: Chat<UIMessage>
  send?: (message: { id?: string; text: string }) => Promise<void>
  snapshot: Snapshot
  commits: number
  setMode?: (mode: 'visible' | 'hidden') => void
  setOpen?: (open: boolean) => void
  /** P3b: a loader refetch lands. `ready` applies it; mid-stream it is held (`refetch`: reload on ready; `stale-queue`: apply the payload that landed, the hazard). Never `chat.messages =` mid-stream. */
  hydrate?: (load: () => Promise<UIMessage[]>, mode?: 'refetch' | 'stale-queue') => Promise<void>
  /** P3b: drop one optimistic message by id after a failed POST, then clear the error. */
  rollback?: (messageId: string) => void
}

export const newProbe = (): Probe => ({
  snapshot: { status: 'ready', error: undefined, messages: [] },
  commits: 0,
})

/** A thread's transcript: every message through `partView`, the last one unsettled while it streams. */
export function Transcript({
  messages,
  status,
  container = 'none',
  probe,
}: {
  messages: readonly UIMessage[]
  status: string
  container?: Container | undefined
  probe?: Probe
}): ReactNode {
  const live = status === 'submitted' || status === 'streaming'
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (probe) probe.setOpen = setOpen
  }, [probe])
  const items = messages.map((m, i) => (
    <div key={m.id} data-testid={`msg-${m.role}`} data-id={m.id}>
      {partView(m.parts as readonly MessagePart[], {
        settled: !(live && i === messages.length - 1),
      })}
    </div>
  ))
  if (container === 'css-hide') {
    return (
      <div data-testid="hidden-box" style={{ display: 'none' }}>
        {items}
      </div>
    )
  }
  if (container === 'collapsible-keep' || container === 'collapsible') {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger>Show</CollapsibleTrigger>
        <CollapsibleContent keepMounted={container === 'collapsible-keep'}>
          {items}
        </CollapsibleContent>
      </Collapsible>
    )
  }
  return <div>{items}</div>
}

/** The recipe: the Chat is component-owned, `useChat` is told about it. */
export function OwnedChat({
  server,
  id,
  probe,
  resume,
  throttle,
  container,
}: {
  server: FakeServer
  id: string
  probe: Probe
  resume?: boolean | undefined
  throttle?: number | undefined
  container?: Container | undefined
}): ReactNode {
  const [chat] = useState(() => new Chat<UIMessage>({ id, transport: transportFor(server) }))
  const { messages, status, error, sendMessage } = useChat({
    chat,
    ...(resume && { resume }),
    ...(throttle !== undefined && { experimental_throttle: throttle }),
  })
  useEffect(() => {
    probe.chat = chat
    probe.send = (m) =>
      sendMessage({
        role: 'user',
        parts: [{ type: 'text', text: m.text }],
        ...(m.id && { id: m.id }),
      })
  }, [chat, probe, sendMessage])
  useEffect(() => {
    probe.snapshot = { status, error: error?.message, messages }
    probe.commits += 1
  })
  return (
    <Transcript
      messages={messages}
      status={status}
      probe={probe}
      {...(container && { container })}
    />
  )
}

/** The control: `useChat` with no `chat`, which tears its Chat down when `<Activity>` hides it. */
export function InternalChat({
  server,
  id,
  probe,
}: {
  server: FakeServer
  id: string
  probe: Probe
}): ReactNode {
  const { messages, status, error, sendMessage } = useChat({ id, transport: transportFor(server) })
  useEffect(() => {
    probe.send = (m) => sendMessage({ role: 'user', parts: [{ type: 'text', text: m.text }] })
  }, [probe, sendMessage])
  useEffect(() => {
    probe.snapshot = { status, error: error?.message, messages }
  })
  return <Transcript messages={messages} status={status} />
}

/** Holds the Activity switch so the runner can hide and show a host from outside React. */
export function Gate({ probe, children }: { probe: Probe; children: ReactNode }): ReactNode {
  const [mode, setMode] = useState<'visible' | 'hidden'>('visible')
  useEffect(() => {
    probe.setMode = setMode
  }, [probe])
  return <Activity mode={mode}>{children}</Activity>
}

// ── Mounting ───────────────────────────────────────────────────────────────────────────────────

let current: Root | null = null

export function mount(node: ReactNode, strict: boolean): Root {
  current?.unmount()
  const host = document.getElementById('root')
  if (!host) throw new Error('fixture host is missing #root')
  host.replaceChildren()
  const root = createRoot(host)
  root.render(strict ? <StrictMode>{node}</StrictMode> : node)
  current = root
  return root
}

export function unmount(): void {
  current?.unmount()
  current = null
}

export const sleep = wait

/** The characters the DOM holds for each assistant `ai-text`, hidden or not. */
export function domChars(
  selector = '[data-testid="msg-assistant"] [data-slot="ai-text"]',
): number[] {
  return [...document.querySelectorAll(selector)].map((n) => (n.textContent ?? '').length)
}

export function installFixtureHost(): void {
  ;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
    async () => {}
  document.body.classList.add('bg-background')
}
