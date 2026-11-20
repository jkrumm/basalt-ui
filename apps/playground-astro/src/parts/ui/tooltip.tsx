import { Button } from 'basalt-ui/ui/button'
import { Tooltip } from 'basalt-ui/ui/tooltip'
import type { ReactElement } from 'react'

function RefreshGlyph({ className }: { className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v5h-5" />
    </svg>
  )
}

export function Demo(): ReactElement {
  return (
    <Tooltip label="Refresh runs">
      <Button shape="icon" variant="ghost" aria-label="Refresh runs">
        <RefreshGlyph className="size-4" />
      </Button>
    </Tooltip>
  )
}
