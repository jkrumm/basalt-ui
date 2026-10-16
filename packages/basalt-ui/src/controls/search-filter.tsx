/**
 * `SearchFilter` — free text over a `field.string` (`docs/CONTROLS-SPEC.md` §3). The one filter that
 * is not a pill: a text box states its own value, so wrapping it in a chip + popover would cost a
 * press per keystroke session for nothing.
 *
 * Keystrokes are DEBOUNCED (200ms) before they reach the field. `field.string()` already writes with
 * `history: 'replace'`, so an un-debounced input would still not stack history entries — what the
 * debounce buys is one navigation per phrase instead of one per character, which is the difference
 * between a typed query and a re-rendered route tree eight times over. The pending phrase is
 * committed at once on Enter and blur, and on unmount while the store still holds the value the
 * draft was based on, so a query submitted, tabbed away from or navigated away from inside the
 * window is never lost.
 *
 * @example
 * // q: field.string({ max: 120 })
 * <SearchFilter field={table.field.q} placeholder="Search pages" />
 */
import { CloseButton, TextInput } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { assertRequiredProps } from '../common/validate'
import type { FieldHandle } from '../state'
import type { StringField } from '../state/fields'
import { useControlName } from './control-name'
import type { FilterBase } from './filter-base'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { SearchGlyph } from './glyphs'
import { PanelRow } from './panel-row'
import type { UncontrolledProps } from './uncontrolled'

/** One navigation per typed phrase, not per keystroke. */
const DEBOUNCE_MS = 200

export type SearchFilterProps = UncontrolledProps &
  Omit<FilterBase, 'icon' | 'label' | 'clearable'> & {
    readonly field: FieldHandle<StringField>
    readonly placeholder?: string
    /** Sheet-form heading and the accessible name. @default 'Search' */
    readonly label?: string
    /** The clear button shown while the box holds text. @default true */
    readonly clearable?: boolean
  }

export function SearchFilter(props: SearchFilterProps): ReactNode {
  // F-ERR-1 — without this a missing `field` surfaces as `undefined is not an object
  // (evaluating 'field.use')`, caught by `RootBoundary`.
  assertRequiredProps('SearchFilter', props, ['field'], {
    field: 'bind it to a store field (`store.field.<name>`), never a value/onChange pair.',
  })
  const {
    field,
    placeholder,
    label = 'Search',
    clearable = true,
    disabled,
    className,
    style,
  } = props
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  const draft = useDebouncedField(value, setValue, () => {
    field.clear()
  })
  useFilterRegistration(!field.isDefault(value), () => {
    field.clear()
  })

  // `placeholder` is optional and, even when set, stops being the name the moment the user types —
  // so the name comes from `label`, or from the visible heading when the surface draws one.
  const named = surface === 'sheet' || surface === 'panel'
  const { labelId, nameProps } = useControlName(label, named)
  // The pill form has no wrapping home — the `TextInput` itself is the root, so it takes the class
  // directly. The panel/sheet forms wrap it in a home that becomes the root instead.
  const isPill = surface !== 'panel' && surface !== 'sheet'

  const input = (
    <TextInput
      {...nameProps}
      size="ctl"
      type="search"
      enterKeyHint="search"
      value={draft.value}
      leftSection={<SearchGlyph />}
      {...(clearable &&
        draft.value !== '' && {
          rightSection: (
            <CloseButton
              size="sm"
              aria-label="Clear search"
              disabled={disabled === true}
              // Keeps focus in the box: a blur here would flush the phrase being cleared.
              onMouseDown={(event) => {
                event.preventDefault()
              }}
              onClick={draft.clear}
            />
          ),
        })}
      {...(disabled === true && { disabled: true })}
      {...(placeholder !== undefined && { placeholder })}
      onChange={(event) => {
        draft.set(event.currentTarget.value)
      }}
      onBlur={draft.flush}
      onKeyDown={(event) => {
        // Enter that confirms an IME candidate is not a submit.
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) draft.flush()
      }}
      {...(isPill && className !== undefined && { className })}
      {...(isPill && style !== undefined && { style })}
    />
  )

  // The sheet form is the panel form (`docs/CONTROLS-SPEC.md` §3: "sheet = panel rows inside a
  // Drawer") — the same `PanelRow` label-above-control row on both surfaces.
  if (surface === 'panel' || surface === 'sheet') {
    return (
      <PanelRow
        label={label}
        labelId={labelId}
        {...(className !== undefined && { className })}
        {...(style !== undefined && { style })}
      >
        {input}
      </PanelRow>
    )
  }
  return input
}

/**
 * A local draft that lands on the field `DEBOUNCE_MS` after the last keystroke — or at once, via
 * `flush` (Enter, blur) — and that follows the field when it changes from OUTSIDE the input
 * (`Reset all`, a back navigation, a deep link).
 *
 * `seen` is what separates the two directions: it is the last value the store is known to hold —
 * written synchronously by this hook's own commits, adopted from the store otherwise — so an
 * incoming change it did not cause is the only thing that overwrites the draft.
 */
function useDebouncedField(
  value: string,
  setValue: (next: string) => void,
  clearField: () => void,
): { value: string; set: (next: string) => void; flush: () => void; clear: () => void } {
  const [draft, setDraft] = useState(value)
  const seen = useRef(value)
  const rendered = useRef(value)
  const write = (next: string): void => {
    seen.current = next
    setValue(next)
  }
  const commit = useDebouncedCallback((next: string) => {
    // A phrase typed and erased inside the window ends where it began: nothing to write.
    if (next === seen.current) return
    write(next)
  }, DEBOUNCE_MS)

  // Unmount: a layout cleanup runs before Mantine's own passive one cancels the timer. Flush only
  // while the store still holds what the draft was based on — otherwise an outside change (a
  // `Reset all` that also closed this filter) would be overwritten by a stale phrase.
  const commitRef = useRef(commit)
  useEffect(() => {
    rendered.current = value
    commitRef.current = commit
  })
  useLayoutEffect(
    () => () => {
      if (rendered.current === seen.current) commitRef.current.flush()
      else commitRef.current.cancel()
    },
    [],
  )

  useEffect(() => {
    if (seen.current === value) return
    seen.current = value
    setDraft(value)
    commit.cancel()
  }, [value, commit])

  return {
    value: draft,
    set: (next) => {
      setDraft(next)
      commit(next)
    },
    flush: () => {
      commit.flush()
    },
    // Through the field's own `clear()` — it unsets rather than writing the fallback over it — and
    // unconditional: the store may still hold the old phrase, or an unflushed one.
    clear: () => {
      commit.cancel()
      setDraft('')
      seen.current = rendered.current
      clearField()
    },
  }
}
