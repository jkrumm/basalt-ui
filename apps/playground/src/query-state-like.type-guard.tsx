// The compile-time regression guard for `QueryStateLike` (`packages/basalt-ui/CLAUDE.md` states it
// as an invariant: "a composed, derived or hand-rolled result must be passable without a cast").
// Only the runtime half (`assertQueryStateLike`) had a test before this file — this pins the
// STRUCTURAL half: a hand-rolled object with the five required fields (plus one extra a real
// `UseQueryResult` also carries, `isPending`, proving excess fields don't break assignability
// through a variable) reaches every one of the four consumers with no cast.
import type { ReactNode } from 'react'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/data/table'
import { QueryState, Section, StatCard } from 'basalt-ui'

type Row = { name: string; cost: number }

// A hand-composed result — never a real UseQueryResult — carrying every QueryStateLike field plus
// one real TanStack fields (`isPending`) it doesn't declare.
const handRolled = {
  data: [{ name: 'a', cost: 1 }] as Row[] | undefined,
  isPending: false,
  isError: false,
  error: null as unknown,
  fetchStatus: 'idle' as const,
  refetch: (): unknown => undefined,
}

const col = createColumnHelper<Row>()
const columns = [col.accessor('name', { header: 'Name' }), col.accessor('cost', { header: 'Cost' })]

export function Consumers(): ReactNode {
  return (
    <>
      <QueryState query={handRolled}>{(rows) => <span>{rows.length}</span>}</QueryState>
      <Section title="Rows" query={handRolled}>
        <span>body</span>
      </Section>
      <BasaltDataTable data={handRolled.data ?? []} columns={columns} query={handRolled} />
      <StatCard title="Rows" value={String(handRolled.data?.length ?? 0)} query={handRolled} />
    </>
  )
}

// Dropping `refetch` must fail every one of the same four call sites. Pinned on ALL FOUR rather
// than once: they widen the same `QueryStateLike<unknown>` today, but each reaches it through its
// own props type, and "the others would have failed too" is a claim about inference that a single
// directive cannot make. A `@ts-expect-error` that stops erroring is itself a tsc error, so the
// four together also fail loudly if any one of them stops taking a query at all.
const noRefetch = {
  data: undefined as Row[] | undefined,
  isError: false,
  error: null as unknown,
  fetchStatus: 'idle' as const,
}

export function MissingRefetch(): ReactNode {
  return (
    <>
      {/* @ts-expect-error QueryStateLike requires `refetch()` — this object has none */}
      <QueryState query={noRefetch}>{() => null}</QueryState>
      {/* @ts-expect-error QueryStateLike requires `refetch()` — this object has none */}
      <Section title="Rows" query={noRefetch}>
        <span>body</span>
      </Section>
      <BasaltDataTable
        data={[]}
        columns={columns}
        // @ts-expect-error QueryStateLike requires `refetch()` — this object has none
        query={noRefetch}
      />
      {/* @ts-expect-error QueryStateLike requires `refetch()` — this object has none */}
      <StatCard title="Rows" value="0" query={noRefetch} />
    </>
  )
}

// PROVES: QueryStateLike's five-field structural subset accepts a hand-rolled result with no cast
// across all four readers (QueryState, Section, BasaltDataTable, StatCard), and a missing `refetch`
// is a tsc error at every one of those four rather than a silent "Retry does nothing" at runtime.
