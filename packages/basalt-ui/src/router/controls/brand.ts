/**
 * The branded validator: a Standard Schema object that carries the store's id and scope under a
 * symbol. Route ownership reads the brand off `route.options.validateSearch`, so a store knows which
 * matched route runs it without reading any function's source. `extend()` keeps the brand; a hand
 * wrapper (`raw => migrate(store.validateSearch(raw))`) is a function and has none, which is why
 * `aliases` and `extend()` are the only ways to compose a store's validator.
 *
 * `types.input` is the PARTIAL search, so a typed `Link` to a route that runs the store needs no
 * key, while an undeclared key is still a type error.
 */

/** Present on every validator a store produced. `Symbol.for`, so two copies of the module agree. */
export const BRAND: unique symbol = Symbol.for('basalt.controls.validator') as never

export type Scope = 'global' | 'page'

export type Brand<Id extends string = string, Scp extends Scope = Scope> = {
  readonly id: Id
  readonly scope: Scp
}

export interface Branded<Id extends string = string, Scp extends Scope = Scope> {
  readonly [BRAND]: Brand<Id, Scp>
}

type Issue = { readonly message: string }

/** Standard Schema v1, declared structurally (the spec ships no runtime package). */
export interface StandardSchemaV1<I = unknown, O = I> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown,
    ) =>
      | { readonly value: O; readonly issues?: undefined }
      | { readonly issues: readonly Issue[] }
      | Promise<
          { readonly value: O; readonly issues?: undefined } | { readonly issues: readonly Issue[] }
        >
    readonly types?: { readonly input: I; readonly output: O } | undefined
  }
}

/** What `validateSearch` and `extend()` return: a branded Standard Schema with a partial input. */
export interface ControlsValidator<Id extends string, Scp extends Scope, In, Out> extends Branded<
  Id,
  Scp
> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: 'basalt'
    readonly validate: (value: unknown) => { readonly value: Out; readonly issues?: undefined }
    readonly types: { readonly input: In; readonly output: Out }
  }
}

/** The brand of a route's `validateSearch`, or `undefined` for a hand-written validator. */
export function brandOf(validator: unknown): Brand | undefined {
  if (validator === null) return undefined
  if (typeof validator !== 'object' && typeof validator !== 'function') return undefined
  return (validator as Partial<Branded>)[BRAND]
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

/** Builds the branded validator over a store's parse. `types` exists only at the type level. */
export function brandedValidator<Id extends string, Scp extends Scope, In, Out>(
  brand: Brand<Id, Scp>,
  parse: (raw: Record<string, unknown>) => Out,
): ControlsValidator<Id, Scp, In, Out> {
  return {
    '~standard': {
      version: 1,
      vendor: 'basalt',
      validate: (value) => ({ value: parse(asRecord(value)) }),
      types: undefined as never,
    },
    [BRAND]: brand,
  }
}

/**
 * The store's own params plus a foreign Standard Schema's (a zod object for `item`, `tab` of an
 * app-owned param). The store's values win on a shared key; an async or failing foreign schema
 * throws, which the router reports as a search error on that route.
 */
export function extendValidator<Id extends string, Scp extends Scope, In, Out, I, O>(
  own: ControlsValidator<Id, Scp, In, Out>,
  schema: StandardSchemaV1<I, O>,
): ControlsValidator<Id, Scp, In & I, Out & O> {
  return brandedValidator(own[BRAND], (raw) => {
    const foreign = schema['~standard'].validate(raw)
    if (foreign instanceof Promise) {
      throw new Error(`controls "${own[BRAND].id}": extend() takes a synchronous schema`)
    }
    if (foreign.issues) {
      throw new Error(foreign.issues.map((issue) => issue.message).join('; '))
    }
    const mine = own['~standard'].validate(raw).value
    return { ...asRecord(foreign.value), ...asRecord(mine) } as Out & O
  })
}
