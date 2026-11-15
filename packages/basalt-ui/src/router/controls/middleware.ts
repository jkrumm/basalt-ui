/**
 * The middleware order of a store: `[strip, retain]`, fixed here. Reversed, `retain` copies an
 * array default (`regions=[]`) back into every bare link before `strip` can remove it (router-core
 * 1.171, gap-controls 5.1). A global retains all of its params; a page store retains only the keys
 * its `retain` names, so one store on a layout route keeps them across the children below it and
 * drops them on leaving the subtree. Widget `w.` keys are never retained.
 */
import { retainSearchParams, stripSearchParams } from '@tanstack/react-router'
import type { Raw } from './codec'
import type { AnyMiddleware } from './define'
import type { Scope } from './brand'

export type MiddlewareContext = {
  readonly id: string
  readonly scope: Scope
  readonly keys: readonly string[]
  readonly retain?: readonly string[] | undefined
}

/** The params the store keeps across navigations. */
export function retainedKeys(ctx: MiddlewareContext): readonly string[] {
  if (ctx.scope === 'global') return ctx.keys
  const retain = ctx.retain ?? []
  for (const key of retain) {
    if (!ctx.keys.includes(key)) {
      throw new Error(
        `basalt-ui: controls "${ctx.id}": retain names "${key}", which is not a URL param of the store`,
      )
    }
  }
  return retain
}

/** `[strip, retain]`, or `[strip]` when nothing is retained. */
export function orderMiddlewares(strip: AnyMiddleware, ctx: MiddlewareContext): AnyMiddleware[] {
  const keys = retainedKeys(ctx)
  if (keys.length === 0) return [strip]
  return [strip, retainSearchParams([...keys]) as unknown as AnyMiddleware]
}

/**
 * Reserved search key: a write of a push enum's fallback names the field here, so `strip` keeps
 * the value; `strip` removes the key itself, so it never reaches a URL.
 */
export const KEEP_KEY = '~keep'

type WithMeta = (search: Raw, collectMeta: true) => { search: Raw; meta: { explicit?: Raw } }
type StripContext = { search: Raw; next: WithMeta }

/**
 * `stripSearchParams(defaults)` with one exception: a push enum the user chose keeps its fallback
 * (`?section=general`), so the choice is in the URL and `useIsSet()` reads it. Chosen means the
 * write named it in `KEEP_KEY`, or the param is already in the address bar and the navigation did
 * not unset it (`meta.explicit` is what the navigation itself wrote, before validation refilled
 * every default): a change to another field must not close the pane, `clear()` must.
 */
export function chosenStrip(options: {
  defaults: Raw
  choices: readonly { name: string; params: readonly string[] }[]
  inUrl: (param: string) => boolean
}): AnyMiddleware {
  const { defaults, choices, inUrl } = options
  return ((context: StripContext) => {
    // The same `next(search, true)` protocol `retainSearchParams` uses, in this store's own chain.
    const { search: out, meta } = context.next(context.search, true)
    const { [KEEP_KEY]: marked, ...result } = out
    const named = Array.isArray(marked) ? (marked as string[]) : []
    const { explicit } = meta
    const standing = (p: string): boolean =>
      inUrl(p) && (explicit === undefined || explicit[p] !== undefined)
    const kept = new Set(
      choices
        .filter((c) => named.includes(c.name) || c.params.some(standing))
        .flatMap((c) => c.params),
    )
    const removable = Object.fromEntries(Object.entries(defaults).filter(([p]) => !kept.has(p)))
    const strip = stripSearchParams(removable as never) as unknown as AnyMiddleware
    return strip({ search: result, next: (search: unknown) => search } as never)
  }) as unknown as AnyMiddleware
}
