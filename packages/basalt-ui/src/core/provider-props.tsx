/**
 * The provider's formatting props as plain data: `locale`, `timeZone` and `messages`.
 *
 * This module holds a context and nothing that formats. It imports no `Intl` cache, no message table
 * and no catalog (the messages type is erased), so the provider chunk can carry it inside its 5 KB
 * cap; `useFormat` builds the formatter lazily from these values and `useMessages` merges the
 * overrides over each area's English defaults. `BasaltProvider` renders `IntlScope` with its own
 * `locale`, `timeZone` and `messages` props.
 */
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { BasaltMessages } from './messages'

export type BasaltIntlProps = {
  /** BCP 47 tag the formatters and plural rules read. Default `en`. */
  locale?: string
  /** IANA zone dates print in. Default `UTC`; `'host'` is the runtime's zone. */
  timeZone?: string
  /** Overrides over the English defaults, by key. A missing key keeps its English text. */
  messages?: Partial<BasaltMessages>
}

export type IntlContextValue = BasaltIntlProps

const IntlContext = createContext<IntlContextValue>({})

/** The provider's formatting props; all unset outside a provider, which means English and UTC. Internal. */
export function useIntl(): IntlContextValue {
  return useContext(IntlContext)
}

export function IntlScope({
  locale,
  timeZone,
  messages,
  children,
}: BasaltIntlProps & { children?: ReactNode }): ReactNode {
  const value = useMemo<IntlContextValue>(
    () => ({
      ...(locale !== undefined && { locale }),
      ...(timeZone !== undefined && { timeZone }),
      ...(messages !== undefined && { messages }),
    }),
    [locale, timeZone, messages],
  )
  return <IntlContext value={value}>{children}</IntlContext>
}
