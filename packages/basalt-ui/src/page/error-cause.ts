import type { home } from '../core/messages/home'
import type { ErrorKind } from '../core/phase'

export const ERROR_KEYS = {
  forbidden: 'home.error.forbidden',
  'not-found': 'home.error.not-found',
  default: 'home.error.default',
} as const satisfies Record<ErrorKind | 'default', keyof typeof home>

/** The word of every Retry in the page kit: one reader of the key, so a localised app changes it once. */
export const RETRY_KEY = 'home.retry' as const satisfies keyof typeof home

/** What a failed query says: the kind's line, and the source's own message only when it has no kind. */
export function errorCause(
  kind: ErrorKind | undefined,
  message: string | undefined,
): { key: (typeof ERROR_KEYS)[ErrorKind | 'default']; detail: string | undefined } {
  return { key: ERROR_KEYS[kind ?? 'default'], detail: kind === undefined ? message : undefined }
}
