/**
 * S6 fixtures (invented): an account page shaped like a desktop-app settings page, and a set-logging
 * entry form shaped like a training log. Nothing here is a real person, key or host.
 */

export type ApiKey = { id: string; name: string; tail: string; lastUsed: string }

export const API_KEYS: readonly ApiKey[] = [
  { id: 'k1', name: 'CI deploy', tail: '4f2a', lastUsed: 'Used 2 hours ago' },
  { id: 'k2', name: 'Local CLI', tail: '91bc', lastUsed: 'Used 3 days ago' },
  { id: 'k3', name: 'Backup script', tail: 'c07e', lastUsed: 'Never used' },
]

export const DIGEST_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
] as const

export const EXERCISES = ['Back squat', 'Bench press', 'Deadlift', 'Overhead press', 'Barbell row']

/** The entry form's reps field starts in its error state: the one sentence the form shows. */
export const REPS_ERROR = 'Enter whole reps between 1 and 30.'
