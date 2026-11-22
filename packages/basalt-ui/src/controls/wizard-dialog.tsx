/**
 * `WizardDialog`: the body of a split dialog that takes a record in steps. Two panes: a preview of
 * the record as it is filled, and the form with a top bar (back, segmented progress, an `n/m`
 * counter, close), the step's heading and help line, its fields and one full-width primary. The
 * primary stays disabled until the step is valid; a last review step lists every answer with a jump
 * back to its step. Below the `wide` container tier the preview pane is dropped and the form pane
 * stands alone.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { controls } from '../core/messages/controls'
import type { FormLike } from '../core/ports'
import { Button } from '../ui/button'
import { DialogClose } from '../ui/dialog'
import { Fieldset } from '../ui/field'
import type { UseFormDraftOptions } from './contract'
import { useFormDraft } from './draft'
import { Stepper } from './stepper'

/** What the wizard needs of a form: `FormLike` and a submit. A TanStack form from `useAppForm` fits. */
export type WizardForm = FormLike<unknown> & { handleSubmit(): unknown }

/** The values type of a form: what `preview`, `valid` and `summary` receive. */
export type WizardValues<F> = F extends { state: { values: infer V } } ? V : never

/** One answer of the review step. */
export type WizardAnswer = {
  label: string
  value: ReactNode
}

/** One step of a wizard, written against the form's values. */
export type WizardStep<F extends WizardForm> = {
  /** The step's name in the progress strip (assistive technology) and on the review jump. */
  label: string
  /** The heading shown above the fields. */
  title: string
  /** One line under the heading saying what the step asks. */
  help?: string
  /** The step's fields, rendered inside the wizard's own form; the form comes in as an argument. */
  render: (form: F) => ReactNode
  /** True when the step's values are good enough to continue. The primary is disabled until then. */
  valid: (values: WizardValues<F>) => boolean
  /** The step's answers as the review lists them. */
  summary: (values: WizardValues<F>) => readonly WizardAnswer[]
}

export type WizardDialogProps<F extends WizardForm> = {
  /** The form every step reads and writes; its `onSubmit` runs from the review step's primary. */
  form: F
  /** The steps before the review, in order; at least one. */
  steps: readonly [WizardStep<F>, ...WizardStep<F>[]]
  /** The record as it stands, drawn from the form's current values, so it mirrors every input. */
  preview: (values: WizardValues<F>) => ReactNode
  /** The label of the primary on the review step: `Create contract`. */
  submitLabel: string
  /** Keeps the answers across a reload; a restored draft opens on the first step that is not valid. */
  draft?: UseFormDraftOptions<WizardValues<F>>
  /** Layout only. */
  className?: string
}

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const wizardDialogParts = [
  'wizard-dialog',
  'wizard-preview',
  'wizard-preview-card',
  'wizard-form',
  'wizard-top-bar',
  'wizard-counter',
  'wizard-body',
  'wizard-heading',
  'wizard-footer',
  'wizard-review',
  'wizard-review-row',
] as const

function useValues<F extends WizardForm>(form: F): WizardValues<F> {
  const read = (): WizardValues<F> => form.state.values as WizardValues<F>
  return useSyncExternalStore(
    (notify) => {
      const subscription = form.store.subscribe(notify)
      return () => {
        subscription.unsubscribe()
      }
    },
    read,
    read,
  )
}

function useSubmitting(form: WizardForm): boolean {
  return useSyncExternalStore(
    (notify) => {
      const subscription = form.store.subscribe(notify)
      return () => {
        subscription.unsubscribe()
      }
    },
    () => form.state.isSubmitting,
    () => false,
  )
}

