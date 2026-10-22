/** Invented cloud-cover field for S8: no real data, no tiles. Smooth bands plus a front, in percent. */
export const FIELD_COLS = 28
export const FIELD_ROWS = 16

/** Cloud cover per cell, 0–100, row-major. */
export const FIELD: readonly number[] = Array.from({ length: FIELD_COLS * FIELD_ROWS }, (_, i) => {
  const x = (i % FIELD_COLS) / FIELD_COLS
  const y = Math.floor(i / FIELD_COLS) / FIELD_ROWS
  const bands = Math.sin(x * 7 + y * 3) * 0.5 + Math.sin(y * 9 - x * 2) * 0.3
  const front = Math.max(0, 1 - Math.abs(x - 0.65 + y * 0.25) * 4)
  return Math.round(Math.min(100, Math.max(0, 45 + bands * 45 + front * 40)))
})

/** The key rail's labelled stops, clear to overcast. */
export const KEY_STOPS = [0, 25, 50, 75, 100] as const

export const KEY_UNIT = '% cloud cover'

/** The scrubber's forecast hours, local time. */
export const HOURS = ['21:00', '22:00', '23:00', '00:00', '01:00', '02:00'] as const
