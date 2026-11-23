import type { ReactElement } from 'react'
import { cn } from '../../core/cn'

/** The plus of an add control: `+ View` in the strip, `+ Filter` once its words give way to it. */
export function PlusGlyph({ className }: { className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className={cn('size-icon', className)} fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
