/**
 * Design seam — the augmentable BasaltRegister interface, the single Slot extractor, house-style
 * primitives (AsyncState, assertNever), and the vendored Standard Schema v1 contract.
 *
 * Re-exported from the root barrel '.' so `declare module 'basalt-ui'` augmentation works.
 * Imports nothing.
 */

// ── BasaltRegister + Slot ─────────────────────────────────────────────────────────────────────────

/**
 * The one augmentable seam — TanStack Router/Query's `interface Register {}` applied to the whole
 * app shape. Declaration-merge your truth ONCE per concern, in that concern's own file. Every slot
 * is optional and defaults to a never-keyed empty type; an app that augments nothing pays zero cost.
 * The slot read today is `notifications`. There is no series slot: a chart
 * series `key` is the data's own name, and its colour is the pair from the app's series file.
 *
 * @example
 * // src/lib/notifications.ts — augment ONE slot in its own file, 3 lines:
 * declare module 'basalt-ui' {
 *   interface BasaltRegister { notifications: { deploy: { sha: string } } }
 * }
 */
export interface BasaltRegister {}

/**
 * Extract a slot or fall back to the NEVER-KEYED EMPTY OBJECT `{}`.
 *
 * WHY `{}` AND NOT `Record<string, never>`:
 * `keyof {}` is `never` (correct — an un-augmented slot has no keys).
 * `keyof Record<string, never>` is `string` — silent widening that would accept every string as a
 * 'legal' key (the TS footgun). The `{}` default is baked into this one place and locked by
 * fixture J.1 / J.2.
 *
 * `infer S extends Constraint` is a BOUND-CHECK, not a cast — an ill-typed augment falls through
 * to `{}` rather than poisoning the union. This ONE generic is the frozen mechanism every battery
 * slot instantiates against. The slot basalt reads today is `notifications` (core/notify.ts).
 *
 * **Indexed-access form, not a mapped-type structural match (C5 consolidation)** — this used to
 * read `BasaltRegister extends { [P in K]: infer S extends Constraint } ? S : {}`, which forces
 * TS to structurally match the WHOLE `BasaltRegister` interface (every augmented slot's VALUE
 * type, not just `K`'s) before it can answer "does slot `K` exist". That is the commands↔overlays
 * cycle argo's `lib/overlays.tsx` documents: `defineCommands`'s inferred type has to type-check a
 * command `run` body calling `overlays.open(…)`, which resolves `Slot<'overlays', …>` — and the
 * OLD form's whole-interface match ALSO had to resolve `BasaltRegister['commands']`
 * (`typeof COMMANDS`, the very type still being computed) to complete the match, because a
 * mapped-type pattern binds every property simultaneously. `K extends keyof BasaltRegister` only
 * needs the augmented KEY NAMES (available from declaration merging with no value-type checking
 * at all), and `BasaltRegister[K]` then touches ONLY that one slot's value — so resolving
 * `overlays` never has to resolve `commands` first, and a consumer can define both registries,
 * with one calling the other's imperative controller, in a SINGLE file. Behaviourally identical to
 * the old form for every existing augmentation (fixture J.1/J.2 pin the `{}` fallback); ONLY the
 * internal resolution path changed.
 */
export type Slot<K extends string, Constraint> = K extends keyof BasaltRegister
  ? BasaltRegister[K] extends Constraint
    ? BasaltRegister[K]
    : {}
  : {}

// ── AsyncState + assertNever ──────────────────────────────────────────────────────────────────────

/**
 * The house discriminated-union shape — N valid states, not 2ⁿ. `data` is present ONLY in
 * 'success', `error` ONLY in 'error'. The shape AgentPart / notification kinds / command results
 * copy in later phases.
 *
 * @example
 * function view<T>(s: AsyncState<T>) {
 *   switch (s.status) {
 *     case 'idle':    return null
 *     case 'loading': return <Spinner/>
 *     case 'success': return <Data value={s.data}/>
 *     case 'error':   return <Err e={s.error}/>
 *     default:        return assertNever(s) // tsc errors here if a variant is unhandled
 *   }
 * }
 */
export type AsyncState<T, E = Error> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: T }
  | { readonly status: 'error'; readonly error: E }

/**
 * Exhaustiveness sentinel. A bare `default: return null` is FORBIDDEN house-style. The `never`
 * param turns an unhandled union member into a compile error.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated-union variant: ${JSON.stringify(value)}`)
}

// ── Standard Schema v1 (vendored spec — not a package dependency) ─────────────────────────────────

/**
 * The published Standard Schema v1 `~standard` contract, vendored verbatim. It is a SPEC, not a
 * package; ~25 lines, zero deps. Zod 4 / Valibot / ArkType all implement `~standard` and are
 * assignable. Every validation boundary (createPersistedState, future form resolver, route search,
 * agent payloads) types against THIS — never `ZodSchema`. Basalt invents ZERO validation
 * primitive.
 *
 * EDEN-TREATY SEAM (house-style DOCTRINE — basalt ships no treaty wiring; that lands in the
 * Phase-4 ./query battery). The seam is a `typeof` seam, never codegen:
 *   export type App = typeof app      // Elysia app
 *   const api = treaty<App>(url)       // Eden infers the whole API from the type
 *
 * THREE silent-`any` footguns — each drops a type to `any` with NO error:
 *   1. Elysia routes MUST be method-chained (`app.get(...).post(...)`) — a non-chained route
 *      silently drops App to `any`.
 *   2. Client & server tsconfig path aliases MUST match — a mismatch erases the inferred types.
 *   3. An `async function*` STREAM route MUST declare `: AsyncGenerator<AgentPart>` and carry NO
 *      t.Object/t.Union response schema (eden #231) — the inner union drops to `any`. Validate at
 *      yield-time.
 *
 * @example
 * // createPersistedState with Standard Schema validation:
 * createPersistedState({ key: 'draft', version: 1, initial: DEFAULT, schema: z.object({ title: z.string() }) })
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>
}

export namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>
    readonly types?: Types<Input, Output> | undefined
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult

  export interface SuccessResult<Output> {
    readonly value: Output
    readonly issues?: undefined
  }

  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>
  }

  export interface Issue {
    readonly message: string
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined
  }

  export interface PathSegment {
    readonly key: PropertyKey
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input
    readonly output: Output
  }

  export type InferInput<T extends StandardSchemaV1> = NonNullable<T['~standard']['types']>['input']
  export type InferOutput<T extends StandardSchemaV1> = NonNullable<
    T['~standard']['types']
  >['output']
}
