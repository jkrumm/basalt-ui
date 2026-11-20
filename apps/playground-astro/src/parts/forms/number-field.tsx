import { NumberField } from 'basalt-ui/ui/number-field'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-xs flex-col gap-3">
      <NumberField aria-label="Distance (km)" locale="de-DE" defaultValue={1234.5} />
      <NumberField aria-label="Runners" defaultValue={4} min={1} max={12} />
    </div>
  )
}
