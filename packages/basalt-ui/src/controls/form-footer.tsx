/**
 * `FormFooter`: the action row of a submit form. At most five actions and one primary, by type; the
 * primary is the submit button, disabled while the form cannot submit; the footer reads `aria-busy`
 * while it submits and shows the form-level error in an always-mounted live region.
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

/**
 * The action row under a form's fields. The primary submits the form and is disabled on `!canSubmit`;
 * a server error returned by `toSubmitErrors` shows under the row.
 *
 * @useWhen a submit form needs Cancel and Save
 * @neverWhen the form saves as you type, or the page already has a bar action for it
 *
 * @example
 * <FormFooter form={form} actions={[{ label: 'Cancel', onClick: close }, { label: 'Save', primary: true }]} />
 */
export function FormFooter<const A extends readonly FormAction[]>({
  form,
  actions,
  className,
}: {
  form: FormLike<unknown>
  actions: A & ValidActions<A>
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
  return (
    <div
      data-slot="form-footer"
      aria-busy={state.isSubmitting}
      className={cn('flex flex-col gap-2', className)}
    >
      <div
        data-slot="form-footer-error"
        aria-live="polite"
        className="text-sm text-bad empty:hidden"
      >
        {error}
      </div>
      <div data-slot="form-footer-actions" className="flex flex-wrap justify-end gap-2">
        {(actions as readonly FormAction[]).map((action) => {
          const primary = action.primary === true
          return primary ? (
            <Button
              key={action.label}
              type="submit"
              variant="primary"
              loading={state.isSubmitting}
              disabled={!state.canSubmit}
              onClick={action.onClick}
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
