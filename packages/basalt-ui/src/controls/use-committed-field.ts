/**
 * `useCommittedField`: the draft of a text or number control that writes to a store. The draft is
 * local, so typing never navigates; the store sees one write per pause.
 *
 * A commit happens on: 200 ms of quiet; Enter outside an IME composition (a candidate list also
 * answers Enter, and that press must not commit); blur; unmount (the pending draft is flushed, never
 * dropped). Clear commits `empty` at once on mousedown, before the blur the click would cause can
 * land on a control that is about to disappear. An outside change of `value` (a reset, a link) ends
 * the edit, unless a keystroke is still waiting to commit: typing is never overwritten.
 */
import { useRef, useState } from 'react'
import type { CompositionEvent, FocusEvent, KeyboardEvent, MouseEvent } from 'react'
import { useDebouncedCallback } from '../core/debounce'

/** The pause after the last keystroke that commits the draft. */
export const COMMIT_DELAY_MS = 200

export type CommittedFieldOptions<T> = {
  /** The stored value. */
  value: T
  /** What clear commits (`''` for text, `undefined` or `null` for a number the store may unset). */
  empty: T
  onCommit(next: T): void
  /** Quiet period before a commit. Default {@link COMMIT_DELAY_MS}. */
  delay?: number
}

export type CommittedField<T> = {
  /** What the input shows. */
  draft: T
  /** Sets the draft and schedules the commit. */
  change(next: T): void
  /** Commits a pending draft now. */
  flush(): void
  /** Spread on the input (or on the element that contains it: the events bubble). */
  inputProps: {
    onKeyDown(event: KeyboardEvent): void
    onBlur(event: FocusEvent): void
    onCompositionStart(event: CompositionEvent): void
    onCompositionEnd(event: CompositionEvent): void
  }
  /** Spread on the clear button. Commits on mousedown and keeps focus in the input. */
  clearProps: { onMouseDown(event: MouseEvent): void }
}

/** True while an IME composition owns the key: the flag, the event's own, or the legacy 229. */
const composing = (event: KeyboardEvent, flag: boolean): boolean =>
  flag || event.nativeEvent.isComposing || event.keyCode === 229

export function useCommittedField<T>({
  value,
  empty,
  onCommit,
  delay = COMMIT_DELAY_MS,
}: CommittedFieldOptions<T>): CommittedField<T> {
  const [edit, setEdit] = useState<{ draft: T } | null>(null)
  const isComposing = useRef(false)
  const committer = useDebouncedCallback((next: T) => {
    onCommit(next)
  }, delay)

  // A store change that is not our own write ends the edit. Our own write lands as `value`
  // too; by then the edit holds the same draft, so dropping it changes nothing on screen.
  const [seen, setSeen] = useState(value)
  if (!Object.is(seen, value)) {
    setSeen(value)
    if (!committer.pending()) setEdit(null)
  }

  const change = (next: T): void => {
    setEdit({ draft: next })
    committer.call(next)
  }

  const flush = (): void => {
    committer.flush()
  }

  return {
    draft: edit === null ? value : edit.draft,
    change,
    flush,
    inputProps: {
      onKeyDown(event) {
        if (event.key === 'Enter' && !composing(event, isComposing.current)) flush()
      },
      onBlur() {
        flush()
      },
      onCompositionStart() {
        isComposing.current = true
      },
      onCompositionEnd() {
        isComposing.current = false
      },
    },
    clearProps: {
      onMouseDown(event) {
        event.preventDefault()
        committer.cancel()
        setEdit(null)
        onCommit(empty)
      },
    },
  }
}
