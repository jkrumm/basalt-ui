/**
 * P3 and S10 (docs/v3/concepts/ai-mdx.md section 7): `gap-perf` S1-S9 re-run against the recipe,
 * a component-owned `useState(() => new Chat({transport}))` handed to `useChat({chat})`, in real
 * Chrome, plus S10: a streaming `partView` kept under `ui/collapsible` and under CSS-hide loses
 * nothing. `window.aiPart.run(spec)` mounts one scenario and reports what it saw; the layout test
 * asserts on the report.
 */
import {
  DELTAS,
  FakeServer,
  Gate,
  InternalChat,
  OwnedChat,
  TEXT,
  domChars,
  installFixtureHost,
  mount,
  newProbe,
  sleep,
  textOf,
  unmount,
  until,
} from './ai-part-kit'
import type { Container, Probe } from './ai-part-kit'

export type StreamSpec = {
  strict?: boolean
  /** Hide the host with `<Activity>` at `hideAt` ms after the send and show it at `showAt`. */
  activity?: { hideAt: number; showAt: number }
  /** The run begins before the host mounts and `useChat({resume: true})` picks it up (S2). */
  resume?: boolean
  throttle?: number
  /** The server emits an error chunk instead of delta `failAt` (S6). */
  failAt?: number
  /** `crypto.randomUUID` is gone: an insecure context (S8). */
  noUuid?: boolean
  /** `useChat()` with no `chat`: the control the lint sub-check exists for (S3). */
  internal?: boolean
  container?: Container
  /** Unmount the whole tree this long after the send (S5). */
  unmountAt?: number
  /** Open the collapsible once the stream is done. */
  openAfter?: boolean
}

export type StreamReport = {
  status: string
  error: string | undefined
  text: string
  messageCount: number
  ids: string[]
  chars: number[]
  charsOpened: number[]
  invisible: boolean
  aborted: number
  completed: number
  gets: number
  commits: number
}

const THREAD = 'thread-1'

async function run(spec: StreamSpec): Promise<StreamReport> {
  const server = new FakeServer()
  if (spec.failAt !== undefined) server.scripts.set(THREAD, { deltas: DELTAS, failAt: spec.failAt })
  const probe: Probe = newProbe()
  const uuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID')
  if (spec.noUuid)
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
  try {
    const start = Date.now()
    if (spec.resume) {
      server.seed(THREAD, [{ id: 'u-0', role: 'user', parts: [{ type: 'text', text: 'hi' }] }])
      server.startRun(THREAD)
      await sleep(120)
    }
    const host = spec.internal ? (
      <InternalChat server={server} id={THREAD} probe={probe} />
    ) : (
      <OwnedChat
        server={server}
        id={THREAD}
        probe={probe}
        resume={spec.resume}
        throttle={spec.throttle}
        container={spec.container}
      />
    )
    mount(spec.activity ? <Gate probe={probe}>{host}</Gate> : host, spec.strict ?? false)
    await until(() => probe.send !== undefined, 'the host to publish send')
    let sentAt = start
    if (!spec.resume) {
      sentAt = Date.now()
      void probe.send?.({ text: 'hi' }).catch(() => undefined)
    }
    if (spec.activity) {
      setTimeout(() => probe.setMode?.('hidden'), spec.activity.hideAt)
      setTimeout(() => probe.setMode?.('visible'), spec.activity.showAt)
    }
    if (spec.unmountAt !== undefined) {
      await sleep(spec.unmountAt)
      unmount()
      await until(() => server.completed >= 1, 'the server run to finish after the unmount', 5_000)
      return report(server, probe, [], [], false)
    }
    await until(
      () =>
        Date.now() - sentAt > 250 &&
        (probe.snapshot.status === 'ready' || probe.snapshot.status === 'error') &&
        (!spec.resume || server.completed >= 1),
      'the stream to settle',
    )
    await sleep(150)
    const chars = domChars()
    const first = document.querySelector('[data-testid="msg-assistant"] [data-slot="ai-text"]')
    const invisible = first !== null && first.getClientRects().length === 0
    let charsOpened: number[] = []
    if (spec.openAfter) {
      probe.setOpen?.(true)
      await sleep(400)
      charsOpened = domChars()
    }
    return report(server, probe, chars, charsOpened, invisible)
  } finally {
    if (uuid) Object.defineProperty(crypto, 'randomUUID', uuid)
  }
}

function report(
  server: FakeServer,
  probe: Probe,
  chars: number[],
  charsOpened: number[],
  invisible: boolean,
): StreamReport {
  const { status, error, messages } = probe.snapshot
  const assistant = messages.findLast((m) => m.role === 'assistant')
  return {
    status,
    error,
    text: textOf(assistant),
    messageCount: messages.length,
    ids: messages.map((m) => m.id),
    chars,
    charsOpened,
    invisible,
    aborted: server.aborted,
    completed: server.completed,
    gets: server.gets,
    commits: probe.commits,
  }
}

installFixtureHost()
;(window as unknown as { aiPart: { run: typeof run; text: string } }).aiPart = { run, text: TEXT }
