/**
 * Claims: identity-keyed region claims (docs/v3/concepts/shell-nav-router.md section 4, invariants
 * 20, 21, 23). Headless: a tiny external store with no React, so a component reads it with
 * `useSyncExternalStore(store.subscribe, store.getSnapshot)` and the lifecycle is unit-testable.
 *
 * A region (the aside, the page band, the header's one kebab) is claimed by components that mount
 * and unmount in any order: a route change mounts the incoming page's claim before the outgoing
 * page's cleanup runs. Three rules make that safe:
 *
 * - **Identity, not id.** Every `claim()` is its own entry, even for an id already claimed. Its
 *   handle can release or update that entry only, so a stale cleanup never removes a later claim
 *   with the same id (a StrictMode double mount, a remount).
 * - **Idempotent release.** A second `release()` is a no-op, so a kebab count never goes negative.
 * - **No late resurrection.** `update()` after `release()` is a no-op, so a fold published late
 *   cannot bring back the state of an aside that already left.
 *
 * Who owns the region while several claims are live is the `policy`: `'newest'` (the aside: the
 * incoming page's claim wins during a transition, and the previous one owns again once it leaves)
 * or `'oldest'` (the page bar: a second bar under one `Page` is the extra one and renders nothing).
 * A second live claim raises the dev assertion once.
 */

export type ClaimPolicy = 'newest' | 'oldest'

export type ClaimEntry<V> = { readonly id: string; readonly value: V }

export type ClaimSnapshot<V> = {
  /** Live claims in claim order. */
  readonly entries: readonly ClaimEntry<V>[]
  /** The claim that owns the region under the policy; `undefined` while unclaimed. */
  readonly owner: ClaimEntry<V> | undefined
  /** Live claim count: the kebab's claim count. */
  readonly count: number
}

export type ClaimHandle<V> = {
  /** Removes this claim only. A second call does nothing. */
  release: () => void
  /** Replaces this claim's value. Does nothing once released, or when the value is unchanged. */
  update: (value: V) => void
  /** Whether this claim currently owns the region. */
  isOwner: () => boolean
}

export type ClaimStore<V> = {
  claim: (id: string, value: V) => ClaimHandle<V>
  subscribe: (listener: () => void) => () => void
  /** Referentially stable until a claim is added, removed or updated. */
  getSnapshot: () => ClaimSnapshot<V>
}

export type ClaimStoreOptions = {
  policy: ClaimPolicy
  /** Called once, when a second claim is live at the same time. */
  onConflict?: () => void
}

/** Dev-only assertion that raises its message once per returned function. Silent in production. */
export function devAssertOnce(message: string): () => void {
  let raised = false
  return () => {
    if (process.env.NODE_ENV === 'production' || raised) return
    raised = true
    // eslint-disable-next-line no-console -- dev-only diagnostic
    console.warn(message)
  }
}

type Live<V> = { id: string; value: V }

export function createClaimStore<V = undefined>(options: ClaimStoreOptions): ClaimStore<V> {
  const { policy, onConflict } = options
  let live: readonly Live<V>[] = []
  let snapshot = project()
  let conflicted = false
  const listeners = new Set<() => void>()

  function project(): ClaimSnapshot<V> {
    const entries = live.map((c): ClaimEntry<V> => ({ id: c.id, value: c.value }))
    const owner = policy === 'newest' ? entries.at(-1) : entries[0]
    return { entries, owner, count: entries.length }
  }

  function commit(next: readonly Live<V>[]): void {
    live = next
    snapshot = project()
    if (!conflicted && live.length > 1) {
      conflicted = true
      onConflict?.()
    }
    for (const listener of listeners) listener()
  }

  function claim(id: string, value: V): ClaimHandle<V> {
    const token: Live<V> = { id, value }
    commit([...live, token])
    // Replacing a token by identity keeps its position, so an update never reorders ownership.
    let current = token
    return {
      release() {
        if (!live.includes(current)) return
        commit(live.filter((c) => c !== current))
      },
      update(next) {
        if (!live.includes(current) || Object.is(current.value, next)) return
        const replaced: Live<V> = { id, value: next }
        commit(live.map((c) => (c === current ? replaced : c)))
        current = replaced
      },
      isOwner() {
        const at = policy === 'newest' ? live.at(-1) : live[0]
        return at !== undefined && at === current
      },
    }
  }

  return {
    claim,
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
  }
}

/** The aside region: the newest claim owns it; its value is the claimant's fold state. */
export function createAsideClaims(): ClaimStore<boolean> {
  return createClaimStore<boolean>({
    policy: 'newest',
    onConflict: devAssertOnce(
      '[basalt] more than one PageAside is mounted at once; the newest claimant owns the region. Render one per page.',
    ),
  })
}

/**
 * The page bar under one `Page`: the first bar owns it and a second renders nothing. Nested
 * layouts that each render a `PageBar` land here.
 */
export function createBarClaims(): ClaimStore<undefined> {
  return createClaimStore<undefined>({
    policy: 'oldest',
    onConflict: devAssertOnce(
      '[basalt] more than one PageBar is mounted under one Page; the first owns the band and the others render nothing. Render one per page.',
    ),
  })
}

/** Whether the aside region is folded: the owner's published fold, `false` when unclaimed. */
export function asideFolded(snapshot: ClaimSnapshot<boolean>): boolean {
  return snapshot.owner?.value === true
}
