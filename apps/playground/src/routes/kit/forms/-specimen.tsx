/**
 * What the Forms gallery's pages share: the specimen field a state cell binds, the outline glyphs the
 * buttons carry, and the real data the choice controls list. Prefixed `-`, so the router and the
 * quality matrix skip it.
 */
import type { FieldLike } from 'basalt-ui'
import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'

/**
 * One state cell's field: local state behind FormField's structural `FieldLike` port, with a fixed
 * error for the invalid cell. The whole forms bind TanStack Form through the same port.
 */
export function useSpecimen<T>(initial: T, error?: string): FieldLike<T> {
  const [value, setValue] = useState(initial)
  return {
    state: { value, meta: { errors: error === undefined ? [] : [error] } },
    handleChange: setValue,
    handleBlur: () => {},
  }
}

/** The states every input is shown in. Hover and focus are live on each cell, not pinned. */
export const STATES = ['Rest', 'Filled', 'Invalid', 'Disabled', 'Read-only'] as const
export type State = (typeof STATES)[number]

/** A 24-unit outline glyph sized by the button (`size-icon`). */
function glyph(paths: ReactNode): (props: { className?: string }) => ReactElement {
  return function Glyph({ className = 'size-icon' }) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths}
      </svg>
    )
  }
}

export const Plus = glyph(<path d="M12 5v14M5 12h14" />)
export const Arrow = glyph(<path d="M5 12h14M13 6l6 6-6 6" />)
export const Download = glyph(<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />)
export const Trash = glyph(
  <>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
  </>,
)
export const Chevron = glyph(<path d="M6 9l6 6 6-6" />)
export const Link = glyph(
  <>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </>,
)
export const More = glyph(
  <>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </>,
)

export const Search = glyph(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </>,
)
export const Mail = glyph(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </>,
)
export const Globe = glyph(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18" />
  </>,
)

/** Every IANA time zone the runtime knows: a list long enough that a plain select fails it. */
export const TIME_ZONES: readonly string[] = Intl.supportedValuesOf('timeZone')

const LANGUAGE_CODES = [
  'ar',
  'bn',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'fa',
  'fi',
  'fr',
  'he',
  'hi',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'ms',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sv',
  'sw',
  'th',
  'tr',
  'uk',
  'vi',
  'zh',
] as const
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' })

/** Interface languages as `{ value, label }`, named in English by the runtime. */
export const LANGUAGES: readonly { value: string; label: string }[] = LANGUAGE_CODES.map(
  (code) => ({ value: code, label: languageNames.of(code) ?? code }),
).toSorted((a, b) => a.label.localeCompare(b.label))

export const languageLabel = (code: string): string =>
  LANGUAGES.find((l) => l.value === code)?.label ?? code

/** Fewer than ten known values: a `Select`. */
export const ENVIRONMENTS = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'preview', label: 'Preview' },
  { value: 'development', label: 'Development' },
] as const

export const TEAMS = [
  { value: 'platform', label: 'Platform' },
  { value: 'payments', label: 'Payments' },
  { value: 'search', label: 'Search' },
  { value: 'growth', label: 'Growth' },
  { value: 'data', label: 'Data' },
] as const

export const TEAM_VALUES: readonly string[] = TEAMS.map((team) => team.value)
export const teamLabel = (value: string): string =>
  TEAMS.find((team) => team.value === value)?.label ?? value

export const STRATEGIES = [
  { value: 'rolling', label: 'Rolling', description: 'Replaces a few instances at a time.' },
  {
    value: 'blue-green',
    label: 'Blue-green',
    description: 'Switches traffic to a full copy at once.',
  },
  {
    value: 'canary',
    label: 'Canary',
    description: 'Sends a share of traffic first, then the rest.',
  },
] as const
export type Strategy = (typeof STRATEGIES)[number]['value']

export const EVENTS = [
  { value: 'deploy-started', label: 'A deploy starts' },
  {
    value: 'deploy-failed',
    label: 'A deploy fails',
    description: 'With the failing step and its log.',
  },
  { value: 'incident', label: 'An incident opens' },
  {
    value: 'digest',
    label: 'The weekly digest',
    description: 'Mondays at 9:00 in the workspace time zone.',
  },
] as const

/** Labels a service already carries somewhere; a new one is created by typing it. */
export const LABELS: readonly string[] = [
  'api',
  'batch',
  'critical',
  'customer-facing',
  'internal',
  'pci',
]

export const SIZES = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
  { value: 'xl', label: 'XL' },
] as const

export const later = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
