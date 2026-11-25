import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import type { Slot } from './types'

export type SiteFormProps = {
  /** Where the browser sends the form: a URL on your site or a form service. */
  action: string
  /** Default `post`. */
  method?: 'post' | 'get'
  children: Slot
  className?: string
}

export type SiteFieldProps = {
  /** The visible label. */
  label: string
  /** The submitted name; also the id the label points at. */
  name: string
  /** Default `text`. `textarea` renders a multi-line field. */
  type?: 'text' | 'email' | 'url' | 'tel' | 'search' | 'number' | 'textarea'
  /** The autofill token (`email`, `name`, `off`): every field names one. */
  autoComplete: string
  required?: boolean
  /** A hint under the field, linked to it for a screen reader. */
  description?: string
  placeholder?: string
  /** The on-screen keyboard (`numeric`, `email`) for a field whose `type` is not enough. */
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'search'
  /** Rows of a `textarea`. Default 4. */
  rows?: number
  className?: string
}

/** The same look as `Input` and `Button`, restated because `basalt-ui/ui` pulls in Base UI and this subpath needs react alone. */
const CONTROL =
  'w-full min-w-0 rounded-ctrl border border-input bg-field px-3 text-sm text-foreground placeholder:text-faint focus-ring transition-colors user-invalid:border-bad'

/**
 * A native form: it posts to `action` with no client JavaScript. The browser validates `required` and
 * `type`, and `:user-invalid` marks a field after the reader leaves it, never on the first key.
 *
 * @useWhen a content page collects a few fields and a server or form service takes the post
 * @neverWhen the form needs a live error summary, async checks or a multi-step flow (use `Form` from `basalt-ui/form` in an app)
 *
 * @example
 * <SiteForm action="/subscribe">
 *   <SiteField label="Email" name="email" type="email" autoComplete="email" required />
 *   <SiteSubmit>Subscribe</SiteSubmit>
 * </SiteForm>
 */
export function SiteForm({
  action,
  method = 'post',
  children,
  className,
}: SiteFormProps): ReactElement {
  return (
    <form
      data-slot="form"
      action={action}
      method={method}
      className={cn('flex flex-col gap-4 in-[.basalt-prose]:mt-(--basalt-rhythm-2)', className)}
    >
      {children}
    </form>
  )
}

/**
 * A label, a native input or textarea and an optional hint. The hint sits above the control's
 * autofill popover and is read with the field.
 *
 * @useWhen a `SiteForm` needs one labelled text, email, number or multi-line field
 * @neverWhen the choice is a select, a date or a file (write the native element in the form, or use `basalt-ui/form` in an app)
 *
 * @example
 * <SiteField label="Message" name="message" type="textarea" autoComplete="off" required />
 */
export function SiteField({
  label,
  name,
  type = 'text',
  autoComplete,
  required,
  description,
  placeholder,
  inputMode,
  rows = 4,
  className,
}: SiteFieldProps): ReactElement {
  const id = `field-${name}`
  const hint = description === undefined ? undefined : `${id}-hint`
  return (
    <div data-slot="field" className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {description !== undefined && (
        <p id={hint} className="m-0 text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {type === 'textarea' ? (
        <textarea
          id={id}
          name={name}
          rows={rows}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          inputMode={inputMode}
          aria-describedby={hint}
          className={cn(CONTROL, 'py-2')}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          inputMode={inputMode}
          aria-describedby={hint}
          className={cn(CONTROL, 'h-ctl')}
        />
      )}
    </div>
  )
}

/**
 * The submit button, in the primary look.
 *
 * @useWhen a `SiteForm` needs its one submit button
 * @neverWhen the button does not submit (use `Button` from `basalt-ui/ui/button` in an island)
 *
 * @example
 * <SiteSubmit>Send</SiteSubmit>
 */
export function SiteSubmit({
  children,
  className,
}: {
  children: Slot
  className?: string
}): ReactElement {
  return (
    <button
      type="submit"
      data-slot="button"
      className={cn(
        'inline-flex h-ctl shrink-0 cursor-pointer items-center justify-center gap-1.5 self-start rounded-ctrl bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground select-none focus-ring transition-colors hover:bg-primary/90',
        className,
      )}
    >
      {children}
    </button>
  )
}
