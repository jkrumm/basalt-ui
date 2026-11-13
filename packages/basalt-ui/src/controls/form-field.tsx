/**
 * `FormField`: one labelled control with its description and its error, by construction. The label
 * is required by type; the error region is always mounted, so a message that appears is announced;
 * the required mark is a `*` glyph beside the control's own `aria-required`, never colour alone; a
 * disabled fieldset around it disables every control kind inside.
 *
 * The value comes from one of two sources, never both: `field` (a `FieldLike`, the submit forms'
 * TanStack Form field) or `control` (a `ControlHandle`, an instant-apply preference). The child is
 * the bare control: `FormField` hands it the value, the change handler and `required`.
 */
import { cloneElement, isValidElement, useLayoutEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import type { ControlHandle, FieldLike } from '../core/ports'
import { Field, FieldDescription, FieldError } from '../ui/field'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const formFieldParts = [
  'field-required',
  'field-dirty',
  'field-error-region',
  'field-control',
] as const

type Source<T> =
  | {
      /** A TanStack Form field, or any `FieldLike`: submit forms. Shows its first error. */
      field: FieldLike<T>
      control?: never
    }
  | {
      /** A store `ControlHandle`: instant-apply preferences. Shows a dot while it is not the default. */
      control: ControlHandle<T>
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
  /** Layout only (`w-full`, `max-w-sm`). */
  className?: string
  /** The bare control: an `Input`, a `Select`, a `Switch`, a `Checkbox`, a `NumberField`, a `Slider`. */
  children: ReactElement
}

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
  label: ReactNode
  description: ReactNode
  required: boolean | undefined
  disabled: boolean | undefined
  dirty: boolean
  error: string | undefined
  className: string | undefined
  children: ReactNode
}

function Frame({
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
  const off = disabled === true || nativeDisabled
  return (
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
      className={cn('min-w-0', className)}
    >
      <div data-slot="field-control" className="min-w-0 *:w-full">
        {children}
      </div>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {/* Mounted before any error, so the text that arrives is announced; empty it adds no gap. */}
      <div data-slot="field-error-region" aria-live="polite" className="min-w-0 empty:-mt-1.5">
        {error === undefined ? null : <FieldError match>{error}</FieldError>}
      </div>
    </Field>
  )
}

function SubmitField<T>({
  field,
  label,
  description,
  required,
  disabled,
  className,
  children,
}: FormFieldProps<T> & { field: FieldLike<T> }): ReactElement {
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
  )
  return (
    <Frame
      label={label}
      description={description}
      required={required}
      disabled={disabled}
      dirty={false}
      error={firstError(field.state.meta.errors)}
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
  className,
  children,
}: FormFieldProps<T> & { control: ControlHandle<T> }): ReactElement {
  const [value, set] = control.use()
  const bound = bindChild(
    children,
    { value, onChange: (next: never) => set(next as T) },
    required,
    label,
  )
  return (
    <Frame
      label={label}
      description={description}
      required={required}
      disabled={disabled}
      dirty={!control.isDefault}
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
