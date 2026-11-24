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

/**
 * A subtree that formats under its own `locale`, `timeZone` or `messages`: every `useFormat` and
 * `useMessages` below it reads these instead of the provider's. `BasaltProvider` renders one for the
 * whole app.
 *
 * @useWhen one region (a preview, a print view, a fixed-locale page) must format differently from the app
 * @neverWhen the whole app takes one locale and zone (pass them to `BasaltProvider`), or one call needs another zone (pass it to that format call)
 *
 * @example
 * <IntlScope locale="de-DE" timeZone="Europe/Berlin">
 *   <InvoicePreview />
 * </IntlScope>
 */
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
