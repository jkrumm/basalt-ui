/** The runs the view-switch and saved-views recipes list: a short fixture, deterministic for shots. */
export type Run = { id: string; name: string; km: number }

const ROUTES = [
  'Riverside loop',
  'Hill repeats',
  'Park easy',
  'Harbour tempo',
  'Long Sunday',
  'Track intervals',
]

export const RUNS: readonly Run[] = Array.from({ length: 18 }, (_, i) => ({
  id: `run-${i + 1}`,
  name: `${ROUTES[i % ROUTES.length] ?? 'Run'} ${Math.floor(i / ROUTES.length) + 1}`,
  km: Math.round((5 + ((i * 37) % 170) / 10) * 10) / 10,
}))
