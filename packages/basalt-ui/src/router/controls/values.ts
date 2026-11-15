import type { FieldSpec } from './field'

/** What `store.useValues()` returns: each URL field under its key, as its handle's `use()` returns it. */
export type ValuesOf<F> = Flatten<{
  [
    K in keyof F & string as F[K] extends { readonly lane: { readonly url: false } } ? never : K
  ]: F[K] extends FieldSpec<infer V> ? V : never
}>

type Flatten<T> = { [K in keyof T]: T[K] } & {}

/** `{ window }` exists only while a preset has no resolver; with every preset resolved it is dates. */
export type WindowOf<Unresolved extends string> = [Unresolved] extends [never]
  ? { from: string; to: string }
  : { window: Unresolved } | { from: string; to: string }
