/** The day a post or a release is dated, in the reader's locale: calendar days are UTC, never shifted by the build host's zone. */
export function formatDay(value: Date | string, locale = 'en'): string {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

/** The `datetime` attribute of a day: `YYYY-MM-DD`. */
export function isoDay(value: Date | string): string {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10)
}
