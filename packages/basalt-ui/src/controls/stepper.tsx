/**
 * `Stepper`: the step list of a multi-step form. Every step is named, the current one is marked
 * (`aria-current="step"`), a done step carries a check and, with `onStepChange`, is a button that
 * goes back to it; an upcoming step is never reachable from the list, so the form validates each
 * step before the next. From the `regular` container size up it is a row of numbered steps joined
 * by a line; narrower it folds into `Step 2 of 3`, the current name and one segment per step.
 * `variant="bar"` is the progress strip alone, one 4 px segment per step with no text: the top bar of
 * a `WizardDialog`, which prints its own counter.
 */
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

export type StepperStep = {
  /** One or two words, a verb and a noun where it fits: `Basics`, `Pick a window`. */
  label: string
  /** One short line under the label in the row form: what the step asks, or `Optional`. */
  description?: string
}

export type StepperProps = {
  /** The steps in order; three or more (a two-step form needs no stepper). */
  steps: readonly StepperStep[]
  /** The index of the current step, from 0. */
  current: number
  /** Makes each done step a button that goes back to it. Without it the list only shows progress. */
  onStepChange?: (index: number) => void
  /** Names the list for assistive technology. Default `Progress`. */
  'aria-label'?: string
  /**
   * `list` (default) is the numbered row that folds into a count when narrow; `bar` is the
   * segmented strip alone, named for assistive technology by each step's label and status.
   */
  variant?: 'list' | 'bar'
  /** Layout only (`w-full`, `max-w-3xl`). */
  className?: string
}

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const stepperParts = [
  'stepper',
  'stepper-compact',
  'stepper-list',
  'stepper-step',
  'stepper-bar',
  'stepper-segment',
] as const

type Status = 'done' | 'current' | 'upcoming'

const STATUS_TEXT: Record<Status, string> = {
  done: 'done',
  current: 'current step',
  upcoming: 'not started',
}

function Check(): ReactElement {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 6.5l2.5 2.5 4.5-5.5" />
    </svg>
  )
}

function Marker({ index, status }: { index: number; status: Status }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums',
        status === 'done' && 'border-brand-fill bg-brand-fill text-on-brand',
        status === 'current' && 'border-brand bg-background text-brand ring-2 ring-brand/25',
        status === 'upcoming' && 'border-input bg-background text-muted-foreground',
      )}
    >
      {status === 'done' ? <Check /> : index + 1}
    </span>
  )
}

/**
 * The step list of a multi-step form: numbered steps joined by a line, the current one marked, done
 * ones checked and, with `onStepChange`, reachable. Folds into a one-line count and a segmented bar
 * when its container is narrow.
 *
 * @useWhen a form is split into three or more steps taken in order
 * @neverWhen the steps can be taken in any order (Tabs or sections), or the count changes as the user answers
 *
 * @example
 * <Stepper steps={[{ label: 'Basics' }, { label: 'Schedule' }, { label: 'Review' }]} current={step} onStepChange={setStep} />
 */
export function Stepper({
  steps,
  current,
  onStepChange,
  'aria-label': ariaLabel = 'Progress',
  variant = 'list',
  className,
}: StepperProps): ReactElement {
  const at = Math.min(Math.max(current, 0), Math.max(steps.length - 1, 0))
  const statusOf = (index: number): Status =>
    index < at ? 'done' : index === at ? 'current' : 'upcoming'
  const now = steps[at]
  if (variant === 'bar') {
    return (
      <nav aria-label={ariaLabel} data-slot="stepper" className={cn('min-w-0', className)}>
        <ol data-slot="stepper-bar" className="m-0 flex list-none gap-1.5 p-0">
          {steps.map((step, index) => {
            const status = statusOf(index)
            return (
              <li
                key={step.label}
                data-slot="stepper-segment"
                data-status={status}
                {...(status === 'current' && { 'aria-current': 'step' as const })}
                className={cn(
                  'h-1 flex-1 rounded-full',
                  index <= at ? 'bg-brand-fill' : 'bg-input',
                )}
              >
                <span className="sr-only">
                  {step.label}, {STATUS_TEXT[status]}
                </span>
              </li>
            )
          })}
        </ol>
      </nav>
    )
  }
  return (
    <nav aria-label={ariaLabel} data-slot="stepper" className={cn('@container min-w-0', className)}>
      <div data-slot="stepper-compact" className="flex min-w-0 flex-col gap-2 @regular:hidden">
        <p className="m-0 flex min-w-0 items-baseline gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground tabular-nums">
            Step {at + 1} of {steps.length}
          </span>
          <span aria-current="step" className="min-w-0 truncate font-medium text-foreground">
            {now?.label}
          </span>
        </p>
        <span aria-hidden="true" className="flex gap-1">
          {steps.map((step, index) => (
            <span
              key={step.label}
              className={cn('h-1 flex-1 rounded-full', index <= at ? 'bg-brand-fill' : 'bg-input')}
            />
          ))}
        </span>
      </div>
      <ol
        data-slot="stepper-list"
        className="m-0 hidden min-w-0 list-none items-start gap-3 p-0 @regular:flex"
      >
        {steps.map((step, index) => {
          const status = statusOf(index)
          const reachable = status === 'done' && onStepChange !== undefined
          const body = (
            <>
              <Marker index={index} status={status} />
              <span className="flex min-w-0 flex-col gap-0.5 text-left">
                <span
                  className={cn(
                    'text-sm leading-6',
                    status === 'upcoming' ? 'text-muted-foreground' : 'font-medium text-foreground',
                  )}
                >
                  {step.label}
                  <span className="sr-only">, {STATUS_TEXT[status]}</span>
                </span>
                {step.description === undefined ? null : (
                  <span className="text-xs text-muted-foreground">{step.description}</span>
                )}
              </span>
            </>
          )
          return (
            <li
              key={step.label}
              data-slot="stepper-step"
              data-status={status}
              {...(status === 'current' && { 'aria-current': 'step' as const })}
              className="flex min-w-0 flex-1 items-start gap-3 last:flex-none"
            >
              {reachable ? (
                <button
                  type="button"
                  onClick={() => {
                    onStepChange(index)
                  }}
                  className="-m-1 flex min-w-0 cursor-pointer items-start gap-2 rounded-ctrl p-1 focus-ring hover:bg-accent"
                >
                  {body}
                </button>
              ) : (
                <span className="flex min-w-0 items-start gap-2">{body}</span>
              )}
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-3 h-px min-w-4 flex-1',
                    index < at ? 'bg-brand-fill' : 'bg-border',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
