/**
 * `unwrap` — the transport-agnostic `{ data, error }` envelope (Eden Treaty, a raw fetch wrapper)
 * to data. Throws the `error` branch (any value that is not `null`/`undefined`) and, when there is
 * no error, on `null`/`undefined` data: a 204 or a silent transport failure must not resolve.
 *
 * One generic signature with a conditional return, so a bare `.then(unwrap)` callback keeps its
 * type (an overload pair resolves to `unknown` there). Pinned by `unwrap.type-guard.test.ts`.
 *
 * @example
 * queryFn: () => unwrap(api.users.get({ query: params }))
 * const rows = unwrap(await api.users.get())
 * const rows2 = await api.users.get().then(unwrap)
 */
export function unwrap<R extends Envelope | Promise<Envelope>>(response: R): UnwrapResult<R> {
  if (typeof (response as PromiseLike<Envelope>).then === 'function') {
    return (response as PromiseLike<Envelope>).then(unwrapEnvelope) as UnwrapResult<R>
  }
  return unwrapEnvelope(response as Envelope) as UnwrapResult<R>
}

type Envelope<TData = unknown> = { data: TData | null | undefined; error: unknown }

/** A `Promise<TData>` for a promised envelope, `TData` for a resolved one; `NonNullable` is applied
 * to the inferred `data` so it distributes over Eden's union of envelope shapes. */
type UnwrapResult<R> =
  R extends Promise<{ data: infer TData; error: unknown }>
    ? Promise<NonNullable<TData>>
    : R extends { data: infer TData; error: unknown }
      ? NonNullable<TData>
      : never

function unwrapEnvelope<TData>({ data, error }: Envelope<TData>): TData {
  if (error !== null && error !== undefined) throw error
  if (data === null || data === undefined)
    throw new Error(
      'unwrap: null/undefined data with no error — check for a 204 response or a transport failure',
    )
  return data
}
