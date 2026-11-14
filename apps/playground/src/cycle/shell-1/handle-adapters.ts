/**
 * cycle-shell-1: shell-1.3 — the adapter every `InnerNav` in this app goes through. Glue the kit
 * should own, counted in docs/v3/cycles/shell-1.md.
 *
 * `InnerNav` spreads `state.link(value)` onto an `<a>` and expects `{ href, onClick }`; a
 * `defineControls` field's `link(value)` returns TanStack link options (`{ search, replace,
 * resetScroll }`), so a bound item renders as an anchor with no `href`: not focusable, not
 * clickable. Its `history` is also typed `'push' | 'replace'`, which `InnerNav`'s `PushField`
 * refuses. This wraps the handle: a real `href` from the router, a click that writes the field, and
 * the narrowed `history`.
 */
import { useRouter } from '@tanstack/react-router'
import type { ControlHandle } from 'basalt-ui'
import type { MouseEvent } from 'react'

type Bindable = {
  readonly history: unknown
  use(): [string, (value: never) => void]
  link(value: never): { readonly search: unknown }
}

type ValueOf<H extends Bindable> = ReturnType<H['use']>[0]

type Bound<H extends Bindable> = Omit<H, 'history' | 'link'> & {
  readonly history: 'push'
  link(value: ValueOf<H>): {
    href: string
    onClick: (event: MouseEvent<HTMLAnchorElement>) => void
  }
}

export function useInnerNavState<H extends Bindable>(handle: H): Bound<H> {
  type V = ValueOf<H>
  const router = useRouter()
  const [, set] = handle.use() as [V, (value: V) => void]
  const link = (value: V) => ({
    href: router.buildLocation({
      to: '.',
      // cycle-shell-1: shell-1.3 — the field's own search patch is opaque (`unknown`) here.
      search: (prev: object) => ({ ...prev, ...(handle.link(value as never).search as object) }),
    } as never).href,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
      event.preventDefault()
      set(value)
    },
  })
  // Delegate to the handle so its getters (`isDefault`) stay live; override the two members.
  return Object.defineProperties(Object.create(handle) as Bound<H>, {
    history: { value: 'push' },
    link: { value: link },
  })
}

/**
 * cycle-shell-1: shell-1.2 — `PageAside` `state` takes a `ControlHandle<boolean>`, and the open
 * record is a string field (`deploy`), so this derives the boolean the aside wants: open while the
 * field holds an id; closing clears it. Opening is the row's job, so `set(true)` writes nothing.
 */
type Clearable = { use(): [string, (value: never) => void]; clear(): void }

export function asideStateOf(handle: Clearable): ControlHandle<boolean> {
  return Object.defineProperties(Object.create(handle) as ControlHandle<boolean>, {
    kind: { value: 'boolean' },
    options: { value: [] },
    useSource: { value: () => ({ source: 'own', inherited: undefined }) },
    use: {
      value: (): [boolean, (open: boolean) => void] => {
        const [value] = handle.use()
        return [value !== '', (open) => (open ? undefined : handle.clear())]
      },
    },
  })
}
