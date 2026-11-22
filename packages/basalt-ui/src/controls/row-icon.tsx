import type { ReactElement } from 'react'
import type { IconComponent } from '../core/ports'

/**
 * The neutral tile at the start of a settings row. The same look as `IconTile` in `ui/card`, kept
 * here so a form's bundle does not take the card module for a 32 px square.
 */
export function RowIcon({ icon: Icon }: { icon: IconComponent }): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-slot="icon-tile"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-ctrl bg-selected text-muted-foreground"
    >
      <Icon className="size-icon" aria-hidden="true" />
    </span>
  )
}
