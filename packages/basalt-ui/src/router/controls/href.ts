/**
 * `useHref` of a `defineControls` field handle: each value's href, built by the router from the
 * current location, so the app's search middlewares apply. `InnerNav` draws its anchors from it,
 * which keeps `basalt-ui/page` free of the router. Off the router the returned function throws.
 */
import { useRouter } from '@tanstack/react-router'

type Raw = Record<string, unknown>
type HrefRouter = {
  buildLocation(options: { to: '.'; search: (prev: Raw) => Raw }): { href: string }
}

/** The router or none, without TanStack's warning: the href builder throws its own error. */
const useOptionalRouter = useRouter as unknown as (options: {
  warn: false
}) => HrefRouter | undefined

/** The `useHref` hook of one field: `patchOf(value)` is the search a click on its link writes. */
export function hrefHook<V>(
  store: string,
  field: string,
  patchOf: (value: V) => Raw,
): () => (value: V) => string {
  return function useHref() {
    const router = useOptionalRouter({ warn: false })
    return (value) => {
      if (router === undefined) {
        throw new Error(
          `basalt-ui: controls "${store}": the href of field "${field}" is built by the router; ` +
            'render it inside a `RouterProvider`',
        )
      }
      const patch = patchOf(value)
      return router.buildLocation({ to: '.', search: (prev) => ({ ...prev, ...patch }) }).href
    }
  }
}
