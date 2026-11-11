/**
 * `unwrap`: the transport-agnostic `{ data, error }` envelope (Eden Treaty, a raw fetch wrapper)
 * to data. Throws the `error` branch (any value that is not `null`/`undefined`) and, when there is
 * no error, on `null`/`undefined` data: a 204 or a silent transport failure must not resolve.
 * A fetch `TypeError` (the browser's offline failure) is rethrown as `NetworkError`, so the live
 * channel can tell a network failure from a shape error or a null-data throw.
 *
 * One generic signature with a conditional return, so a bare `.then(unwrap)` callback keeps its
 * type (an overload pair resolves to `unknown` there).
 */

/** The marker for a network failure: a `fetch` `TypeError`, kept as `cause`. Carries no `status`. */
export class NetworkError extends Error {
  override readonly name = 'NetworkError'

  constructor(cause: unknown) {
    super('Network request failed', { cause })
  }
}

const asNetworkError = (error: unknown): unknown =>
  error instanceof TypeError ? new NetworkError(error) : error

/**
 * Unwraps a `{ data, error }` envelope (or a promise of one) to its data, throwing the error branch,
 * and throwing on null data.
 *
 * @useWhen a queryFn or mutationFn calls a transport that returns `{ data, error }` envelopes
 * @neverWhen the call already throws on failure and never returns an envelope
 *
 * @example
 * ```ts
 * queryFn: () => unwrap(api.users.get({ query: params }))
 * const rows = await api.users.get().then(unwrap)
 * ```
 */
export function unwrap<R extends Envelope | PromiseLike<Envelope>>(response: R): UnwrapResult<R> {
  // `Promise.resolve` adopts any thenable, so the result is a real Promise. Only the transport's
  // own rejection maps to `NetworkError`; the unwrap throws below are the caller's.
  const result = isThenable(response)
    ? Promise.resolve(response).then(unwrapEnvelope, (error: unknown) => {
        throw asNetworkError(error)
      })
    : unwrapEnvelope(response)
  return result as UnwrapResult<R>
}

function isThenable(value: Envelope | PromiseLike<Envelope>): value is PromiseLike<Envelope> {
  return typeof (value as { then?: unknown }).then === 'function'
}

type Envelope<TData = unknown> = { data: TData | null | undefined; error: unknown }

/** A `Promise<TData>` for a promised envelope, `TData` for a resolved one; `NonNullable` is applied
 * to the inferred `data` so it distributes over Eden's union of envelope shapes. */
type UnwrapResult<R> =
  R extends PromiseLike<{ data: infer TData; error: unknown }>
    ? Promise<NonNullable<TData>>
    : R extends { data: infer TData; error: unknown }
      ? NonNullable<TData>
      : never

function unwrapEnvelope<TData>({ data, error }: Envelope<TData>): TData {
  if (error !== null && error !== undefined) throw asNetworkError(error)
  if (data === null || data === undefined)
    throw new Error(
      'unwrap: null/undefined data with no error. Check for a 204 response or a transport failure',
    )
  return data
}
