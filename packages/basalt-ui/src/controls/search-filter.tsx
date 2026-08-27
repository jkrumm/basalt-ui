/**
 * `SearchFilter` — free text over a `field.string` (`docs/CONTROLS-SPEC.md` §3). The one filter that
 * is not a pill: a text box states its own value, so wrapping it in a chip + popover would cost a
 * press per keystroke session for nothing.
 *
 * Keystrokes are DEBOUNCED (200ms) before they reach the field. `field.string()` already writes with
 * `history: 'replace'`, so an un-debounced input would still not stack history entries — what the
 * debounce buys is one navigation per phrase instead of one per character, which is the difference
 * between a typed query and a re-rendered route tree eight times over.
 *
 * @example
 * // q: field.string({ max: 120 })
 * <SearchFilter field={table.field.q} placeholder="Search pages" />
 */
import { TextInput } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { FieldHandle, StringField } from '../state'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { SheetField, useControlName } from './filter-sheet'

/** One navigation per typed phrase, not per keystroke. */
const DEBOUNCE_MS = 200

export type SearchFilterProps = {
  readonly field: FieldHandle<StringField>
  readonly placeholder?: string
  /** Sheet-form heading. @default 'Search' */
  readonly label?: string
}

export function SearchFilter({
  field,
  placeholder,
  label = 'Search',
}: SearchFilterProps): ReactNode {
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  const draft = useDebouncedField(value, setValue)
  useFilterRegistration(!field.isDefault(value), () => {
    field.clear()
  })

  // `placeholder` is optional and, even when set, stops being the name the moment the user types —
  // so the name comes from `label`, or from the sheet heading when there is one.
  const { labelId, nameProps } = useControlName(label, surface === 'sheet')

  const input = (
    <TextInput
      {...nameProps}
      size="ctl"
      value={draft.value}
      leftSection={<SearchIcon />}
      {...(placeholder !== undefined && { placeholder })}
      onChange={(event) => {
        draft.set(event.currentTarget.value)
      }}
    />
  )

  if (surface === 'sheet') {
    return (
      <SheetField label={label} labelId={labelId}>
        {input}
      </SheetField>
    )
  }
  return input
}

/**
 * A local draft that lands on the field `DEBOUNCE_MS` after the last keystroke, and that follows the
 * field when it changes from OUTSIDE the input (`Reset all`, a back navigation, a deep link).
 * `seen` is what separates the two directions: it holds the last value this hook itself committed,
 * so an incoming change it did not cause is the only thing that overwrites the draft.
 */
function useDebouncedField(
  value: string,
  setValue: (next: string) => void,
): { value: string; set: (next: string) => void } {
  const [draft, setDraft] = useState(value)
  const seen = useRef(value)
  const commit = useRef(setValue)
  commit.current = setValue

  useEffect(() => {
    if (seen.current === value) return
    seen.current = value
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => {
      seen.current = draft
      commit.current(draft)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [draft, value])

  return { value: draft, set: setDraft }
}

function SearchIcon(): ReactNode {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35 -4.35" />
    </svg>
  )
}
