/**
 * Composer — the slot-bearing prop set from AGENT-CHAT-SPEC.md §8: the `{ text, attachments }`
 * submit payload, the clear-only-on-success draft contract, the keyboard contract (including the
 * IME guard), the streaming/stop gate, and `draftKey` persistence across an unmount.
 *
 * `draftKey`s are UNIQUE PER TEST on purpose. Composer memoizes one store per key outside React
 * and that store's in-memory value — not localStorage — is the snapshot authority, so clearing
 * localStorage between tests would NOT reset a store that a previous test already hydrated.
 */
import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Composer } from './composer'
import type { ComposerAttachment, ComposerHandle, ComposerProps, ComposerSubmit } from './composer'

afterEach(cleanup)

function renderComposer(props: ComposerProps) {
  return render(
    <MantineProvider>
      <Composer {...props} />
    </MantineProvider>,
  )
}

const noop = (): void => {}

function input(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

function type(text: string): void {
  fireEvent.change(input(), { target: { value: text } })
}

/**
 * Several tests below capture a callback's argument into a `let ... | null` variable, then read
 * it back after a `fireEvent`/`act` call that (opaquely, from TS's point of view) triggers the
 * callback synchronously. TS's control-flow analysis can't see through that call boundary, so at
 * the read site it narrows the variable back to its `null` initializer instead of the declared
 * union — `expect()`'s generic then infers `null` and the `[]`/`[ATTACHMENT]` expectation fails
 * to match any overload. Reading through a NON-generic, explicitly-typed function sidesteps the
 * over-narrowing: the return type comes from the fixed signature, not re-inferred from the
 * (already over-narrowed) argument, the way a generic passthrough would.
 */
function widen(value: readonly ComposerAttachment[] | null): readonly ComposerAttachment[] | null {
  return value
}

const ATTACHMENT: ComposerAttachment = {
  id: 'a1',
  name: 'shot.png',
  mediaType: 'image/png',
  size: 1024,
  url: 'blob:shot',
}

/**
 * Builds a genuine native `Promise` whose prototype chain has been repointed away from THIS
 * realm's `Promise.prototype` — the same shape a promise crossing an iframe/worker boundary would
 * have. `Object.getOwnPropertyDescriptors(Promise.prototype)` copies `then`, `catch`, `finally`,
 * `constructor` and `[Symbol.toStringTag]` onto a fresh object used as the new prototype, so every
 * method is the ORIGINAL native implementation (nothing reimplemented) and the value still
 * satisfies `Promise<T>` structurally with no cast. Only the prototype IDENTITY changes, which is
 * exactly what `instanceof Promise` tests — so it reads `false` for this value while `.then`/
 * `.catch` keep working, because those built-ins check the promise's internal slot, not its
 * exposed prototype. Descriptors are copied via `Object.getOwnPropertyDescriptors` rather than an
 * object-literal `{ then: ... }` so no literal `then` key appears in this file's source — that
 * keeps `unicorn/no-thenable` (which flags authoring a `then` property on a plain object) from
 * firing on what is actually a reflected copy of a real `Promise.prototype`, not a hand-rolled
 * thenable.
 */
function crossRealmPromise<T>(executor: ConstructorParameters<typeof Promise<T>>[0]): Promise<T> {
  const native = new Promise<T>(executor)
  const otherRealmProto: object = Object.create(
    Object.prototype,
    Object.getOwnPropertyDescriptors(Promise.prototype),
  )
  Object.setPrototypeOf(native, otherRealmProto)
  return native
}

describe('submit payload + draft lifecycle', () => {
  test('submits the trimmed text with an empty attachment list and clears the draft', () => {
    const calls: ComposerSubmit[] = []
    renderComposer({
      onSubmit: (payload) => {
        calls.push(payload)
      },
    })

    type('  hello  ')
    fireEvent.click(screen.getByLabelText('Send message'))

    expect(calls).toEqual([{ text: 'hello', attachments: [] }])
    expect(input().value).toBe('')
  })

  test('forwards pending attachments and asks for a reset — an empty caption still sends', () => {
    const calls: ComposerSubmit[] = []
    let reset: readonly ComposerAttachment[] | null = null
    renderComposer({
      onSubmit: (payload) => {
        calls.push(payload)
      },
      attachments: [ATTACHMENT],
      onAttachmentsChange: (next) => {
        reset = next
      },
    })

    fireEvent.click(screen.getByLabelText('Send message'))

    expect(calls).toEqual([{ text: '', attachments: [ATTACHMENT] }])
    expect(widen(reset)).toEqual([])
  })

  test('an empty draft with no attachments cannot be submitted', () => {
    let submits = 0
    renderComposer({
      onSubmit: () => {
        submits += 1
      },
    })

    expect((screen.getByLabelText('Send message') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(input(), { key: 'Enter' })

    expect(submits).toBe(0)
  })

  /**
   * The "a failed send does not eat what was typed" guarantee, stated precisely: the clear is
   * sequenced STRICTLY AFTER `onSubmit` returns and is not in a `finally`, so a parent that throws
   * to reject the send never reaches it.
   *
   * The throw itself is deliberately NOT exercised here. React 19 does not let an error thrown in
   * an event handler propagate out of `dispatchEvent` — it hands it to the global `reportError`,
   * captured by `react.development.js` at MODULE EVALUATION (react.development.js:714), so it can
   * be neither caught at the `fireEvent` call nor intercepted by stubbing `reportError` afterwards,
   * and `bun test` fails the file. What IS observable — and is what actually delivers the
   * guarantee — is the ordering.
   *
   * That ordering must be probed through STATE, not the DOM. `input().value` is worthless here:
   * the value comes from `useSyncExternalStore`, and React batches the resulting re-render to the
   * end of the discrete click event, so the textarea still reads 'keep me' inside the callback
   * whether `store.set('')` ran before `onSubmit` or after it — an assertion that cannot fail.
   * The store's localStorage write IS synchronous, so with a `draftKey` the persisted entry flips
   * the instant the ordering is wrong.
   */
  test('the persisted draft is intact while onSubmit runs, and clears only once it returns', () => {
    const storageKey = 'basalt:composer-draft:clear-after-onsubmit'
    let persistedDuringSubmit: string | null = 'not observed'
    renderComposer({
      onSubmit: () => {
        persistedDuringSubmit = window.localStorage.getItem(storageKey)
      },
      draftKey: 'clear-after-onsubmit',
    })

    type('keep me')
    fireEvent.click(screen.getByLabelText('Send message'))

    expect(persistedDuringSubmit).toBe(JSON.stringify({ v: 1, value: 'keep me' }))
    expect(window.localStorage.getItem(storageKey)).toBeNull()
    expect(input().value).toBe('')
  })
})

describe('async onSubmit — optimistic clear, rejection restores', () => {
  /**
   * A plain `void`-returning handler — the pre-existing contract — must keep working unchanged.
   * This is the backward-compatibility guard for widening `onSubmit` to `void | Promise<void>`.
   */
  test('a void-returning onSubmit still clears the draft as before', () => {
    const calls: ComposerSubmit[] = []
    renderComposer({
      onSubmit: (payload) => {
        calls.push(payload)
      },
    })

    type('plain handler')
    fireEvent.click(screen.getByLabelText('Send message'))

    expect(calls).toEqual([{ text: 'plain handler', attachments: [] }])
    expect(input().value).toBe('')
  })

  test('a resolving async onSubmit leaves the draft and attachments cleared', async () => {
    const storageKey = 'basalt:composer-draft:resolves'
    let resolveSubmit: (() => void) | null = null
    let reset: readonly ComposerAttachment[] | null = null
    renderComposer({
      onSubmit: () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve
        }),
      attachments: [ATTACHMENT],
      onAttachmentsChange: (next) => {
        reset = next
      },
      draftKey: 'resolves',
    })

    type('will succeed')
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(window.localStorage.getItem(storageKey)).toBeNull()
    expect(widen(reset)).toEqual([])

    if (resolveSubmit === null) throw new Error('expected onSubmit to have been called')
    await act(async () => {
      resolveSubmit?.()
      await Promise.resolve()
    })

    expect(window.localStorage.getItem(storageKey)).toBeNull()
    expect(input().value).toBe('')
  })

  test('a synchronous throw still keeps the draft and attachments (unchanged pre-async behaviour)', () => {
    const storageKey = 'basalt:composer-draft:sync-throw'
    let reset: readonly ComposerAttachment[] | null = null
    renderComposer({
      onSubmit: () => {
        throw new Error('reject synchronously')
      },
      attachments: [ATTACHMENT],
      onAttachmentsChange: (next) => {
        reset = next
      },
      draftKey: 'sync-throw',
    })

    type('keep me on throw')
    expect(() => fireEvent.click(screen.getByLabelText('Send message'))).toThrow()

    expect(window.localStorage.getItem(storageKey)).toBe(
      JSON.stringify({ v: 1, value: 'keep me on throw' }),
    )
    expect(reset).toBeNull()
  })

  test('a rejecting async onSubmit restores the text and the attachments', async () => {
    const storageKey = 'basalt:composer-draft:rejects'
    let rejectSubmit: ((reason: unknown) => void) | null = null
    let lastAttachmentsChange: readonly ComposerAttachment[] | null = null
    const { rerender } = renderComposer({
      onSubmit: () =>
        new Promise<void>((_resolve, reject) => {
          rejectSubmit = reject
        }),
      attachments: [ATTACHMENT],
      onAttachmentsChange: (next) => {
        lastAttachmentsChange = next
      },
      draftKey: 'rejects',
    })

    type('network will fail')
    fireEvent.click(screen.getByLabelText('Send message'))
    // Optimistic clear already happened.
    expect(window.localStorage.getItem(storageKey)).toBeNull()
    expect(widen(lastAttachmentsChange)).toEqual([])

    // The caller applies the optimistic clear it was asked for — a controlled `attachments` prop
    // round-trips back through a render, exactly like a real `useState` setter would.
    rerender(
      <MantineProvider>
        <Composer
          onSubmit={noop}
          attachments={[]}
          onAttachmentsChange={(next) => {
            lastAttachmentsChange = next
          }}
          draftKey="rejects"
        />
      </MantineProvider>,
    )

    if (rejectSubmit === null) throw new Error('expected onSubmit to have been called')
    await act(async () => {
      rejectSubmit?.(new Error('network error'))
      await Promise.resolve()
    })

    expect(window.localStorage.getItem(storageKey)).toBe(
      JSON.stringify({ v: 1, value: 'network will fail' }),
    )
    expect(widen(lastAttachmentsChange)).toEqual([ATTACHMENT])
  })

  /**
   * Finding 1 regression: `onSubmit` is typed `void | Promise<void>`, and a bare structural
   * thenable does NOT actually satisfy that type (`PromiseLike<void>` is missing `catch`/
   * `finally`/`[Symbol.toStringTag]`, which `Promise<void>` requires — TS2322). What DOES satisfy
   * it, and DOES still defeat `result instanceof Promise`, is a promise from ANOTHER REALM: a
   * genuine native promise whose `instanceof` reads false because `instanceof` compares prototype
   * IDENTITY against THIS realm's `Promise`, not structural shape. `crossRealmPromise` builds
   * exactly that. Its rejection must still restore the text and the attachments, exactly like a
   * same-realm native `Promise` rejecting does above.
   */
  test('a cross-realm promise rejecting still restores the text and the attachments', async () => {
    const storageKey = 'basalt:composer-draft:cross-realm-rejects'
    let rejectSubmit: ((reason: unknown) => void) | null = null
    const crossRealm = crossRealmPromise<void>((_resolve, reject) => {
      rejectSubmit = reject
    })
    // The whole point of the fixture: prove it is genuinely NOT of this realm's `Promise` before
    // relying on anything else about it — otherwise this test would silently degrade into a re-run
    // of the native-promise case above and prove nothing about the regression it targets.
    expect(crossRealm instanceof Promise).toBe(false)

    let lastAttachmentsChange: readonly ComposerAttachment[] | null = null
    const { rerender } = renderComposer({
      onSubmit: () => crossRealm,
      attachments: [ATTACHMENT],
      onAttachmentsChange: (next) => {
        lastAttachmentsChange = next
      },
      draftKey: 'cross-realm-rejects',
    })

    type('a cross-realm send')
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(window.localStorage.getItem(storageKey)).toBeNull()
    expect(widen(lastAttachmentsChange)).toEqual([])

    // Same controlled-prop round trip as the native-Promise version of this test above.
    rerender(
      <MantineProvider>
        <Composer
          onSubmit={noop}
          attachments={[]}
          onAttachmentsChange={(next) => {
            lastAttachmentsChange = next
          }}
          draftKey="cross-realm-rejects"
        />
      </MantineProvider>,
    )

    if (rejectSubmit === null) throw new Error('expected onSubmit to have been called')
    await act(async () => {
      rejectSubmit?.(new Error('cross-realm rejection'))
      await Promise.resolve()
    })

    expect(window.localStorage.getItem(storageKey)).toBe(
      JSON.stringify({ v: 1, value: 'a cross-realm send' }),
    )
    expect(widen(lastAttachmentsChange)).toEqual([ATTACHMENT])
  })

  test('does not restore text the user already replaced by the time the rejection arrives', async () => {
    const storageKey = 'basalt:composer-draft:typed-over'
    let rejectSubmit: ((reason: unknown) => void) | null = null
    renderComposer({
      onSubmit: () =>
        new Promise<void>((_resolve, reject) => {
          rejectSubmit = reject
        }),
      draftKey: 'typed-over',
    })

    type('the failed message')
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(window.localStorage.getItem(storageKey)).toBeNull()

    // The user starts a fresh, unrelated message before the rejection lands.
    type('a brand new thought')

    if (rejectSubmit === null) throw new Error('expected onSubmit to have been called')
    await act(async () => {
      rejectSubmit?.(new Error('network error'))
      await Promise.resolve()
    })

    expect(window.localStorage.getItem(storageKey)).toBe(
      JSON.stringify({ v: 1, value: 'a brand new thought' }),
    )
  })

  test('a first submit rejecting after a second succeeded does not clobber the cleared draft', async () => {
    const storageKey = 'basalt:composer-draft:superseded'
    const rejections: Array<(reason: unknown) => void> = []
    let call = 0
    renderComposer({
      onSubmit: () =>
        new Promise<void>((resolve, reject) => {
          call += 1
          if (call === 1) rejections.push(reject)
          else resolve()
        }),
      draftKey: 'superseded',
    })

    type('first message')
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(window.localStorage.getItem(storageKey)).toBeNull()

    type('second message')
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(window.localStorage.getItem(storageKey)).toBeNull()

    const rejectFirst = rejections[0]
    if (rejectFirst === undefined) throw new Error('expected the first submit to have rejected')
    await act(async () => {
      rejectFirst(new Error('first send failed after the second already went through'))
      await Promise.resolve()
    })

    // The second submit's own (successful) clear must win — the first message does not reappear.
    expect(window.localStorage.getItem(storageKey)).toBeNull()
    expect(input().value).toBe('')
  })

  test('does not restore attachments the caller already changed via the controlled prop', async () => {
    let rejectSubmit: ((reason: unknown) => void) | null = null
    let lastAttachmentsChange: readonly ComposerAttachment[] | null = null
    const { rerender } = renderComposer({
      onSubmit: () =>
        new Promise<void>((_resolve, reject) => {
          rejectSubmit = reject
        }),
      attachments: [ATTACHMENT],
      onAttachmentsChange: (next) => {
        lastAttachmentsChange = next
      },
    })

    fireEvent.click(screen.getByLabelText('Send message'))
    expect(widen(lastAttachmentsChange)).toEqual([])

    // The caller applies the optimistic clear, then independently attaches something new —
    // NOT via a second Composer submit, just its own unrelated state change.
    const replacement: ComposerAttachment = { ...ATTACHMENT, id: 'a2', name: 'other.png' }
    rerender(
      <MantineProvider>
        <Composer
          onSubmit={noop}
          attachments={[replacement]}
          onAttachmentsChange={(next) => {
            lastAttachmentsChange = next
          }}
        />
      </MantineProvider>,
    )

    if (rejectSubmit === null) throw new Error('expected onSubmit to have been called')
    await act(async () => {
      rejectSubmit?.(new Error('network error'))
      await Promise.resolve()
    })

    // The replacement attachment must survive — the failed send's original attachment is dropped.
    expect(widen(lastAttachmentsChange)).toEqual([])
  })

  test('does not restore attachments into a different thread after draftKey changed', async () => {
    let rejectSubmit: ((reason: unknown) => void) | null = null
    let lastAttachmentsChange: readonly ComposerAttachment[] | null = null
    const { rerender } = renderComposer({
      onSubmit: () =>
        new Promise<void>((_resolve, reject) => {
          rejectSubmit = reject
        }),
      attachments: [ATTACHMENT],
      onAttachmentsChange: (next) => {
        lastAttachmentsChange = next
      },
      draftKey: 'thread-a',
    })

    fireEvent.click(screen.getByLabelText('Send message'))
    expect(widen(lastAttachmentsChange)).toEqual([])

    // The consumer switches this same Composer instance to a different thread before the
    // rejection arrives — a fresh, still-empty attachments slot for that other thread.
    rerender(
      <MantineProvider>
        <Composer
          onSubmit={noop}
          attachments={[]}
          onAttachmentsChange={(next) => {
            lastAttachmentsChange = next
          }}
          draftKey="thread-b"
        />
      </MantineProvider>,
    )

    if (rejectSubmit === null) throw new Error('expected onSubmit to have been called')
    await act(async () => {
      rejectSubmit?.(new Error('network error'))
      await Promise.resolve()
    })

    // Thread B's attachments slot must stay untouched by thread A's failed send.
    expect(widen(lastAttachmentsChange)).toEqual([])
  })
})

describe('keyboard contract', () => {
  test('Enter submits', () => {
    let submits = 0
    renderComposer({
      onSubmit: () => {
        submits += 1
      },
    })

    type('go')
    fireEvent.keyDown(input(), { key: 'Enter' })

    expect(submits).toBe(1)
    expect(input().value).toBe('')
  })

  test('Shift+Enter does not submit', () => {
    let submits = 0
    renderComposer({
      onSubmit: () => {
        submits += 1
      },
    })

    type('go')
    fireEvent.keyDown(input(), { key: 'Enter', shiftKey: true })

    expect(submits).toBe(0)
    expect(input().value).toBe('go')
  })

  test('Enter mid-IME-composition does not submit — it commits the candidate', () => {
    let submits = 0
    renderComposer({
      onSubmit: () => {
        submits += 1
      },
    })

    type('にほん')
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true })

    expect(submits).toBe(0)
    expect(input().value).toBe('にほん')
  })
})

