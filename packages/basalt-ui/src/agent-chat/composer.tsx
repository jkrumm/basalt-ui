/**
 * Composer — a prop-driven message input: autosize Textarea + send/stop action, with slots.
 *
 * Enter submits (trims; Shift+Enter and an in-progress IME composition insert a newline instead).
 * The draft (and pending attachments) clear OPTIMISTICALLY the instant a send goes out — the
 * textarea empties immediately rather than sitting full for a round trip. `onSubmit` may return
 * `void` or a `Promise<void>`; a SYNCHRONOUS throw or a REJECTED promise both restore exactly what
 * was cleared, so a send the caller rejects — on the spot, or 300ms later over the network — never
 * eats what was typed. See the `onSubmit` prop doc for the restoration guards (a newer edit or a
 * second send always wins over a stale restore). No store or fetching coupling — the caller owns
 * wiring `onSubmit` to whatever sends the message, and `leftSection`/`rightSection` are opaque
 * `ReactNode` slots so basalt never has to learn what a voice recorder or a file picker is.
 *
 * Slot content that needs to WRITE into the composer — a voice recorder's transcript, a
 * suggestion chip — does so through the `ref` handle (`ComposerHandle`), not a prop callback; see
 * the example below and `ComposerHandle`'s own doc for the full contract.
 *
 * @example
 * import { useRef } from 'react'
 * import { Composer } from 'basalt-ui'
 * import type { ComposerHandle } from 'basalt-ui'
 *
 * const composerRef = useRef<ComposerHandle>(null)
 *
 * <Composer
 *   ref={composerRef}
 *   draftKey={`thread:${thread.id}`}
 *   streaming={runStatus === 'streaming'}
 *   onStop={() => runs.stop(thread.id)}
 *   leftSection={
 *     <VoiceRecordButton
 *       onTranscript={(chunk) => composerRef.current?.insertText(chunk)}
 *       onDone={() => composerRef.current?.focus()}
 *     />
 *   }
 *   onSubmit={({ text, attachments }) => send(text, attachments)}
 * />
 */
import { ActionIcon, Group, Kbd, Stack, Text, Textarea } from '@mantine/core'
import type { ClipboardEvent, ComponentProps, JSX, KeyboardEvent, ReactNode, Ref } from 'react'
import { useImperativeHandle, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { readPersistedValue } from '../state'
import { VX } from '../tokens'

/** A minimal, dependency-free send-arrow glyph (icons are passed in as ReactNode elsewhere; this
 * one is inline since Composer has no icon prop in its contract). */
function SendGlyph(): JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12l16 -7l-7 16l-2 -7l-7 -2z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The send glyph's sibling for the Stop affordance — a filled square, the universal stop mark. */
function StopGlyph(): JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
      <rect x={7} y={7} width={10} height={10} rx={2} fill="currentColor" />
    </svg>
  )
}

// ── Draft persistence ─────────────────────────────────────────────────────────
//
// `draftKey` is a RUNTIME prop that can change while mounted (switching threads), so the module-
// scope `createPersistedState(...)` call every other basalt caller makes is unavailable here — a
// factory can't be invoked per render, and its hook can't be swapped conditionally. Instead this is
// one tiny external store PER KEY, memoized outside React, read through a single
// `useSyncExternalStore` whose store object is chosen during render. Switching `draftKey` swaps the
// store, React re-subscribes, and the other key's draft appears; no hook is called conditionally.
//
// The envelope written here is byte-compatible with `createPersistedState` (`{ v, value }` under
// `basalt:<key>`) and is read back through the exported `readPersistedValue` door, so the two
// mechanisms interoperate. The in-memory `cache` — not localStorage — is the snapshot authority:
// `getSnapshot` must be cheap and stable, and a storage write that throws (quota, private
// browsing) must degrade to an in-memory draft rather than freeze the textarea.

const DRAFT_VERSION = 1

type DraftStore = {
  readonly subscribe: (cb: () => void) => () => void
  readonly get: () => string
  readonly set: (next: string) => void
  /**
   * Monotonic, per-store submission counter. `bumpSubmissionId` marks a new send as the latest one
   * through THIS exact draft (i.e. this `draftKey`); `currentSubmissionId` peeks it without
   * bumping. A rejected submit compares its own id against this to tell "no later submission has
   * gone through this same draft" from "one already has" (a second send, whose own optimistic
   * clear should win) before restoring the cleared text — see `submit()` in Composer. Scoped to
   * the store rather than the component instance so sending a NEW message in a DIFFERENT thread
   * never blocks restoring an older thread's failed draft.
   */
  readonly bumpSubmissionId: () => number
  readonly currentSubmissionId: () => number
}

