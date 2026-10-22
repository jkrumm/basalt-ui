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

/** The area and the night the whole forecast describes (invented geography). */
export const AREA = 'Harrow Coast'
export const NIGHT = 'Fri 23 Oct'

/** The scrubber's readout names the day: hours past midnight belong to the next date. */
export const HOUR_LABELS = [
  'Fri 21:00',
  'Fri 22:00',
  'Fri 23:00',
  'Sat 00:00',
  'Sat 01:00',
  'Sat 02:00',
] as const

/** Invented coastline, 0–100 on both axes (sea on the left), and three invented places in percent. */
export const COAST = 'M34 0 C30 10 26 16 28 24 S42 34 40 44 S28 54 30 62 S46 72 44 82 S38 94 40 100'
export const PLACES = [
  { name: 'Harrow Bay', left: 8, top: 46 },
  { name: 'Port Elden', left: 44, top: 38 },
  { name: 'Kessel Heights', left: 50, top: 72 },
] as const