describe('streaming gate', () => {
  test('streaming without onStop disables the input and keeps the send action', () => {
    renderComposer({ onSubmit: noop, streaming: true })

    expect(input().disabled).toBe(true)
    expect(screen.getByLabelText('Send message')).toBeDefined()
    expect(screen.queryByLabelText('Stop generating')).toBeNull()
  })

  test('streaming with onStop swaps send for a Stop action', () => {
    let stops = 0
    renderComposer({
      onSubmit: noop,
      streaming: true,
      onStop: () => {
        stops += 1
      },
    })

    expect(screen.queryByLabelText('Send message')).toBeNull()
    fireEvent.click(screen.getByLabelText('Stop generating'))

    expect(stops).toBe(1)
  })

  /**
   * The combination `allowSubmitWhileStreaming` exists for: the textarea stays live mid-run, so a
   * mouse or touch user needs a Send button as much as a keyboard user needs Enter. Stop replacing
   * Send here would make the send action keyboard-only.
   */
  test('allowSubmitWhileStreaming with onStop renders BOTH the stop and the send action', () => {
    const calls: ComposerSubmit[] = []
    let stops = 0
    renderComposer({
      onSubmit: (payload) => {
        calls.push(payload)
      },
      streaming: true,
      allowSubmitWhileStreaming: true,
      onStop: () => {
        stops += 1
      },
    })

    type('interrupt')
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(calls).toEqual([{ text: 'interrupt', attachments: [] }])

    fireEvent.click(screen.getByLabelText('Stop generating'))
    expect(stops).toBe(1)
  })

  test('allowSubmitWhileStreaming permits a submit mid-run', () => {
    const calls: ComposerSubmit[] = []
    renderComposer({
      onSubmit: (payload) => {
        calls.push(payload)
      },
      streaming: true,
      allowSubmitWhileStreaming: true,
    })

    expect(input().disabled).toBe(false)
    type('interrupt')
    fireEvent.keyDown(input(), { key: 'Enter' })

    expect(calls).toEqual([{ text: 'interrupt', attachments: [] }])
  })
})