/** One store. `key === null` means memory-only (no `draftKey` — nothing is persisted). */
function createDraftStore(key: string | null): DraftStore {
  const storageKey = key === null ? null : `basalt:composer-draft:${key}`
  const listeners = new Set<() => void>()
  // `null` = not hydrated yet; the memory-only store starts already hydrated so it never reads.
  let cache: string | null = key === null ? '' : null
  let storageHandler: ((e: StorageEvent) => void) | null = null
  let submissionId = 0

  const notify = (): void => {
    for (const cb of listeners) cb()
  }

  return {
    subscribe: (cb) => {
      listeners.add(cb)
      // ONE shared 'storage' listener per key, attached on the first subscriber (state.ts idiom).
      if (storageKey !== null && storageHandler === null) {
        storageHandler = (e: StorageEvent): void => {
          if (e.key !== storageKey) return
          cache = null
          notify()
        }
        window.addEventListener('storage', storageHandler)
      }
      return () => {
        listeners.delete(cb)
        if (listeners.size === 0 && storageHandler !== null) {
          window.removeEventListener('storage', storageHandler)
          storageHandler = null
        }
      }
    },
    get: () => {
      if (cache === null) {
        const persisted =
          key === null ? null : readPersistedValue(`composer-draft:${key}`, DRAFT_VERSION)
        cache = typeof persisted === 'string' ? persisted : ''
      }
      return cache
    },
    set: (next) => {
      cache = next
      if (storageKey !== null) {
        try {
          // An empty draft is an absent draft — don't leave a `{"v":1,"value":""}` husk behind.
          if (next.length === 0) window.localStorage.removeItem(storageKey)
          else
            window.localStorage.setItem(
              storageKey,
              JSON.stringify({ v: DRAFT_VERSION, value: next }),
            )
        } catch {
          // Quota / private browsing — the draft degrades to in-memory rather than going read-only.
        }
      }
      notify()
    },
    bumpSubmissionId: () => {
      submissionId += 1
      return submissionId
    },
    currentSubmissionId: () => submissionId,
  }
}

const draftStores = new Map<string, DraftStore>()

function persistedDraftStore(key: string): DraftStore {
  const existing = draftStores.get(key)
  if (existing !== undefined) return existing
  const created = createDraftStore(key)
  draftStores.set(key, created)
  return created
}

// SSR guards, mirroring state.ts — detected once at module load.
const isServer = typeof window === 'undefined'
const noopSubscribe =
  (_cb: () => void): (() => void) =>
  () => {}
const emptyDraft = (): string => ''

export type ComposerAttachment = {
  readonly id: string
  readonly name: string
  readonly mediaType: string
  readonly size: number
  readonly url: string
}

export type ComposerSubmit = {
  readonly text: string
  readonly attachments: readonly ComposerAttachment[]
}

/** Stable empty list — keeps the submit payload's `attachments` referentially constant. */
const NO_ATTACHMENTS: readonly ComposerAttachment[] = []

/**
 * Imperative escape hatch for slot content that must write into the composer from OUTSIDE the
 * render tree — a voice recorder streaming transcript chunks, a suggestion chip inserting at the
 * cursor. Obtained via `ref`. Kept to exactly the three primitives that cover both real use cases
 * (every method here is API surface fixed for a major, so this is deliberately not more):
 *
 *   - `insertText` — the one write primitive. Inserts at the CURRENT SELECTION, replacing it if
 *     non-collapsed, so a mid-speech voice chunk lands where the caret is and a suggestion never
 *     clobbers a selection the user made on purpose. See its own doc for what "current selection"
 *     means when the textarea isn't focused.
 *   - `setValue` — a whole-value replace (loading a canned reply, discarding the draft), for when
 *     there is no meaningful selection to insert around.
 *   - `focus` — hands focus back to the textarea (e.g. once a recorder finishes).
 *
 * All three write through the SAME draft store `onChange` does — same `draftKey` persistence,
 * same subscriber notification, same value the existing submit/clear/restore logic already sees.
 * There is no second source of truth.
 *
 * A slot control that inserts at the caret must not steal focus first. A plain `<button>` in
 * `leftSection`/`rightSection` blurs the textarea on mousedown, which collapses the selection before
 * `onClick` runs — so every insert silently lands at the end and the at-caret path is unreachable by
 * mouse. Suppress it on the control, not here:
 *
 * ```tsx
 * <ActionIcon onMouseDown={(e) => e.preventDefault()} onClick={record}>
 * ```
 */
