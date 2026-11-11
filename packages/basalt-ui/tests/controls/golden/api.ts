/**
 * The only door from the golden tests to the v3 controls API. `defineControls` and `field` do not
 * exist yet (the `./router` barrel carries no controls), so a named import of either is a link and
 * `tsc` error, not a `test.failing`. The barrel is imported as a namespace and cast to the shape
 * below; when ctl-2 lands the export, an absent function stops throwing and the `ctl2-*` tests flip.
 *
 * `ControlsApi` is local because `src/router/contract.ts` does not exist yet; once it does, replace
 * this declaration with `import type { ControlsApi } from '../../../src/router/contract'`.
 */
import type { ControlHandle } from '../../../src/core/ports'
import * as barrel from '../../../src/router'

type Spec = { kind: string; codec?: unknown; [k: string]: unknown }
type StandardSchemaLike = {
  '~standard': { validate(raw: unknown): { value?: Record<string, unknown>; issues?: unknown[] } }
}
type Middleware = (ctx: {
  search: Record<string, unknown>
  next: (s: Record<string, unknown>) => Record<string, unknown>
}) => Record<string, unknown>

export type ControlsStore = {
  id: string
  keys: readonly string[]
  validateSearch: StandardSchemaLike
  middlewares: readonly Middleware[]
  field: Record<string, ControlHandle<never> & { codec: unknown }>
  useValues(): Record<string, unknown>
  useActiveCount(): number
  useReset(): () => void
}

export type ControlsApi = {
  defineControls(def: {
    id: string
    scope: 'global' | 'page'
    resets?: readonly string[]
    retain?: readonly string[]
    fields: Record<string, Spec>
  }): ControlsStore
  field: {
    enum(values: readonly string[], fallback: string | (() => string), opts?: object): Spec
    multi(values: readonly string[], fallback?: readonly string[], opts?: object): Spec
    string(fallback: string | (() => string), opts?: object): Spec
    number(opts?: object, lane?: object): Spec
    boolean(fallback: boolean, opts?: object): Spec
    range(opts: object): Spec
  }
}

export const api = barrel as unknown as ControlsApi

/** One field handle by name; throws a readable error when the store lacks it. */
export function handle(
  store: ControlsStore,
  name: string,
): ControlsStore['field'][string] & object {
  const h = store.field[name]
  if (!h) throw new Error(`store ${store.id} has no field ${name}`)
  return h
}

/** The validated value of one key, or undefined when validation produced no value. */
export function validated(store: ControlsStore, raw: unknown, name: string): unknown {
  return store.validateSearch['~standard'].validate(raw).value?.[name]
}