describe('draftKey', () => {
  test('a draft survives an unmount and lands in the basalt: envelope', () => {
    const { unmount } = renderComposer({ onSubmit: noop, draftKey: 'survives-unmount' })
    type('half a thought')
    unmount()

    expect(window.localStorage.getItem('basalt:composer-draft:survives-unmount')).toBe(
      JSON.stringify({ v: 1, value: 'half a thought' }),
    )

    renderComposer({ onSubmit: noop, draftKey: 'survives-unmount' })
    expect(input().value).toBe('half a thought')
  })

  /**
   * The REAL page-reload path, and the only test that exercises it. 'a draft survives an unmount'
   * above proves much less than it looks: the store lives in a module-scope Map that outlives
   * `cleanup()`, so the remount reuses the same already-hydrated object and never touches storage.
   * Here the key has no store yet, so the first `get()` has to go through `readPersistedValue` —
   * which is what a fresh process does after a reload. A wrong prefix on the read side survives
   * every other test in this file and fails only this one.
   */
  test('hydrates a draft a previous session left in storage', () => {
    window.localStorage.setItem(
      'basalt:composer-draft:hydrated-from-storage',
      JSON.stringify({ v: 1, value: 'from a previous session' }),
    )

    renderComposer({ onSubmit: noop, draftKey: 'hydrated-from-storage' })

    expect(input().value).toBe('from a previous session')
  })

  test('a stale-version envelope is ignored rather than hydrated', () => {
    window.localStorage.setItem(
      'basalt:composer-draft:stale-envelope',
      JSON.stringify({ v: 0, value: 'written by an older shape' }),
    )

    renderComposer({ onSubmit: noop, draftKey: 'stale-envelope' })

    expect(input().value).toBe('')
  })

  test("switching draftKey swaps to that key's draft and does not leak the old one", () => {
    const { rerender } = renderComposer({ onSubmit: noop, draftKey: 'swap-a' })
    type('alpha')

    rerender(
      <MantineProvider>
        <Composer onSubmit={noop} draftKey="swap-b" />
      </MantineProvider>,
    )
    expect(input().value).toBe('')
    type('beta')

    rerender(
      <MantineProvider>
        <Composer onSubmit={noop} draftKey="swap-a" />
      </MantineProvider>,
    )
    expect(input().value).toBe('alpha')
  })

  test('a successful submit removes the persisted entry rather than leaving an empty husk', () => {
    renderComposer({ onSubmit: noop, draftKey: 'cleared-on-send' })
    type('sent')
    fireEvent.click(screen.getByLabelText('Send message'))

    expect(window.localStorage.getItem('basalt:composer-draft:cleared-on-send')).toBeNull()
  })

  test('two keyless Composers do not share a draft', () => {
    render(
      <MantineProvider>
        <Composer onSubmit={noop} placeholder="first" />
        <Composer onSubmit={noop} placeholder="second" />
      </MantineProvider>,
    )

    const boxes = screen.getAllByRole('textbox') as HTMLTextAreaElement[]
    const [first, second] = [boxes[0], boxes[1]]
    if (first === undefined || second === undefined) throw new Error('expected two composers')
    fireEvent.change(first, { target: { value: 'only mine' } })

    expect(first.value).toBe('only mine')
    expect(second.value).toBe('')
  })
})

