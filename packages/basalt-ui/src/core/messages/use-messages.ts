/**
 * `useMessages(area)`: the text of one area, with the app's overrides applied. Internal; apps
 * override through the provider's `messages` prop and never call this.
 *
 * `area` is the area's own defaults object (`useMessages(table)`), so the key and argument types come
 * from the defaults and a part imports only the area it reads.
 */
import { useMemo } from 'react'
import { useFormat } from '../format'
import type { Format } from '../format'
import { useIntl } from '../provider-props'
import type { BasaltMessages } from './index'

type ArgsOf<M> = M extends (f: Format, ...a: infer P) => string ? P : []

export type Translate<A> = <K extends Extract<keyof A, string>>(
  key: K,
  ...args: ArgsOf<Exclude<A[K], undefined>>
) => string

export function useMessages<A extends Partial<BasaltMessages>>(area: A): Translate<A> {
  const format = useFormat()
  const overrides = useIntl().messages as Record<string, unknown> | undefined
  return useMemo(() => {
    const defaults = area as Record<string, unknown>
    return ((key: string, ...args: unknown[]) => {
      const msg = overrides?.[key] ?? defaults[key]
      return typeof msg === 'function'
        ? (msg as (f: Format, ...a: unknown[]) => string)(format, ...args)
        : String(msg)
    }) as Translate<A>
  }, [area, overrides, format])
}
