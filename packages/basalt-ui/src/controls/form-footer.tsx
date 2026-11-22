/**
 * `FormFooter`: the action row of a submit form. At most five actions and one primary, by type; the
 * primary is the submit button. It stays enabled while the form is invalid or unchanged, so a click
 * always answers: a submit with errors shows them and moves focus to the first invalid control. It
 * is disabled only while the form submits, when the footer reads `aria-busy`. The form-level error
 * shows in an always-mounted live region; `sticky` keeps the row in view at the bottom of the
 * scrollport and says when the form has unsaved changes.
 */
import { useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import type { FormLike } from '../core/ports'
import { Button } from '../ui/button'
import type { FormAction } from './contract'
import { firstError } from './form-field'

type PrimaryCount<
  A extends readonly FormAction[],
  Acc extends unknown[] = [],
> = A extends readonly [infer H, ...infer T extends readonly FormAction[]]
  ? PrimaryCount<T, H extends { primary: true } ? [...Acc, 1] : Acc>
  : Acc['length']

/** `A` itself when it holds at most five actions and at most one `primary: true`; `never` otherwise. */
export type ValidActions<A extends readonly FormAction[]> = A['length'] extends
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  ? PrimaryCount<A> extends 0 | 1
    ? A
    : never
  : never

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const formFooterParts = [
  'form-footer',
  'form-footer-error',
  'form-footer-actions',
  'form-footer-status',
] as const

/** True when the element has a box; a `hidden` or `display: none` element has none. */
function visible(el: Element): el is HTMLElement {
  return el instanceof HTMLElement && el.getClientRects().length > 0
}

/** The element itself when rendered, else the first visible, enabled control of its field. */
function target(el: Element): HTMLElement | null {
  if (visible(el)) return el
  const field = el.closest('[data-slot="field"]')
  if (field === null) return null
  const controls = field.querySelectorAll('button, input, select, textarea, [tabindex]')
  return [...controls].find((c): c is HTMLElement => visible(c) && !c.matches(':disabled')) ?? null
}

/**
 * After a submit the engine rejected on the client, focus the first invalid control of the form:
 * two frames let the fields render `aria-invalid` first. A server error has `toSubmitErrors` do it.
 * An invalid element that is not rendered (a file upload's hidden input) hands focus to the first
 * visible control of its field instead.
 */
function focusFirstInvalid(from: HTMLElement): void {
  const form = from.closest('form')
  if (form === null) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const el of form.querySelectorAll('[aria-invalid="true"]')) {
        const next = target(el)
        if (next === null) continue
        if (document.activeElement !== next) next.focus()
        return
      }
    })
  })
}

/**
 * The action row under a form's fields. The primary submits the form; it stays enabled while the
 * form is invalid or unchanged and is disabled only while it submits. A server error returned by
 * `toSubmitErrors` shows under the row.
 *
 * @useWhen a submit form needs Cancel and Save
 * @neverWhen the form saves as you type, or the page already has a bar action for it
 *
 * @example
 * <FormFooter form={form} actions={[{ label: 'Cancel', onClick: close }, { label: 'Save', primary: true }]} />
 * <FormFooter sticky form={form} actions={[{ label: 'Discard', onClick: reset }, { label: 'Save settings', primary: true }]} />
 */
export function FormFooter<const A extends readonly FormAction[]>({
  form,
  actions,
  sticky = false,
  className,
}: {
  form: FormLike<unknown>
  actions: A & ValidActions<A>
  /**
   * Keeps the row at the bottom of the scrollport while the form scrolls, on a band of its own, and
   * reads `Unsaved changes` while the form is dirty: the save of a long settings page.
   */
  sticky?: boolean
  /** Layout only (`mt-4`, `w-full`). */
  className?: string
}): ReactElement {
  const state = useSyncExternalStore(
    (cb) => {
      const subscription = form.store.subscribe(cb)
      return () => subscription.unsubscribe()
    },
    () => form.state,
    () => form.state,
  )
  const error = firstError(state.errors)
  const dirty = state.isDirty === true
  return (
    <div
      data-slot="form-footer"
      aria-busy={state.isSubmitting}
      {...(sticky && { 'data-sticky': '' })}
      {...(dirty && { 'data-dirty': '' })}
      className={cn(
        'flex flex-col gap-2',
        sticky && 'sticky bottom-0 z-10 border-t border-border bg-surface py-3',
        className,
      )}
    >
      <div
        data-slot="form-footer-error"
        aria-live="polite"
        className="text-sm text-bad empty:hidden"
      >
        {error}
      </div>
      <div
        data-slot="form-footer-actions"
        className="flex flex-wrap items-center justify-end gap-2"
      >
        {sticky && (
          <p
            data-slot="form-footer-status"
            aria-live="polite"
            className="m-0 mr-auto flex items-center gap-2 text-sm text-muted-foreground"
          >
            {dirty && (
              <>
                <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-fill" />
                Unsaved changes
              </>
            )}
          </p>
        )}
        {(actions as readonly FormAction[]).map((action) => {
          const primary = action.primary === true
          return primary ? (
            <Button
              key={action.label}
              type="submit"
              variant="primary"
              loading={state.isSubmitting}
              onClick={(event) => {
                action.onClick?.()
                focusFirstInvalid(event.currentTarget)
              }}
            >
              {action.label}
            </Button>
          ) : (
            <Button key={action.label} type="button" variant="secondary" onClick={action.onClick}>
              {action.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
