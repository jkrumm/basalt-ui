/**
 * `FormField`: one labelled control with its description and its error, by construction. The label
 * is required by type; the error region is always mounted, so a message that appears is announced;
 * the required mark is a `*` glyph beside the control's own `aria-required`, never color alone; a
 * disabled fieldset around it disables every control kind inside.
 *
 * The value comes from one of two sources, never both: `field` (a `FieldLike`, the submit forms'
 * TanStack Form field) or `control` (a `ControlHandle`, an instant-apply preference). The child is
 * the bare control: `FormField` hands it the value, the change handler and `required`.
 *
 * `layout="row"` is the settings row: the label and the description at the start, the control at
 * the end, stacked once the field's own width is under the `regular` size. A switch or a checkbox
 * stays at the end at every width. Inside a `FormSection` the section's `layout` is the default.
 */
import {
  cloneElement,
  createContext,
  isValidElement,
  use,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import type { FieldLike, IconComponent } from '../core/ports'
import { RowIcon } from './row-icon'
import { Field, FieldDescription, FieldError } from '../ui/field'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const formFieldParts = [
  'form-field-row',
  'field-required',
  'field-dirty',
  'field-error-region',
  'field-control',
] as const

/** What a `control` row reads and writes: a `ControlHandle`, or the `use()` of a synced field. */
export type ControlSource<T> = {
  use(): readonly [T, (next: T) => void]
  readonly isDefault?: boolean
}

type Source<T> =
  | {
      /** A TanStack Form field, or any `FieldLike`: submit forms. Shows its first error. */
      field: FieldLike<T>
      control?: never
    }
  | {
      /**
       * A store `ControlHandle` (instant-apply preferences, a dot while it is not the default) or
       * any handle with `use()`, such as a synced state's `field(key)`: the row applies at once.
       */
      control: ControlSource<T>
      field?: never
    }

export type FormFieldProps<T = unknown> = Source<T> & {
  /** The visible name of the control. Required: an unlabelled control has no accessible name. */
  label: NonNullable<ReactNode>
  /** Help text under the control, wired to it through `aria-describedby`. */
  description?: ReactNode
  /** Marks the control required: a `*` glyph for the eye and `required` on the control. */
  required?: boolean
  /** Disables the control. A disabled fieldset around the field does the same. */
  disabled?: boolean
  /**
   * `stack` puts the label over the control; `row` is the settings row, label and description at
   * the start and the control at the end, stacking when the field is narrow. Default: the enclosing
   * `FormSection`'s layout, else `stack`.
   */
  layout?: FormFieldLayout
  /**
   * A stable id for the row, a target for a link (`#row-digest`): `SettingsLayout` scrolls to it
   * and marks it once. Distinct from the control's own id.
   */
  id?: string
  /** An icon tile at the start of the row, `layout="row"` only. */
  icon?: IconComponent
  /** Layout only (`w-full`, `max-w-sm`). */
  className?: string
  /** The bare control: an `Input`, a `Select`, a `Switch`, a `Checkbox`, a `NumberField`, a `Slider`. */
  children: ReactElement
}

/** `stack`: label over control. `row`: label and description at the start, control at the end. */
export type FormFieldLayout = 'stack' | 'row'

/** The layout a `FormField` takes when it names none: a `FormSection` sets it, a `FormRow` resets it. */
export const FormFieldLayoutContext = createContext<FormFieldLayout>('stack')

/** The first message of a field's `errors`, by record order; undefined when none reads. */
export function firstError(errors: readonly unknown[]): string | undefined {
  for (const entry of errors) {
    const message = read(entry)
    if (message !== undefined) return message
  }
  return undefined
}

function read(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry === '' ? undefined : entry
  if (Array.isArray(entry)) return firstError(entry)
  if (typeof entry !== 'object' || entry === null) return undefined
  const { message, fieldErrors } = entry as { message?: unknown; fieldErrors?: unknown }
  if (typeof message === 'string' && message !== '') return message
  if (typeof fieldErrors === 'object' && fieldErrors !== null) {
    return firstError(Object.values(fieldErrors))
  }
  return undefined
}

type Bind = {
  value: unknown
  onChange(next: never): void
  onBlur?: () => void
}

/** Hands the child what it did not set itself; a prop the child sets wins. */
function bindChild(
  child: ReactElement,
  bind: Bind,
  required: boolean | undefined,
  label: ReactNode,
  state: { invalid: boolean; disabled: boolean | undefined } = {
    invalid: false,
    disabled: undefined,
  },
): ReactElement {
  if (!isValidElement<Record<string, unknown>>(child)) return child
  const own = child.props
  const next: Record<string, unknown> = {}
  const give = (name: string, value: unknown): void => {
    if (own[name] === undefined) next[name] = value
  }
  if (typeof bind.value === 'boolean') {
    give('checked', bind.value)
    give('onCheckedChange', bind.onChange)
  } else {
    give('value', bind.value)
    give('onValueChange', bind.onChange)
  }
  if (bind.onBlur !== undefined && own['onBlur'] === undefined) next['onBlur'] = bind.onBlur
  if (required === true) give('required', true)
  if (typeof label === 'string' && own['aria-labelledby'] === undefined) give('aria-label', label)
  // A Base UI control reads both from `Field`; a platform one (`NativeSelect`) only from its props.
  if (state.invalid) give('aria-invalid', true)
  if (state.disabled === true) give('disabled', true)
  return cloneElement(child, next)
}

/**
 * True while a native `<fieldset disabled>` encloses the field: Base UI's `Field` only reads its own
 * `Fieldset`, and a native one disables buttons and inputs but not a custom trigger. Watches each
 * enclosing fieldset's `disabled`, which a form flips while it submits.
 */
function useNativeFieldsetDisabled(): [boolean, (el: HTMLElement | null) => void] {
  const element = useRef<HTMLElement | null>(null)
  const [disabled, setDisabled] = useState(false)
  useLayoutEffect(() => {
    const sets: HTMLFieldSetElement[] = []
    let next = element.current?.parentElement?.closest('fieldset') ?? null
    while (next !== null) {
      sets.push(next)
      next = next.parentElement?.closest('fieldset') ?? null
    }
    const sync = (): void => {
      setDisabled(sets.some((set) => set.disabled))
    }
    sync()
    const observer = new MutationObserver(sync)
    for (const set of sets)
      observer.observe(set, { attributes: true, attributeFilter: ['disabled'] })
    return () => {
      observer.disconnect()
    }
  }, [])
  return [
    disabled,
    (el) => {
      element.current = el
    },
  ]
}

type FrameProps = {
  id: string | undefined
  icon: IconComponent | undefined
  layout: FormFieldLayout | undefined
  /** The control is an on/off one (a switch, a checkbox): in a row it stays at the end at every width. */
  toggle: boolean
  label: ReactNode
  description: ReactNode
  required: boolean | undefined
  disabled: boolean | undefined
  dirty: boolean
  error: string | undefined
  className: string | undefined
  children: ReactNode
}

// The row's grid: the label and the description share the start column, the control and its error
// the end one, a fixed 18rem wide. Narrow, it stacks label, description, control, error; a toggle
// keeps its end column.
const ROW_GRID =
  'grid min-w-0 gap-x-6 gap-y-1 [grid-template-areas:"label"_"desc"_"control"_"error"] @regular:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] @regular:grid-rows-[auto_1fr_auto] @regular:[grid-template-areas:"label_control"_"desc_control"_"._error"]'
const ROW_TOGGLE_GRID =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr_auto] gap-x-6 gap-y-1 [grid-template-areas:"label_control"_"desc_control"_"error_error"]'
const ROW_AREAS =
  '*:data-[slot=field-label]:[grid-area:label] *:data-[slot=field-description]:[grid-area:desc] *:data-[slot=field-description]:self-start *:data-[slot=field-control]:[grid-area:control] *:data-[slot=field-control]:self-start *:data-[slot=field-error-region]:[grid-area:error] *:data-[slot=field-error-region]:empty:hidden'

