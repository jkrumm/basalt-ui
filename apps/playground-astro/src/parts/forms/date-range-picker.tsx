import { DateRangePicker } from 'basalt-ui/ui/date-picker'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <DateRangePicker
      aria-label="Report range"
      defaultValue={{ from: '2026-11-09', to: '2026-11-15' }}
      placeholder="Pick a span"
      className="w-64"
    />
  )
}
