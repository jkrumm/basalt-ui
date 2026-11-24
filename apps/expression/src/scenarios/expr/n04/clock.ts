import { useFormat } from 'basalt-ui'

/** Clock time and short weekday of an hour, in the page's zone (UTC), from the one formatter. */
export function useHourFormat(): { clock: (d: Date) => string; day: (d: Date) => string } {
  const f = useFormat()
  return {
    clock: (d) =>
      f.time(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }),
    day: (d) => f.date(d, 'weekday', { weekday: 'short', timeZone: 'UTC' }),
  }
}