export type ComposerHandle = {
  /**
   * Inserts `text` at the textarea's current selection, replacing it if non-collapsed, then moves
   * the caret to just after the inserted text.
   *
   * "Current selection" only exists while the textarea IS the focused element — a `<textarea>`'s
   * `selectionStart`/`selectionEnd` are not a reliable caret once focus has moved elsewhere, so:
   *   - **focused, collapsed caret**: inserts at that caret position.
   *   - **focused, with a range selected**: replaces the selected range (never inserted alongside
   *     it — that would silently keep text the user was in the middle of deleting).
   *   - **not focused, including never focused**: appends to the end of the current value. This is
   *     the safe default for a voice recorder streaming chunks before the user has clicked into
   *     the box at all.
   */
  readonly insertText: (text: string) => void
  /** Replaces the whole draft value and moves the caret to the end. */
  readonly setValue: (value: string) => void
  /** Focuses the textarea. */
  readonly focus: () => void
}

/** The textarea's live `{ start, end }` selection, or `null` when there is none to trust — see
 * `ComposerHandle.insertText`'s doc for what "none" covers. */
function liveSelection(el: HTMLTextAreaElement): { start: number; end: number } | null {
  if (document.activeElement !== el) return null
  const { selectionStart, selectionEnd } = el
  if (selectionStart === null || selectionEnd === null) return null
  return { start: selectionStart, end: selectionEnd }
}

export type ComposerProps = {
  /** Imperative write/focus handle — see `ComposerHandle`. */
  readonly ref?: Ref<ComposerHandle>
  /**
   * Called with the trimmed text plus the pending attachments. May return `void` (fire-and-forget,
   * validated only synchronously) or a `Promise<void>` (its outcome is awaited, its timing is not).
   *
   * The draft and attachments clear OPTIMISTICALLY, immediately, before this settles — a chat
   * composer has to feel instant, so Composer never sits on the typed text for a round trip.
   * Rejecting restores them instead:
   *   - THROW synchronously to refuse a send outright (bad input, offline, …) — the clear never
   *     runs, exactly as before this prop went async.
   *   - Return a promise that REJECTS to report a failure discovered later (a network error) — the
   *     text and attachments are put back, UNLESS something has since made that unsafe:
   *       - the user already typed something new into the (now-empty) box — their new text wins;
   *         the failed one is not restored (surface a retry via the failed message instead);
   *       - a LATER submit has already gone through this same draft — that one's own optimistic
   *         clear (whether it went on to succeed or fail) wins over restoring this older one;
   *       - the attachments are no longer empty (the caller already put something else there), or
   *         `draftKey` has since changed (this Composer now points at a different thread/consumer
   *         destination) — either way the attachments are left as they are rather than risking a
   *         leak into whatever is current now.
   * A resolved promise clears and stays cleared, same as a `void` return.
   */
  readonly onSubmit: (payload: ComposerSubmit) => void | Promise<void>
  readonly placeholder?: string
  /** Autofocuses the textarea on mount. */
  readonly autoFocus?: boolean
  /** Autosize ceiling for the textarea. Default 6. */
  readonly maxRows?: number
  /** Hard-disable, independent of streaming (e.g. offline). */
  readonly disabled?: boolean
  /** A run is in flight on this thread. */
  readonly streaming?: boolean
  /** Default false — preserves the historical `disabled={streaming}` behaviour. */
  readonly allowSubmitWhileStreaming?: boolean
  /** When given, the send action becomes a Stop action while `streaming`. */
  readonly onStop?: () => void
  /**
   * Opaque slot rendered before the textarea (a voice recorder, a mode switch, …). Slot content
   * that needs to WRITE into the composer — append a transcript, insert a suggestion — does so
   * through the `ref` handle (`ComposerHandle`), not a callback prop here; see the file's
   * `@example`.
   */
  readonly leftSection?: ReactNode
  /** Opaque slot rendered between the textarea and the send action (an attach button, …). */
  readonly rightSection?: ReactNode
  /**
   * Pending attachments, owned by the caller. Composer only forwards them on submit and asks for a
   * reset afterwards — rendering previews is the caller's job, via `leftSection`/`rightSection`.
   */
  readonly attachments?: readonly ComposerAttachment[]
  /**
   * Called with `[]` optimistically the instant a submit goes out WITH pending attachments — a
   * submit that had none to begin with skips the call rather than reporting a no-op change — and,
   * subject to the restoration guards documented on `onSubmit`, with the original attachments
   * again if that submit later rejects.
   */
  readonly onAttachmentsChange?: (next: readonly ComposerAttachment[]) => void
  readonly onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void
  /**
   * Persists the unsent draft under `basalt:composer-draft:<key>`; switching keys swaps drafts, and
   * the entry is removed (not blanked) on a successful submit.
   *
   * "Successful" means `onSubmit` returned (or resolved) without throwing or rejecting — a send
   * that fails, synchronously or later over the network, restores this persisted draft instead of
   * leaving it erased (subject to the restoration guards documented on `onSubmit`).
   */
  readonly draftKey?: string
  /** Replaces the whole Enter/Shift+Enter hint row. Pass `null` to drop it entirely. */
  readonly hint?: ReactNode
}

