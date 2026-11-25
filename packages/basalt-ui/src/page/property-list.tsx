import { useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { commitsDraft } from '../core/commit-key'
import { useFormat } from '../core/format'
import type { CalendarDate } from '../core/format'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import { Avatar } from '../ui/avatar'
import type { AvatarProps } from '../ui/avatar'
import { Input } from '../ui/input'
import { NativeSelect } from '../ui/select'
import type { SelectOption } from '../ui/select'
import { FACTS_GRID, FACTS_TERM, FACTS_VALUE } from './facts'

/** What a row's `onCommit` may return: a save in flight. A rejection keeps the editor open and shows its message. */
type Saved = void | Promise<void>

type RowBase = {
  /** Stable key and the editor's id; unique within one list. */
  id: string
  label: string
}

/** A row with no editor: the same row as a `Facts` entry. */
export type ReadOnlyProperty = RowBase & {
  kind?: undefined
  value: ReactNode
}

/** A line of text. The field names its `autoComplete` token; an email or a phone number sets `type` and `inputMode`. */
export type TextProperty = RowBase & {
  kind: 'text'
  value: string
  onCommit(next: string): Saved
  /** The `autocomplete` token, `'off'` when none applies. */
  autoComplete: string
  type?: 'text' | 'email' | 'tel' | 'url'
  inputMode?: 'text' | 'email' | 'tel' | 'url'
  /** Runs on Enter and on blur, never per keystroke; return the error text, or nothing. */
  validate?(next: string): string | undefined
  /** Shown while the value is empty. */
  placeholder?: string
}

/** A number with an optional unit (lead time in days). */
export type NumberProperty = RowBase & {
  kind: 'number'
  value: number | null
  onCommit(next: number): Saved
  /** Printed after the value, and as the input's trailing unit. */
  unit?: string
  min?: number
  max?: number
}

/** One of fewer than ten known values: payment terms, a stage. */
export type SelectProperty = RowBase & {
  kind: 'select'
  value: string | null
  options: readonly SelectOption[]
  onCommit(next: string): Saved
}

/** One calendar day as `YYYY-MM-DD`, never a `Date`. */
export type DateProperty = RowBase & {
  kind: 'date'
  value: CalendarDate | null
  onCommit(next: CalendarDate): Saved
}

/** A person of the list, by id: an owner, a buyer. */
export type PersonOption = {
  id: string
  name: string
  avatar?: Pick<AvatarProps, 'src'>
}

export type PersonProperty = RowBase & {
  kind: 'person'
  value: string | null
  people: readonly PersonOption[]
  onCommit(next: string): Saved
}

export type PropertyRow =
  | ReadOnlyProperty
  | TextProperty
  | NumberProperty
  | SelectProperty
  | DateProperty
  | PersonProperty

export type PropertyListProps = {
  /** One row per entry, in order; ids are unique within one list. A row with no `kind` is read-only. */
  rows: readonly PropertyRow[]
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function focusOnMount(node: HTMLElement | null): void {
  node?.focus()
}

/** The shape of every editor: what it shows, what it writes, and how it leaves. */
type Editor = {
  /** Called with the raw draft; returns the error to show, or commits and closes. */
  save(attempt: () => string | Saved | undefined): void
  cancel(): void
  error: string | undefined
  busy: boolean
}

/**
 * One row's edit session. An attempt either returns an error text (kept under the field, the editor
 * stays open), returns nothing or a save (the editor closes once the save resolves), or its save
 * rejects (the message shows, the editor stays open). A leave that follows a close is ignored, so
 * Enter and the blur it causes write once.
 */
function useEditor(close: () => void): Editor {
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const settled = useRef(false)
  return {
    error,
    busy,
    cancel() {
      if (settled.current) return
      settled.current = true
      close()
    },
    save(attempt) {
      if (settled.current || busy) return
      const result = attempt()
      if (typeof result === 'string') {
        setError(result)
        return
      }
      setError(undefined)
      if (result === undefined) {
        settled.current = true
        close()
        return
      }
      setBusy(true)
      result.then(
        () => {
          settled.current = true
          close()
        },
        (cause: unknown) => {
          setBusy(false)
          setError(cause instanceof Error ? cause.message : String(cause))
        },
      )
    },
  }
}

/** The value as a button: reads as text, shows the edit affordance on hover and focus. */
function ValueButton({
  label,
  onOpen,
  children,
}: {
  label: string
  onOpen(): void
  children: ReactNode
}): ReactElement {
  const t = useMessages(page)
  return (
    <button
      type="button"
      data-slot="property-value"
      aria-label={t('page.propertyEdit', label)}
      onClick={onOpen}
      className="relative -mx-1.5 -my-0.5 block max-w-full rounded-chip px-1.5 py-0.5 text-left [overflow-wrap:anywhere] text-foreground focus-ring hover:bg-accent after:absolute after:inset-x-0 after:top-1/2 after:h-full after:-translate-y-1/2 pointer-coarse:after:min-h-11"
    >
      {children}
    </button>
  )
}

function Unset(): ReactElement {
  const t = useMessages(page)
  return <span className="text-faint">{t('page.propertyEmpty')}</span>
}

function PersonFace({ person }: { person: PersonOption }): ReactElement {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar name={person.name} size="xs" aria-hidden="true" {...person.avatar} />
      <span className="truncate">{person.name}</span>
    </span>
  )
}

function ErrorLine({ id, error }: { id: string; error: string | undefined }): ReactElement | null {
  if (error === undefined) return null
  return (
    <p id={id} role="alert" className="m-0 mt-1 text-xs text-bad">
      {error}
    </p>
  )
}

/** The editor of a text, a number or a day: one input, written on Enter and on blur, dropped on Escape. */
function InputEditor({
  row,
  type,
  inputMode,
  autoComplete,
  initial,
  unit,
  placeholder,
  parse,
  close,
}: {
  row: RowBase
  type: 'text' | 'email' | 'tel' | 'url' | 'date'
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'numeric' | 'decimal' | undefined
  autoComplete: string
  initial: string
  unit?: string | undefined
  placeholder?: string | undefined
  /** Returns the error text, or runs the write. */
  parse(draft: string): string | Saved | undefined
  close(): void
}): ReactElement {
  const [draft, setDraft] = useState(initial)
  const editor = useEditor(close)
  const errorId = `${row.id}-error`
  const commit = (): void => {
    editor.save(() => (draft === initial ? undefined : parse(draft)))
  }
  return (
    <div data-slot="property-editor" className="min-w-0">
      <Input
        ref={focusOnMount}
        size="sm"
        type={type}
        id={row.id}
        name={row.id}
        aria-label={row.label}
        aria-invalid={editor.error === undefined ? undefined : true}
        aria-describedby={editor.error === undefined ? undefined : errorId}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        readOnly={editor.busy}
        end={unit}
        value={draft}
        onValueChange={setDraft}
        onKeyDown={(event) => {
          if (commitsDraft(event)) commit()
          else if (event.key === 'Escape') editor.cancel()
        }}
        onBlur={commit}
      />
      <ErrorLine id={errorId} error={editor.error} />
    </div>
  )
}

/** Focuses the native select in `box` and opens its picker: the click that opened the editor is the gesture it needs. */
function openOnMount(box: HTMLElement | null): void {
  const node = box?.querySelector('select')
  if (!node) return
  node.focus()
  try {
    node.showPicker()
  } catch {
    // No picker API, or no user gesture left: the focused select still opens on a key press.
  }
}

/** The editor of a choice: the platform select, written on a pick, dropped on Escape or a blur without one. */
function SelectEditor({
  row,
  value,
  options,
  onCommit,
  close,
}: {
  row: RowBase
  value: string | null
  options: readonly SelectOption[]
  onCommit(next: string): Saved
  close(): void
}): ReactElement {
  const editor = useEditor(close)
  const errorId = `${row.id}-error`
  return (
    <div data-slot="property-editor" ref={openOnMount} className="min-w-0">
      <NativeSelect
        size="sm"
        id={row.id}
        name={row.id}
        aria-label={row.label}
        aria-invalid={editor.error === undefined ? undefined : true}
        aria-describedby={editor.error === undefined ? undefined : errorId}
        disabled={editor.busy}
        value={value ?? ''}
        options={value === null ? [{ value: '', label: '', disabled: true }, ...options] : options}
        onValueChange={(next) => {
          if (next === value) editor.cancel()
          else editor.save(() => onCommit(next))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') editor.cancel()
        }}
        onBlur={() => {
          if (!editor.busy && editor.error === undefined) editor.cancel()
        }}
      />
      <ErrorLine id={errorId} error={editor.error} />
    </div>
  )
}

function Row({ row }: { row: PropertyRow }): ReactElement {
  const t = useMessages(page)
  const f = useFormat()
  const [editing, setEditing] = useState(false)
  const open = (): void => {
    setEditing(true)
  }
  const close = (): void => {
    setEditing(false)
  }

  let value: ReactNode
  switch (row.kind) {
    case undefined:
      value = row.value
      break
    case 'text':
      value = editing ? (
        <InputEditor
          row={row}
          type={row.type ?? 'text'}
          inputMode={row.inputMode}
          autoComplete={row.autoComplete}
          initial={row.value}
          placeholder={row.placeholder}
          parse={(draft) => row.validate?.(draft) ?? row.onCommit(draft)}
          close={close}
        />
      ) : (
        <ValueButton label={row.label} onOpen={open}>
          {row.value === '' ? <Unset /> : row.value}
        </ValueButton>
      )
      break
    case 'number':
      value = editing ? (
        <InputEditor
          row={row}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          initial={row.value === null ? '' : String(row.value)}
          unit={row.unit}
          parse={(draft) => {
            const next = Number(draft.trim().replace(',', '.'))
            const inRange =
              Number.isFinite(next) &&
              draft.trim() !== '' &&
              next >= (row.min ?? -Infinity) &&
              next <= (row.max ?? Infinity)
            if (inRange) return row.onCommit(next)
            return row.min !== undefined && row.max !== undefined
              ? t('page.propertyRange', row.min, row.max)
              : t('page.propertyInvalid')
          }}
          close={close}
        />
      ) : (
        <ValueButton label={row.label} onOpen={open}>
          {row.value === null ? (
            <Unset />
          ) : (
            `${f.number(row.value)}${row.unit === undefined ? '' : ` ${row.unit}`}`
          )}
        </ValueButton>
      )
      break
    case 'select':
      value = editing ? (
        <SelectEditor
          row={row}
          value={row.value}
          options={row.options}
          onCommit={row.onCommit}
          close={close}
        />
      ) : (
        <ValueButton label={row.label} onOpen={open}>
          {row.options.find((o) => o.value === row.value)?.label ?? <Unset />}
        </ValueButton>
      )
      break
    case 'date':
      value = editing ? (
        <InputEditor
          row={row}
          type="date"
          autoComplete="off"
          initial={row.value ?? ''}
          parse={(draft) =>
            ISO_DAY.test(draft) ? row.onCommit(draft as CalendarDate) : t('page.propertyInvalid')
          }
          close={close}
        />
      ) : (
        <ValueButton label={row.label} onOpen={open}>
          {row.value === null ? <Unset /> : f.date(row.value)}
        </ValueButton>
      )
      break
    case 'person': {
      const current = row.people.find((p) => p.id === row.value)
      value = editing ? (
        <SelectEditor
          row={row}
          value={row.value}
          options={row.people.map((p) => ({ value: p.id, label: p.name }))}
          onCommit={row.onCommit}
          close={close}
        />
      ) : (
        <ValueButton label={row.label} onOpen={open}>
          {current === undefined ? <Unset /> : <PersonFace person={current} />}
        </ValueButton>
      )
      break
    }
  }

  return (
    <div
      data-slot="property-row"
      data-kind={row.kind ?? 'fact'}
      data-editing={editing ? '' : undefined}
      className="contents"
    >
      <dt className={FACTS_TERM}>{row.label}</dt>
      <dd className={FACTS_VALUE}>{value}</dd>
    </div>
  )
}

/**
 * The properties of one record as label and value, each one editable in place: the value is a
 * button that becomes its editor (a text input, a number with its unit, a select, a day, a person)
 * and writes on Enter, on blur or on a pick, drops on Escape, and shows a failed save under the
 * field. The rows look like `Facts`: the same grid, the same two columns from the `regular`
 * container tier, so a read-only row (no `kind`) sits among editable ones. A validation error
 * shows after Enter or blur, never per keystroke.
 *
 * @useWhen a record's own properties are listed as label and value and the reader changes them where they are read: a supplier's contact, lead time and terms
 * @neverWhen nothing on the list is editable (use Facts) or the change is a multi-field form with one Save (use a form)
 *
 * @example
 * <PropertyList
 *   rows={[
 *     { id: 'contact', kind: 'text', label: 'Contact', value: supplier.contact, autoComplete: 'off', onCommit: (name) => save({ contact: name }) },
 *     { id: 'lead', kind: 'number', label: 'Lead time', value: supplier.leadDays, unit: 'days', min: 0, max: 365, onCommit: (days) => save({ leadDays: days }) },
 *     { id: 'since', label: 'Supplier since', value: f.date(supplier.since) },
 *   ]}
 * />
 */
export function PropertyList({ rows }: PropertyListProps): ReactElement {
  return (
    <div data-slot="property-list" className="@container min-w-0">
      <dl className={FACTS_GRID}>
        {rows.map((row) => (
          <Row key={row.id} row={row} />
        ))}
      </dl>
    </div>
  )
}
