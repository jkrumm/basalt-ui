import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { flow as flowMessages } from '../core/messages/flow'
import type { FlowHandle, FlowIssue } from './flow'
import { anchorOf, worstTone } from './flow'

export type FlowChecklistProps = {
  /** The handle the canvas draws from: an item reveals its anchor there. */
  flow: FlowHandle
  /** The same issues the canvas marks. */
  issues: readonly FlowIssue[]
}

const TONE_TEXT = { info: 'text-info', warn: 'text-warn', bad: 'text-bad' } as const
const WARN = 'M8 2.5 14 13H2Z M8 6.5v3 M8 11.25v.01'
const CHECK = 'M3.5 8.5l3 3 6-7'

function Mark({ d, className }: { d: string; className: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('size-icon shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}

/**
 * The checklist of a flow's issues, for the panel beside a `FlowCanvas`: a line that says how many
 * are open, then one item per issue with its tone's mark, its label and its hint. An item is a
 * button: it unfolds the group that holds the issue, brings the row (or the group, or the edge's
 * target) into the canvas frame and focuses it. With no issue it is one line that says all is set.
 *
 * @useWhen a `FlowCanvas` carries issues and its `PageAside` lists what to fix before the flow runs
 * @neverWhen the list is tasks, not problems on the canvas (use `RowList`)
 *
 * @example
 * <PageAside title="Workflow" dock="always" width={360}>
 *   <FlowChecklist flow={flow} issues={issues} />
 * </PageAside>
 */
export function FlowChecklist({ flow, issues }: FlowChecklistProps): ReactElement {
  const t = useMessages(flowMessages)
  if (issues.length === 0) {
    return (
      <p
        data-slot="flow-checklist"
        className="m-0 flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Mark d={CHECK} className="text-good" />
        {t('flow.allSet')}
      </p>
    )
  }
  return (
    <div data-slot="flow-checklist" className="flex flex-col gap-3">
      <p className="m-0 text-sm text-muted-foreground">{t('flow.toFix', issues.length)}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {issues.map((issue) => {
          const tone = worstTone([issue]) ?? 'warn'
          return (
            <li key={issue.id}>
              <button
                type="button"
                data-slot="flow-checklist-item"
                data-anchor={anchorOf(issue)}
                onClick={() => flow.reveal(anchorOf(issue))}
                className="flex w-full cursor-pointer items-start gap-2.5 rounded-inset border bg-card p-3 text-left text-foreground shadow-card hover:bg-accent focus-ring"
              >
                <Mark d={WARN} className={TONE_TEXT[tone]} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm">{issue.label}</span>
                  {issue.hint !== undefined && (
                    <span className="text-xs text-muted-foreground">{issue.hint}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
