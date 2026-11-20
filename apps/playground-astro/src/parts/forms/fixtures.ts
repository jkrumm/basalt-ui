import { createElement } from 'react'
import type { ReactElement } from 'react'

export const ZONES: readonly string[] = [
  'Europe/Berlin',
  'Europe/London',
  'America/New_York',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
]

export const BASE_IMAGES: readonly string[] = [
  'node:22-alpine',
  'node:22-bookworm',
  'oven/bun:1',
  'python:3.13-slim',
]

export const ENVIRONMENTS = [
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
]

export const PERIODS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

/** A static stand-in for a TanStack Form field: no store, so the value is fixed for the picture. */
export function staticField<T>(value: T) {
  const errors: unknown[] = []
  return {
    state: { value, meta: { errors } },
    handleChange() {},
    handleBlur() {},
  }
}

/** A static stand-in for a TanStack Form instance: the footer reads its state, nothing is submitted. */
export function staticForm<V>(values: V) {
  const errors: unknown[] = []
  return {
    state: { values, isSubmitting: false, canSubmit: true, errors, isDirty: false },
    options: { defaultValues: values },
    store: { subscribe: () => ({ unsubscribe() {} }) },
    reset() {},
  }
}

export function SearchIcon({ className }: { className?: string }): ReactElement {
  return createElement(
    'svg',
    {
      className,
      width: 16,
      height: 16,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      'aria-hidden': true,
    },
    createElement('circle', { cx: 11, cy: 11, r: 7 }),
    createElement('path', { d: 'm20 20-3.5-3.5' }),
  )
}
