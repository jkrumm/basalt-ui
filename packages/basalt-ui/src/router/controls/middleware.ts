/**
 * The middleware order of a store: `[strip, retain]`, fixed here. Reversed, `retain` copies an
 * array default (`regions=[]`) back into every bare link before `strip` can remove it (router-core
 * 1.171, gap-controls 5.1). A global retains all of its params; a page store retains only the keys
 * its `retain` names, so one store on a layout route keeps them across the children below it and
 * drops them on leaving the subtree. Widget `w.` keys are never retained.
 */
import { retainSearchParams } from '@tanstack/react-router'
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
