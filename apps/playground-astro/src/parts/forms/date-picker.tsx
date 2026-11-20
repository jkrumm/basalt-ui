import { DatePicker } from 'basalt-ui/ui/date-picker'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <DatePicker
      aria-label="Due date"
      defaultValue="2026-11-27"
      placeholder="Pick a day"
      className="w-48"
    />
  )
}