/** The default footer: the Enter / Shift+Enter keyboard contract, in the mono micro-label voice. */
function DefaultHint(): JSX.Element {
  return (
    <Group gap={4}>
      <Kbd size="xs">Enter</Kbd>
      <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--basalt-font-mono)' }}>
        to send
      </Text>
      <Kbd size="xs">Shift</Kbd>
      <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--basalt-font-mono)' }}>
        +
      </Text>
      <Kbd size="xs">Enter</Kbd>
      <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--basalt-font-mono)' }}>
        for a new line
      </Text>
    </Group>
  )
}

/**
 * An autosize Textarea + send ActionIcon, with slots either side. Enter submits, Shift+Enter
 * inserts a newline, and `draftKey` survives an unmount.
 *
 * @example
 * <Composer onSubmit={({ text }) => onSend(text)} streaming={streaming} onStop={stop} />
 */
export function Composer({
  ref,
  onSubmit,
  placeholder,
  autoFocus,
  maxRows = 6,
  disabled = false,
  streaming = false,
  allowSubmitWhileStreaming = false,
  onStop,
  leftSection,
  rightSection,
  attachments,
  onAttachmentsChange,
  onPaste,
  draftKey,
  hint,
}: ComposerProps): JSX.Element {
  // Per-instance fallback for the un-keyed case, so two keyless Composers never share a draft.
  // A lazily-initialised ref rather than `useState` — this is a create-once value React never
  // needs to re-render on; the store's own subscription is what drives updates.
  const memoryStore = useRef<DraftStore | null>(null)
  memoryStore.current ??= createDraftStore(null)
  const store = draftKey === undefined ? memoryStore.current : persistedDraftStore(draftKey)
  const value = useSyncExternalStore(
    isServer ? noopSubscribe : store.subscribe,
    isServer ? emptyDraft : store.get,
    emptyDraft,
  )

  const inputDisabled = disabled || (streaming && !allowSubmitWhileStreaming)
  const showStop = streaming && onStop !== undefined
  // Stop normally REPLACES send — mid-run there is nothing to send. But `allowSubmitWhileStreaming`
  // is precisely the case where there is: the textarea stays live and Enter submits, so hiding the
  // button would leave mouse and touch users with a keyboard-only send. There the two coexist, Stop
  // first so Send keeps the rightmost primary slot.
  const showSend = !showStop || allowSubmitWhileStreaming
  const pending = attachments ?? NO_ATTACHMENTS
  const trimmed = value.trim()
  // An attachment with no caption is a legitimate send; text-only callers behave exactly as before.
  const hasPayload = trimmed.length > 0 || pending.length > 0

  // "Latest ref" mirrors of two controlled inputs, kept live every render (plain overwrites, not
  // derived — safe to do in the render body) so a submit's rejection handler — which fires long
  // after the render that started it — can read what is CURRENTLY true rather than what was true
  // when it was created. Both feed the restoration guards in `submit()` below.
  const attachmentsRef = useRef(pending)
  attachmentsRef.current = pending
  const draftKeyRef = useRef(draftKey)
  draftKeyRef.current = draftKey

  // ── Imperative handle (ComposerHandle) ────────────────────────────────────────
  //
  // The textarea is CONTROLLED — its rendered `value` comes from `useSyncExternalStore`, not from
  // the DOM — so a caret position computed the moment `store.set` runs is computed against text
  // the DOM node doesn't display yet (React hasn't re-rendered). `pendingCaretRef` defers the
  // actual `setSelectionRange` call to the layout effect below, which runs once `value` has
  // changed and the textarea's DOM content matches what the caret math assumed.
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingCaretRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current
    if (caret === null) return
    pendingCaretRef.current = null
    textareaRef.current?.setSelectionRange(caret, caret)
  }, [value])

  // Both writers below arm `pendingCaretRef` ONLY when the write actually changes the value away
  // from `value` — the exact string this render's `useSyncExternalStore` returned, i.e. what the
  // layout effect's `[value]` dependency will be diffed against. That is the only fact that
  // predicts whether the effect will run at all: a write that lands back on `value` (a genuine
  // no-op, OR a sequence of writes within the same tick that cancels back to it) will never
  // trigger a re-render, so the effect never fires to null the ref out — arming it there leaves a
  // caret position that a LATER, unrelated change (e.g. plain typing through `onChange`, which
  // never touches this ref itself) would then wrongly consume. Comparing against `store.get()`
  // (the live cache, already mutated by any earlier write in this same tick) is NOT equivalent and
  // was tried and rejected: two writes in one tick that net back to `value` would each look like a
  // "real change" relative to the other's intermediate cache, so the ref would still end up armed
  // even though the final, rendered value never moved. Comparing to `value` also means every call
  // unconditionally OVERWRITES `pendingCaretRef.current` (to a position, or explicitly to `null`),
  // so no call can ever leave a PRIOR call's stale arm behind — there is no code path that arms
  // without also being the one to decide the final state.
  const insertText = (text: string): void => {
    const current = store.get()
    const selection = textareaRef.current === null ? null : liveSelection(textareaRef.current)
    const start = selection?.start ?? current.length
    const end = selection?.end ?? current.length
    const next = current.slice(0, start) + text + current.slice(end)
    store.set(next)
    pendingCaretRef.current = next === value ? null : start + text.length
  }

  const setValue = (next: string): void => {
    store.set(next)
    pendingCaretRef.current = next === value ? null : next.length
  }

  const focusTextarea = (): void => {
    textareaRef.current?.focus()
  }

  useImperativeHandle(ref, () => ({ insertText, setValue, focus: focusTextarea }))

  const submit = (): void => {
    if (inputDisabled || !hasPayload) return
    const submittedText = trimmed
    const submittedAttachments = pending
    const submittedDraftKey = draftKey
    // Claims THIS send as the newest through this draft store before anything else can — see
    // `bumpSubmissionId`'s doc for why the counter lives on the store rather than the component.
    const mySubmissionId = store.bumpSubmissionId()
    // The clear is deliberately AFTER the call — a parent that throws to reject the send
    // SYNCHRONOUSLY keeps both the draft and the attachments, because the throw unwinds before
    // either line below runs.
    const result = onSubmit({ text: submittedText, attachments: submittedAttachments })
    store.set('')
    if (submittedAttachments.length > 0) onAttachmentsChange?.([])
    // `result` is typed `void | Promise<void>`, but TypeScript satisfies `Promise<void>` with ANY
    // structurally-matching thenable — an `instanceof Promise` check is nominal and misses a
    // thenable from another realm (an iframe, a worker bridge) or a userland promise
    // implementation, silently dropping the restore-on-reject guarantee for exactly the value the
    // type permits. `Promise.resolve(result)` adopts anything PromiseLike, and a plain `void`
    // return passes through as an already-resolved promise whose `.catch` below simply never
    // fires — so this narrows STRUCTURALLY (a callable `then`) rather than by prototype identity.
    // Optimistic clear, pessimistic restore: the box already reads empty by the time this promise
    // can settle (see the class doc for why this isn't await-then-clear). A REJECTION puts back
    // what was cleared, gated so it can never clobber something newer:
    //   - TEXT restores only if no LATER submit has gone through this same store (`mySubmissionId`
    //     is still the newest one it has issued) AND the draft is still exactly the '' this submit
    //     left it in — a second submit's own clear, or fresh typing, each leave one of those false.
    //   - ATTACHMENTS restore only if they are still empty (nothing has since replaced them) AND
    //     `draftKey` has not changed since (a thread switch repoints `onAttachmentsChange` at a
    //     different destination; restoring into it would leak this attachment into that thread).
    // An unmount does not need its own guard: the persisted store this closure captured is keyed
    // by `draftKey` and outlives the component, so restoring into it is exactly what makes the
    // draft reappear if the user comes back — and `onAttachmentsChange` calling into an unmounted
    // Composer's still-mounted parent is an ordinary prop-callback call, not a React state update
    // on a dead component.
    void Promise.resolve(result).catch((): void => {
      if (store.currentSubmissionId() === mySubmissionId && store.get() === '') {
        store.set(submittedText)
      }
      // `draftKeyRef.current === submittedDraftKey` is `undefined === undefined` — always true —
      // for a Composer used WITHOUT `draftKey`, so this guard is inert precisely there. That is
      // intentional, not a gap: `draftKey` is the ONLY identity a Composer has for "which
      // destination am I currently pointed at" (see its own prop doc — switching keys is how a
      // caller repoints one mounted instance at a different thread). A keyless Composer therefore
      // has no notion of a destination switch to guard against in the first place; the API's
      // contract is that reusing one mounted instance across multiple destinations requires either
      // a `draftKey` (this guard) or a React `key` prop (a remount, which drops this closure
      // entirely). A caller that swaps `onAttachmentsChange` to point at a new destination on a
      // keyless, unkeyed instance is violating that contract already — no guard here can rescue it
      // without also breaking the legitimate same-destination restore (function identity is not a
      // safe substitute: an inline `(next) => ...` prop is a fresh reference every render even when
      // the destination hasn't changed).
      if (
        submittedAttachments.length > 0 &&
        attachmentsRef.current.length === 0 &&
        draftKeyRef.current === submittedDraftKey
      ) {
        onAttachmentsChange?.(submittedAttachments)
      }
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey) return
    // IME guard: mid-composition (CJK, and some mobile keyboards) Enter COMMITS the candidate — it
    // is not a send. `nativeEvent.isComposing` is the reliable signal; keyCode 229 is the legacy one.
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  const textareaProps: ComponentProps<typeof Textarea> = {
    flex: 1,
    autosize: true,
    minRows: 1,
    maxRows,
    value,
    disabled: inputDisabled,
    onChange: (event) => store.set(event.currentTarget.value),
    onKeyDown: handleKeyDown,
    // Composer input surface (docs/DESIGN-SPEC.md §5): panel + control radius (6px, VX.radiusCtrl);
    // the ring lives in the shadow, so the input carries no separate border. Depth is deliberately
    // NOT set here — it arrives from the themed `.input` class (theme/controls.module.css), which
    // also grounds it when disabled. A `boxShadow` in this `styles` object renders as an INLINE
    // style and would beat that class unconditionally, leaving a disabled composer raised.
    styles: {
      input: {
        backgroundColor: 'var(--vx-surface-panel)',
        borderRadius: VX.radiusCtrl,
        border: 'none',
      },
    },
  }
  if (placeholder !== undefined) textareaProps.placeholder = placeholder
  if (autoFocus !== undefined) textareaProps.autoFocus = autoFocus
  if (onPaste !== undefined) textareaProps.onPaste = onPaste

  return (
    <Stack gap={6}>
      <Group gap="xs" align="flex-end" wrap="nowrap">
        {leftSection}
        <Textarea {...textareaProps} ref={textareaRef} />
        {rightSection}
        {showStop ? (
          <ActionIcon
            size={42}
            radius="md"
            variant="filled"
            color="red"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <StopGlyph />
          </ActionIcon>
        ) : null}
        {showSend ? (
          <ActionIcon
            size={42}
            radius="md"
            variant="filled"
            onClick={submit}
            disabled={inputDisabled || !hasPayload}
            aria-label="Send message"
            // Send action (docs/DESIGN-SPEC.md §5): the one accent-filled control. It needs no color
            // override — `filled` resolves through the theme to `--vx-accent-fill` / `--vx-on-accent`.
            // (It used to hand-wire those two vars inline, which is why this was the ONLY filled
            // control that stayed legible while the rest of the chrome went through Mantine's
            // scheme-blind autoContrast. The theme owns it now, and hover works again — an inline
            // style can't express a `:hover` state.)
          >
            <SendGlyph />
          </ActionIcon>
        ) : null}
      </Group>
      {hint === undefined ? <DefaultHint /> : hint}
    </Stack>
  )
}
