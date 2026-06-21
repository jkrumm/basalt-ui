/**
 * useAgentStream — React hook managing the full lifecycle of a streaming agent conversation turn.
 *
 * Accepts an injected AgentTransport and returns reactive state (parts, status, error) plus
 * control handlers (send, stop, regenerate). AbortController integration enables clean
 * mid-stream cancellation. SSR-safe — no window access at module or hook top level.
 *
 * Rules of hooks are satisfied: all hooks are called unconditionally at the top level of the
 * returned function; no conditional hook invocations.
 *
 * @example
 * import { useAgentStream, edenTransport, type AgentPart } from 'basalt-ui/agent'
 *
 * const transport = edenTransport<AgentPart>((input, signal) =>
 *   api.chat.post({ body: { message: input }, fetch: { signal } }),
 * )
 *
 * function ChatPanel() {
 *   const { parts, status, send, stop, regenerate } = useAgentStream({ transport })
 *   return (
 *     <div>
 *       <PartList parts={parts} />
 *       {status === 'streaming' && <button onClick={stop}>Stop</button>}
 *       <button onClick={() => send('Hello')}>Send</button>
 *     </div>
 *   )
 * }
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentPart } from './parts'
import type { AgentTransport } from './transport'

// ── StreamStatus ──────────────────────────────────────────────────────────────

/** The lifecycle state of the current stream. */
export type StreamStatus = 'idle' | 'streaming' | 'done' | 'error'

// ── useAgentStream return type ────────────────────────────────────────────────

export type UseAgentStreamReturn<TPart, TInput> = {
  /** Accumulated parts from the current (or last completed) stream. */
  readonly parts: TPart[]
  /** Current lifecycle status. */
  readonly status: StreamStatus
  /** The error thrown during the last failed stream, or undefined. */
  readonly error: unknown
  /**
   * Start a new stream for the given input. Resets parts and status, aborts any in-flight stream,
   * and accumulates new parts as they arrive.
   */
  readonly send: (input: TInput) => Promise<void>
  /** Abort the in-flight stream (no-op when idle or done). */
  readonly stop: () => void
  /** Re-run the last input. No-op if no input has been sent yet. */
  readonly regenerate: () => Promise<void>
}

// ── useAgentStream ────────────────────────────────────────────────────────────

/**
 * Manages a single streaming agent turn over an injected {@link AgentTransport}.
 *
 * @example
 * const { parts, status, send, stop } = useAgentStream({ transport: myTransport })
 * await send('What is the capital of France?')
 * // parts accumulates as the stream arrives
 * // status: 'idle' → 'streaming' → 'done' (or 'error')
 */
export function useAgentStream<TPart = AgentPart, TInput = string>({
  transport,
}: {
  transport: AgentTransport<TPart, TInput>
}): UseAgentStreamReturn<TPart, TInput> {
  const [parts, setParts] = useState<TPart[]>([])
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [error, setError] = useState<unknown>(undefined)

  // Refs: mutable per-render state that must not trigger re-renders.
  const controllerRef = useRef<AbortController | null>(null)
  const lastInputRef = useRef<TInput | undefined>(undefined)

  // Abort any in-flight stream on unmount to stop the async generator.
  useEffect(
    () => () => {
      controllerRef.current?.abort()
    },
    [],
  )

  const send = useCallback(
    async (input: TInput): Promise<void> => {
      // Abort any in-flight stream.
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      lastInputRef.current = input
      setParts([])
      setError(undefined)
      setStatus('streaming')

      try {
        for await (const part of transport.stream(input, controller.signal)) {
          // Guard: if a newer send() has superseded this stream, stop updating state.
          if (controllerRef.current !== controller) return
          if (controller.signal.aborted) break
          setParts((prev) => [...prev, part])
        }
        // Only mark done if this stream is still the current one and wasn't aborted.
        if (controllerRef.current === controller && !controller.signal.aborted) setStatus('done')
      } catch (err) {
        // Ignore abort errors — they are intentional (stop() was called or superseded).
        if (err instanceof Error && err.name === 'AbortError') return
        // Guard: don't corrupt state if a newer stream has taken over.
        if (controllerRef.current !== controller) return
        // Guard: don't overwrite a user-cancelled 'done' if the signal was aborted (e.g. stop()
        // aborted the controller before a non-AbortError propagated from the transport).
        if (controller.signal.aborted) return
        setError(err)
        setStatus('error')
      }
    },
    [transport],
  )

  const stop = useCallback((): void => {
    controllerRef.current?.abort()
    setStatus('done')
  }, [])

  const regenerate = useCallback(async (): Promise<void> => {
    if (lastInputRef.current === undefined) return
    await send(lastInputRef.current)
  }, [send])

  return { parts, status, error, send, stop, regenerate }
}
