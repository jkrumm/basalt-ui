/**
 * A record's previous and next through the list it was opened from: the steps every record surface
 * draws (a `Peek`, `PageAside`, `Dock` and a routed page's `PageBar records`). A module of its
 * own, so a page bar that steps records does not load the whole panel anatomy.
 */
import type { ReactElement } from 'react'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import type { RecordSequence } from '../core/ports'
import { neighbours } from '../core/record-steps'
import { Button } from '../ui/button'

/** A panel glyph: one stroked path in the shipped icon's 16 px box and 1.5 px stroke. */
export function Glyph({ d }: { d: string }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const CLOSE = 'M4 4l8 8M12 4l-8 8'
export const UP = 'M4 10l4-4 4 4'
export const DOWN = 'M4 6l4 4 4-4'

/** Previous and next through the opener's records, disabled at the ends. */
export function PanelSteps({ records }: { records: RecordSequence }): ReactElement {
  const t = useMessages(page)
  const { prev, next } = neighbours(records)
  return (
    <div className="flex items-center" data-panel="steps">
      <Button
        variant="ghost"
        size="sm"
        shape="icon"
        aria-label={t('page.previousRecord')}
        data-panel="previous"
        disabled={prev === undefined}
        onClick={() => {
          // Read again at the click: the opener may have re-ordered since this render.
          const to = neighbours(records).prev
          if (to !== undefined) records.onStep(to)
        }}
      >
        <Glyph d={UP} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        shape="icon"
        aria-label={t('page.nextRecord')}
        data-panel="next"
        disabled={next === undefined}
        onClick={() => {
          const to = neighbours(records).next
          if (to !== undefined) records.onStep(to)
        }}
      >
        <Glyph d={DOWN} />
      </Button>
    </div>
  )
}
