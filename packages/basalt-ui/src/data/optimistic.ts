/**
 * `optimistic`: the handlers an optimistic `useMutation` needs, as one spread. Mutations sharing a
 * `scope` run serially, every handler reads the client from the mutation context (nothing is
 * closed over), and the final settle is the only one that invalidates, so two overlapping writes
 * cannot refetch one another's optimistic state away.
 */
import { hashKey } from '@tanstack/react-query'
import type { MutationFunctionContext, MutationKey, QueryKey } from '@tanstack/react-query'

type OptimisticTarget<V> = {
  /** The cache entry to update, matched exactly. */
  queryKey: QueryKey
  /** The next cached value from the current one and the mutation variables. */
  apply(prev: unknown, variables: V): unknown
}

type OptimisticOptions<V> = {
  /** Identifies this resource's mutations: `isMutating` counts only mutations carrying it. */
  key: MutationKey
  /** Serial-execution group. Defaults to the hashed `key`. */
  scope?: string
  /** The cache entries written ahead of the server. An entry with no cached data is skipped. */
  targets: readonly OptimisticTarget<V>[]
}

type Snapshot = { queryKey: QueryKey; previous: unknown; written: unknown }

type OptimisticHandlers<V> = {
  mutationKey: MutationKey
  scope: { id: string }
  onMutate: (variables: V, context: MutationFunctionContext) => Promise<readonly Snapshot[]>
  onError: (
    error: unknown,
    variables: V,
    snapshots: readonly Snapshot[] | undefined,
    context: MutationFunctionContext,
  ) => void
  onSettled: (
    data: unknown,
    error: unknown,
    variables: V,
    snapshots: readonly Snapshot[] | undefined,
    context: MutationFunctionContext,
  ) => Promise<void>
}

/**
 * Optimistic cache writes for one mutation: cancel, snapshot, write; restore on error; invalidate
 * the targets when the last mutation with this key settles.
 *
 * Spread it into `useMutation` so the returned `mutationKey` and `scope` come with the handlers:
 * without the key, `isMutating()` counts every pending mutation in the app and the invalidate never
 * runs. A restore is skipped when a later optimistic write has since replaced the value, and the
 * final settle's invalidate corrects it.
 *
 * @useWhen a mutation should show its result in the cache before the server answers
 * @neverWhen the server response is the first honest state (use a plain mutation and invalidate)
 *
 * @example
 * ```ts
 * const rename = useMutation({
 *   mutationFn: (title: string) => unwrap(api.runs({ id }).patch({ title })),
 *   ...optimistic<string>({
 *     key: ['run', id],
 *     targets: [{ queryKey: ['run', id], apply: (prev, title) => ({ ...(prev as Run), title }) }],
 *   }),
 * })
 * ```
 */
export function optimistic<V>(options: OptimisticOptions<V>): OptimisticHandlers<V> {
  const { key, targets } = options
  const scope = { id: options.scope ?? hashKey(key) }

  return {
    mutationKey: key,
    scope,
    async onMutate(variables, { client }) {
      const snapshots: Snapshot[] = []
      for (const { queryKey, apply } of targets) {
        await client.cancelQueries({ queryKey, exact: true })
        const previous = client.getQueryData(queryKey)
        if (previous === undefined) continue
        client.setQueryData(queryKey, apply(previous, variables))
        // Read back: structural sharing may store a different reference than the one passed in.
        snapshots.push({ queryKey, previous, written: client.getQueryData(queryKey) })
      }
      return snapshots
    },
    onError(_error, _variables, snapshots, { client }) {
      for (const { queryKey, previous, written } of snapshots ?? []) {
        if (client.getQueryData(queryKey) === written) client.setQueryData(queryKey, previous)
      }
    },
    async onSettled(_data, _error, _variables, _snapshots, { client }) {
      // The current mutation still counts while its own onSettled runs, so 1 means the last one.
      if (client.isMutating({ mutationKey: key }) !== 1) return
      await Promise.all(
        targets.map(({ queryKey }) => client.invalidateQueries({ queryKey, exact: true })),
      )
    },
  }
}
