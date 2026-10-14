/**
 * Compile-time proof of two `basalt-ui/agent` barrel contracts, in the `state.type-guard.test.ts`
 * convention (a regression fails `tsc --noEmit`, not the runtime):
 *
 * - `StreamStatus` is not exported (MIGRATING.md lists it as deleted) and the derived spelling
 *   consumers are pointed at is the same union.
 * - Every optional prop/field of the public types accepts an explicit `undefined`, so a
 *   maybe-undefined value compiles under the shipped `exactOptionalPropertyTypes`. Reverting any
 *   one `?: T | undefined` back to `?: T` fails the matching probe below.
 */
import { describe, expect, test } from 'bun:test'
import type { ComponentProps } from 'react'

// oxlint-disable import/no-duplicates -- one import per line so the `@ts-expect-error` pins exactly one name

import type {
  AgentPart,
  AgentThread,
  ChatMessage,
  MessageAffordances,
  ThreadFeed,
  ThreadFeedRow,
  Composer,
  ToolChip,
  ToolCallPart,
  ThreadsStore,
  aiSdkTransport,
  useAgentThreadRuns,
} from './index'
// @ts-expect-error `StreamStatus` is internal to './thread', no longer exported from the './index' barrel
import type { StreamStatus } from './index'
import type { AgentTransport } from './transport'
import type { RowHeightProps, VirtualizeProps } from './chat/virtualize'

type Derived = NonNullable<ComponentProps<typeof ThreadFeedRow>['liveStatus']>
type Union = 'idle' | 'submitted' | 'streaming' | 'done' | 'error'
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
const derivedIsTheUnion: Equal<Derived, Union> = true

// Referenced so the unresolved import above is the only diagnostic on its line.
type Guard = [StreamStatus]

// ── Optional props accept an explicit `undefined` ─────────────────────────────

type OptionalKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T]
/** `true` iff every optional key of `T` accepts an explicit `undefined` under `exactOptionalPropertyTypes`. */
type AcceptsUndefined<T> =
  { [K in OptionalKeys<T>]: undefined } extends Pick<T, OptionalKeys<T>> ? true : false

// A type-only value: nothing below reads `maybe` at runtime.
declare const maybe: string | undefined
type Maybe = typeof maybe

type ToolPart = Extract<ToolCallPart, { state: 'output-available' }>

const props: {
  threadFeedRow: AcceptsUndefined<ComponentProps<typeof ThreadFeedRow>>
  threadFeed: AcceptsUndefined<ComponentProps<typeof ThreadFeed>>
  composer: AcceptsUndefined<ComponentProps<typeof Composer>>
  toolChip: AcceptsUndefined<ComponentProps<typeof ToolChip>>
  affordances: AcceptsUndefined<MessageAffordances>
  thread: AcceptsUndefined<AgentThread>
  message: AcceptsUndefined<ChatMessage<AgentPart>>
  runnerOptions: AcceptsUndefined<Parameters<typeof useAgentThreadRuns>[0]>
  transportOptions: AcceptsUndefined<Extract<Parameters<typeof aiSdkTransport>[0], { api: string }>>
  transport: AcceptsUndefined<AgentTransport>
  settledToolPart: AcceptsUndefined<ToolPart>
  textPart: AcceptsUndefined<Extract<AgentPart, { type: 'text' }>>
  startPart: AcceptsUndefined<Extract<AgentPart, { type: 'start' }>>
  sourcePart: AcceptsUndefined<Extract<AgentPart, { type: 'source' }>>
  createOpts: AcceptsUndefined<NonNullable<Parameters<ThreadsStore['create']>[0]>>
} = {
  threadFeedRow: true,
  threadFeed: true,
  composer: true,
  toolChip: true,
  affordances: true,
  thread: true,
  message: true,
  runnerOptions: true,
  transportOptions: true,
  transport: true,
  settledToolPart: true,
  textPart: true,
  startPart: true,
  sourcePart: true,
  createOpts: true,
}

// The two reported call sites, written the way a consumer writes them.
const rowSummary: Pick<ComponentProps<typeof ThreadFeedRow>, 'summary'> = {
  summary: undefined as Maybe,
}
const threadUpdate: Partial<AgentThread> = { resumeToken: undefined as Maybe, meta: undefined }
// The virtualize union accepts explicit `undefined` on both discriminant and `height`.
const virtualize: VirtualizeProps = { virtualize: undefined, height: undefined }
const rowHeight: RowHeightProps = { virtualize: undefined, height: undefined }

describe('basalt-ui/agent barrel types', () => {
  test('the derived liveStatus form equals the documented union', () => {
    const guard: Guard | undefined = undefined
    expect(derivedIsTheUnion).toBe(true)
    expect(guard).toBeUndefined()
  })

  test('every optional prop of the public types accepts an explicit undefined', () => {
    // Compile-time only: each probe above is typed `true`, so a reverted prop fails `tsc`.
    void [props, rowSummary, threadUpdate, virtualize, rowHeight]
  })
})
