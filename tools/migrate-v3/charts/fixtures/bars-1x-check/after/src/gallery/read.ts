export type DayRow = { day: string; raw: number; jpeg: number }

export const formatDay = (day: string) => day.slice(5)

export const readCount = (row: DayRow, key: string): number | null =>
  key === 'raw' || key === 'jpeg' ? row[key] : null