function Frame({
  id,
  icon: Icon,
  layout: own,
  toggle,
  label,
  description,
  required,
  disabled,
  dirty,
  error,
  className,
  children,
}: FrameProps): ReactElement {
  const [nativeDisabled, ref] = useNativeFieldsetDisabled()
  const inherited = use(FormFieldLayoutContext)
  const row = (own ?? inherited) === 'row'
  const off = disabled === true || nativeDisabled
  const field = (
    <Field
      ref={ref}
      label={
        <span className="inline-flex items-center gap-1">
          {label}
          {required === true && (
            <span data-slot="field-required" aria-hidden="true" className="text-muted-foreground">
              *
            </span>
          )}
          {dirty && (
            <span
              data-slot="field-dirty"
              aria-hidden="true"
              className="ml-1 size-1.5 rounded-full bg-brand-fill"
            />
          )}
        </span>
      }
      invalid={error !== undefined}
      {...(off && { disabled: true })}
      {...(dirty && { 'data-dirty': '' })}
      className={cn(
        'min-w-0',
        row && (toggle ? ROW_TOGGLE_GRID : ROW_GRID),
        row && ROW_AREAS,
        row ? undefined : className,
      )}
      {...(!row && id !== undefined && { id })}
    >
      <div
        data-slot="field-control"
        className={cn(
          'min-w-0 *:not-data-[slot=switch]:not-data-[slot=checkbox]:w-full',
          row && toggle && 'flex min-h-5 items-center',
        )}
      >
        {children}
      </div>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {/* Mounted before any error, so the text that arrives is announced; empty it adds no gap. */}
      <div data-slot="field-error-region" aria-live="polite" className="min-w-0 empty:-mt-1.5">
        {error === undefined ? null : <FieldError match>{error}</FieldError>}
      </div>
    </Field>
  )
  if (!row) return field
  // The container is an inner box, never the root: a size container directly in a `<fieldset>`
  // loses its layout in Chrome (form-row.tsx), and a caller's fieldset may wrap the field.
  return (
    <div
      data-slot="form-field-row"
      {...(id !== undefined && { id })}
      className={cn(
        'min-w-0 transition-colors duration-slow data-flash:bg-selected',
        Icon !== undefined && 'flex items-start gap-3',
        className,
      )}
    >
      {Icon !== undefined && <RowIcon icon={Icon} />}
      <div className={cn('@container min-w-0', Icon !== undefined && 'flex-1')}>{field}</div>
    </div>
  )
}

