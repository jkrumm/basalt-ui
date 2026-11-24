import { createFormat } from 'basalt-ui'
import type { CalendarDate } from 'basalt-ui'

const FORMAT = createFormat()
const pad = (n: number): string => String(n).padStart(2, '0')

/** Clock text of an hour since noon: 24.5 is 00:30. */
export function clock(hour: number): string {
  const minutes = Math.round(hour * 60)
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`
}

/** A night by its weekday and date, the evening it starts on. */
export const nightLabel = (id: string): string => {
  const day = id as CalendarDate
  return `${FORMAT.date(day, 'weekday')} ${FORMAT.date(day, 'short', { month: 'short', day: 'numeric', year: undefined })}`
}

/** Hours with one decimal where it is not whole. */
export const hoursText = (hours: number): string =>
  FORMAT.number(hours, { maximumFractionDigits: 1 })

export const percentText = (fraction: number): string =>
  FORMAT.percent(fraction, { maximumFractionDigits: 0 })

/** A forecast by its site and night: "Kamm, Sat Nov 28". */
export const cellName = (siteName: string, nightId: string): string =>
  `${siteName}, ${nightLabel(nightId)}`