describe('slots', () => {
  test('leftSection and rightSection render inside the input row', () => {
    renderComposer({
      onSubmit: noop,
      leftSection: <div data-testid="left" />,
      rightSection: <div data-testid="right" />,
    })

    expect(screen.getByTestId('left')).toBeDefined()
    expect(screen.getByTestId('right')).toBeDefined()
  })

  test('the default hint row is the Enter/Shift+Enter contract', () => {
    renderComposer({ onSubmit: noop })

    expect(screen.getByText('to send')).toBeDefined()
  })

  test('hint replaces the whole default row', () => {
    renderComposer({ onSubmit: noop, hint: <div data-testid="hint" /> })

    expect(screen.getByTestId('hint')).toBeDefined()
    expect(screen.queryByText('to send')).toBeNull()
  })

  test('hint={null} drops the row entirely', () => {
    renderComposer({ onSubmit: noop, hint: null })

    expect(screen.queryByText('to send')).toBeNull()
  })
})

describe('ComposerHandle (ref)', () => {
  test('insertText appends at the end when the textarea has never been focused', () => {
    const handle = createRef<ComposerHandle>()
    renderComposer({ onSubmit: noop, ref: handle })

    type('partial')
    act(() => {
      handle.current?.insertText(' more')
    })

    expect(input().value).toBe('partial more')
  })

  test('insertText inserts at the cursor position, not blindly at the end', () => {
    const handle = createRef<ComposerHandle>()
    renderComposer({ onSubmit: noop, ref: handle })

    type('hello world')
    const el = input()
    el.focus()
    el.setSelectionRange(5, 5) // caret right after "hello"
    act(() => {
      handle.current?.insertText(' there')
    })

    expect(el.value).toBe('hello there world')
  })

  test('insertText replaces a selection rather than inserting alongside it', () => {
    const handle = createRef<ComposerHandle>()
    renderComposer({ onSubmit: noop, ref: handle })

    type('hello brave world')
    const el = input()
    el.focus()
    el.setSelectionRange(6, 11) // "brave"
    act(() => {
      handle.current?.insertText('bold')
    })

    expect(el.value).toBe('hello bold world')
  })

  test('setValue replaces the whole draft value', () => {
    const handle = createRef<ComposerHandle>()
    renderComposer({ onSubmit: noop, ref: handle })

    type('old text')
    act(() => {
      handle.current?.setValue('brand new')
    })

    expect(input().value).toBe('brand new')
  })

  test('focus moves focus to the textarea', () => {
    const handle = createRef<ComposerHandle>()
    renderComposer({ onSubmit: noop, ref: handle })

    act(() => {
      handle.current?.focus()
    })

    expect(document.activeElement).toBe(input())
  })

  test('an inserted value persists under draftKey and survives remount', () => {
    const handle = createRef<ComposerHandle>()
    const { unmount } = renderComposer({ onSubmit: noop, draftKey: 'ref-persists', ref: handle })

    act(() => {
      handle.current?.insertText('via ref')
    })
    unmount()

    expect(window.localStorage.getItem('basalt:composer-draft:ref-persists')).toBe(
      JSON.stringify({ v: 1, value: 'via ref' }),
    )

    renderComposer({ onSubmit: noop, draftKey: 'ref-persists' })
    expect(input().value).toBe('via ref')
  })

  test('insertText works with no draftKey (the per-instance memory store)', () => {
    const handle = createRef<ComposerHandle>()
    renderComposer({ onSubmit: noop, ref: handle })

    act(() => {
      handle.current?.insertText('memory only')
    })

    expect(input().value).toBe('memory only')
  })

  test('a submit after an imperative insertText carries the inserted text in its payload', () => {
    const calls: ComposerSubmit[] = []
    const handle = createRef<ComposerHandle>()
    renderComposer({
      onSubmit: (payload) => {
        calls.push(payload)
      },
      ref: handle,
    })

    act(() => {
      handle.current?.insertText('from voice')
    })
    fireEvent.click(screen.getByLabelText('Send message'))

    expect(calls).toEqual([{ text: 'from voice', attachments: [] }])
  })

  /**
   * Regression for the stale `pendingCaretRef` bug: `insertText`/`setValue` used to arm the ref
   * UNCONDITIONALLY, even when the write was a no-op (didn't change the store's value). Because the
   * caret-consuming layout effect is keyed on `[value]`, a no-op write never triggers it — the ref
   * stayed armed. The NEXT edit that actually changes the value (ordinary typing through
   * `onChange`, which never touches this ref itself) then had that stale, unrelated position
   * forced onto it instead of wherever the real edit naturally landed.
   *
   * Both tests below prove the fix by comparison, not by hard-coding a "natural" DOM/React
   * selection-restoration value (which this harness cannot predict independently of the bug):
   * the SAME real edit is run once with the no-op priming it and once without, and the resulting
   * caret must be identical in both — a no-op write must be invisible to what follows.
   */
  describe('a no-op write does not arm a stale caret for the next real edit', () => {
    test('insertText("") at a collapsed caret', () => {
      const primed = createRef<ComposerHandle>()
      renderComposer({ onSubmit: noop, ref: primed })
      type('hellox')
      const primedEl = input()
      primedEl.focus()
      primedEl.setSelectionRange(5, 5)
      act(() => {
        primed.current?.insertText('') // no-op: content unchanged
      })
      fireEvent.change(primedEl, { target: { value: 'hellofoox' } })
      const primedCaret = primedEl.selectionStart

      cleanup()

      const control = createRef<ComposerHandle>()
      renderComposer({ onSubmit: noop, ref: control })
      type('hellox')
      const controlEl = input()
      controlEl.focus()
      controlEl.setSelectionRange(5, 5)
      // No insertText('') here — this is the same real edit, unprimed.
      fireEvent.change(controlEl, { target: { value: 'hellofoox' } })
      const controlCaret = controlEl.selectionStart

      expect(primedCaret).toBe(controlCaret)
    })

    test('setValue with the value it already has', () => {
      const primed = createRef<ComposerHandle>()
      renderComposer({ onSubmit: noop, ref: primed })
      type('abcdef')
      const primedEl = input()
      primedEl.focus()
      act(() => {
        primed.current?.setValue('abcdef') // no-op: already this value
      })
      fireEvent.change(primedEl, { target: { value: 'abXcdef' } })
      const primedCaret = primedEl.selectionStart

      cleanup()

      const control = createRef<ComposerHandle>()
      renderComposer({ onSubmit: noop, ref: control })
      type('abcdef')
      const controlEl = input()
      controlEl.focus()
      // No setValue('abcdef') here — this is the same real edit, unprimed.
      fireEvent.change(controlEl, { target: { value: 'abXcdef' } })
      const controlCaret = controlEl.selectionStart

      expect(primedCaret).toBe(controlCaret)
    })
  })
})

describe('common props (`common/props.ts`)', () => {
  test('className reaches the root; classNames.input/actions reach their slots', () => {
    const { container } = renderComposer({
      onSubmit: noop,
      className: 'my-composer',
      classNames: { input: 'my-input', actions: 'my-actions' },
    })
    expect(container.querySelector('.my-composer')).not.toBeNull()
    expect(container.querySelector('.my-input')).not.toBeNull()
    expect(container.querySelector('.my-actions')).not.toBeNull()
  })
})