function SubmitField<T>({
  field,
  label,
  description,
  required,
  disabled,
  layout,
  id,
  icon,
  className,
  children,
}: FormFieldProps<T> & { field: FieldLike<T> }): ReactElement {
  const error = firstError(field.state.meta.errors)
  const bound = bindChild(
    children,
    {
      value: field.state.value,
      onChange: (next: never) => {
        field.handleChange(next as T)
      },
      onBlur: () => {
        field.handleBlur()
      },
    },
    required,
    label,
    { invalid: error !== undefined, disabled },
  )
  return (
    <Frame
      id={id}
      icon={icon}
      layout={layout}
      toggle={typeof field.state.value === 'boolean'}
      label={label}
      description={description}
      required={required}
      disabled={disabled}
      dirty={false}
      error={error}
      className={className}
    >
      {bound}
    </Frame>
  )
}

function PreferenceField<T>({
  control,
  label,
  description,
  required,
  disabled,
  layout,
  id,
  icon,
  className,
  children,
}: FormFieldProps<T> & { control: ControlSource<T> }): ReactElement {
  const [value, set] = control.use()
  const bound = bindChild(
    children,
    { value, onChange: (next: never) => set(next as T) },
    required,
    label,
    { invalid: false, disabled },
  )
  return (
    <Frame
      id={id}
      icon={icon}
      layout={layout}
      toggle={typeof value === 'boolean'}
      label={label}
      description={description}
      required={required}
      disabled={disabled}
      dirty={control.isDefault === false}
      error={undefined}
      className={className}
    >
      {bound}
    </Frame>
  )
}

/**
 * A labelled control with a description, an always-mounted error region, a required mark and, for a
 * `control`, a dot while it differs from its default. Pass `field` in a submit form and `control` for
 * an instant-apply preference; passing both, or no `label`, is a type error.
 *
 * @useWhen a form control needs a label, a description or an error
 * @neverWhen the control is a filter: `spec` and a `ControlHome` draw it
 *
 * @example
 * <form.Field name="title" children={(f) => (
 *   <FormField label="Title" description="Shown in the list." required field={f}>
 *     <Input />
 *   </FormField>
 * )} />
 *
 * @example
 * <FormField label="Compact rows" control={prefs.compact}><Switch /></FormField>
 */
export function FormField<T>(props: FormFieldProps<T>): ReactElement {
  if (props.field !== undefined) return <SubmitField {...props} field={props.field} />
  return <PreferenceField {...props} control={props.control} />
}