/** Mounts `useFormDraft` only when the wizard keeps a draft, and reports a restore once. */
function DraftKeeper<F extends WizardForm>({
  form,
  options,
  onRestored,
}: {
  form: F
  options: UseFormDraftOptions<WizardValues<F>>
  onRestored: () => void
}): null {
  const { status } = useFormDraft(form as unknown as FormLike<WizardValues<F>>, options)
  useEffect(() => {
    if (status === 'restored') onRestored()
    // A restore happens once per mounted draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])
  return null
}

function BackGlyph(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
      <path
        d="M10 3.5L5.5 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The body of a split wizard dialog: a live preview beside a stepped form, ending on a review of
 * every answer. Put it in `DialogContent size="split"`; it draws the close itself. The form is the
 * app's (`useAppForm`), the steps are data, and the primary is disabled until the step's `valid`
 * says yes. With `draft` the answers survive a reload.
 *
 * @useWhen a record is created in three or more steps and the user should see it take shape (a contract, a workspace, an invoice)
 * @neverWhen the form is one screen (use `Dialog` with `FormFooter`), or the steps are not taken in order
 *
 * @example
 * <Dialog open={open} onOpenChange={setOpen}>
 *   <DialogContent title="New contract" size="split">
 *     <WizardDialog form={form} steps={STEPS} preview={(v) => <ContractCard {...v} />} submitLabel="Create contract" />
 *   </DialogContent>
 * </Dialog>
 */
export function WizardDialog<F extends WizardForm>({
  form,
  steps,
  preview,
  submitLabel,
  draft,
  className,
}: WizardDialogProps<F>): ReactElement {
  const t = useMessages(controls)
  const values = useValues(form)
  const submitting = useSubmitting(form)
  const [step, setStep] = useState(0)
  const last = steps.length
  const onReview = step === last
  const current = onReview ? undefined : steps[step]
  const allValid = steps.every((s) => s.valid(values))
  const ok = onReview ? allValid : (current?.valid(values) ?? false)

  const heading = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    heading.current?.focus()
  }, [step])

  const onRestored = (): void => {
    const first = steps.findIndex((s) => !s.valid(form.state.values as WizardValues<F>))
    setStep(first === -1 ? last : first)
  }

  return (
    <div data-slot="wizard-dialog" className={cn('@container flex min-h-0 flex-1', className)}>
      {draft === undefined ? null : (
        <DraftKeeper form={form} options={draft} onRestored={onRestored} />
      )}
      <aside
        data-slot="wizard-preview"
        aria-label={t('controls.preview')}
        className="hidden min-w-0 flex-1 items-center justify-center bg-canvas p-8 @wide:flex"
      >
        <div
          data-slot="wizard-preview-card"
          className="w-full max-w-90 rounded-card bg-card p-6 shadow-card"
        >
          {preview(values)}
        </div>
      </aside>
      <form
        noValidate
        data-slot="wizard-form"
        className="flex min-w-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (!ok || submitting) return
          if (onReview) void form.handleSubmit()
          else setStep(step + 1)
        }}
      >
        <header data-slot="wizard-top-bar" className="flex h-14 shrink-0 items-center gap-3 px-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="icon"
            aria-label={t('controls.back')}
            className={cn(step === 0 && 'invisible')}
            disabled={step === 0}
            onClick={() => {
              setStep(step - 1)
            }}
          >
            <BackGlyph />
          </Button>
          <Stepper
            variant="bar"
            steps={[...steps.map((s) => ({ label: s.label })), { label: t('controls.review') }]}
            current={step}
            className="flex-1"
          />
          <span
            data-slot="wizard-counter"
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            {step + 1}/{last + 1}
          </span>
          <DialogClose />
        </header>
        <div
          data-slot="wizard-body"
          className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-4 py-6 @wide:px-12"
        >
          <div className="flex flex-col gap-1">
            <h2
              ref={heading}
              tabIndex={-1}
              data-slot="wizard-heading"
              className="m-0 text-lg font-medium text-foreground outline-none"
            >
              {onReview ? t('controls.review') : current?.title}
            </h2>
            <p className="m-0 text-sm text-muted-foreground">
              {onReview ? t('controls.reviewHelp') : current?.help}
            </p>
          </div>
          {onReview ? (
            <dl data-slot="wizard-review" className="m-0 flex flex-col divide-y divide-border">
              {steps.map((s, index) =>
                s.summary(values).map((answer) => (
                  <div
                    key={`${s.label}:${answer.label}`}
                    data-slot="wizard-review-row"
                    className="flex items-center gap-3 py-3"
                  >
                    <dt className="w-1/3 shrink-0 text-sm text-muted-foreground">{answer.label}</dt>
                    <dd className="m-0 min-w-0 flex-1 text-sm text-foreground">{answer.value}</dd>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t('controls.editField', answer.label)}
                      onClick={() => {
                        setStep(index)
                      }}
                    >
                      {t('controls.edit')}
                    </Button>
                  </div>
                )),
              )}
            </dl>
          ) : (
            <Fieldset disabled={submitting} className="flex flex-col gap-6">
              {current?.render(form)}
            </Fieldset>
          )}
        </div>
        <div data-slot="wizard-footer" className="shrink-0 px-4 pb-6 @wide:px-12">
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={!ok}
            loading={submitting}
          >
            {onReview ? submitLabel : t('controls.continue')}
          </Button>
        </div>
      </form>
    </div>
  )
}
