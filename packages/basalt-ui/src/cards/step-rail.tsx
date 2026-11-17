import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { useFormat } from '../core/format'
import { lists } from '../core/messages/lists'
import { useMessages } from '../core/messages/use-messages'
import type { IconComponent, Tone } from '../core/ports'
import { isInstant, toInstant } from './event-list-model'

/** One step. The row's `id` is its identity: unique and stable. */
export type StepRailRow = {
  id: string
  /** What the step did, one line; it truncates, never wraps. */
  label: string
  /** The step's working time. `null` draws no bar and no duration text. */
  durationMs: number | null
  at: Date | number
  /** The tone of the glyph and the bar. `'bad'` is a failed step. Default `'neutral'`. */
  tone?: Tone
  /** Default: a dot in the tone. */
  icon?: IconComponent
  /** The line under the row: a failure's reason, or a note on any step. */
  detail?: string
}

export type StepRailProps = {
  /** Names the rail for assistive technology; the page already shows its heading. */
  label: string
  /** Steps in display order: the rail never re-sorts. */
  steps: readonly StepRailRow[]
}

const FILL: Record<Tone, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  accent: 'bg-brand',
  neutral: 'bg-muted-foreground',
}

const INK: Record<Tone, string> = {
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  info: 'text-info',
  accent: 'text-brand',
  neutral: 'text-muted-foreground',
}

/** The narrowest a drawn bar gets, in percent: a quick step still shows. */
const MIN_BAR = 2

const hasDuration = (ms: number | null): ms is number =>
  ms !== null && Number.isFinite(ms) && ms >= 0

/**
 * A vertical list of steps, each with a bar scaled to the longest one: where the time went, at a
 * glance. A row is a glyph, the words, the bar with its duration and the time; a step with a
 * `detail` carries that line underneath. The picture is hidden from assistive technology and a
 * table behind it says the same, scale included. It has no frame and no phase: compose it in a
 * `DataPanel` or a section. It never animates.
 *
 * @useWhen a pipeline, deploy, job run or trace summary shows its steps and their durations
 * @neverWhen the rows only happen at a time with no duration (use an event list) or are compared by several columns (use a table)
 *
 * @example
 * <StepRail
 *   label="Deploy steps"
 *   steps={[
 *     { id: 'build', label: 'Build image', durationMs: 42_000, at: Date.now() },
 *     { id: 'probe', label: 'Probe', durationMs: 800, at: Date.now(), tone: 'bad', detail: 'Timed out on /health' },
 *   ]}
 * />
 */
export function StepRail({ label, steps }: StepRailProps): ReactElement {
  const t = useMessages(lists)
  let longest = 0
  for (const step of steps) {
    if (hasDuration(step.durationMs) && step.durationMs > longest) longest = step.durationMs
  }
  const scaled = steps.some((step) => hasDuration(step.durationMs))
  return (
    <div data-slot="step-rail" className="@container min-w-0">
      <ol aria-hidden="true" className="m-0 flex list-none flex-col gap-3 p-0">
        {steps.map((step) => (
          <Row key={step.id} step={step} longest={longest} />
        ))}
      </ol>
      <Facts
        steps={steps}
        caption={scaled ? `${label}. ${t('lists.stepScale', longest)}` : label}
      />
    </div>
  )
}

function Row({ step, longest }: { step: StepRailRow; longest: number }): ReactElement {
  const f = useFormat()
  const t = useMessages(lists)
  const tone = step.tone ?? 'neutral'
  const at = toInstant(step.at)
  const Icon = step.icon
  const ms = hasDuration(step.durationMs) ? step.durationMs : null
  return (
    <li
      data-slot="step-rail-row"
      data-step-id={step.id}
      data-tone={tone}
      className="flex flex-col gap-1"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn('flex size-5 shrink-0 items-center justify-center', INK[tone])}>
          {Icon === undefined ? (
            <span className={cn('size-1.5 rounded-full', FILL[tone])} />
          ) : (
            <Icon className="size-icon" aria-hidden="true" />
          )}
        </span>
        <span data-slot="step-rail-label" className="min-w-0 flex-1 truncate text-sm">
          {step.label}
        </span>
        {ms !== null && (
          <span
            data-slot="step-rail-bar"
            className="order-last flex basis-full items-center gap-2 ps-8 @regular:order-none @regular:basis-48 @regular:ps-0"
          >
            <span className="h-1.5 flex-1 overflow-hidden rounded-chip bg-foreground/10">
              <span
                data-slot="step-rail-fill"
                className={cn('block h-full rounded-chip', FILL[tone])}
                style={{ width: `${Math.max(MIN_BAR, longest > 0 ? (ms / longest) * 100 : 0)}%` }}
              />
            </span>
            <span className="w-14 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
              {t('lists.stepDuration', ms)}
            </span>
          </span>
        )}
        <span
          data-slot="step-rail-time"
          className="shrink-0 text-xs tabular-nums text-muted-foreground"
        >
          {isInstant(at) ? f.time(at) : '—'}
        </span>
      </div>
      {step.detail !== undefined && (
        <p data-slot="step-rail-detail" className="m-0 ps-8 text-xs text-muted-foreground">
          {step.detail}
        </p>
      )}
    </li>
  )
}

/** The table behind the picture: every step, its duration, its time and its detail. */
function Facts({
  steps,
  caption,
}: {
  steps: readonly StepRailRow[]
  caption: string
}): ReactElement {
  const f = useFormat()
  const t = useMessages(lists)
  const detailed = steps.some((step) => step.detail !== undefined)
  return (
    <div className="sr-only">
      <table data-slot="step-rail-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('lists.stepColumn')}</th>
            <th scope="col">{t('lists.durationColumn')}</th>
            <th scope="col">{t('lists.timeColumn')}</th>
            {detailed && <th scope="col">{t('lists.detailColumn')}</th>}
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => {
            const at = toInstant(step.at)
            const valid = isInstant(at)
            return (
              <tr key={step.id}>
                <th scope="row">
                  {step.label}
                  {step.tone === 'bad' ? ` (${t('lists.stepFailed')})` : ''}
                </th>
                <td>
                  {hasDuration(step.durationMs) ? t('lists.stepDuration', step.durationMs) : ''}
                </td>
                <td>{valid ? <time dateTime={at.toISOString()}>{f.time(at)}</time> : '—'}</td>
                {detailed && <td>{step.detail ?? ''}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
