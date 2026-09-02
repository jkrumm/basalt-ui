/**
 * A12 — `queryOnline` narrowed from `boolean | null` to `boolean`. The old JSDoc claimed null meant
 * "QueryClient not mounted", but `getQueryOnline()` reads the module-level `onlineManager` singleton
 * and never returned null for that reason — the only null this field ever carried was the
 * pre-hydration SSR snapshot, which now reports an optimistic `true` instead (matching
 * `browserOnline`'s own SSR default), so `computeStatus`'s callers no longer branch on a state
 * `getQueryOnline()` could never actually produce.
 */
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConnectivityProvider } from './connectivity-provider'
import { useConnectivity } from './use-connectivity'
import type { ConnectivitySnapshot } from './connectivity-types'

/**
 * Compile-time proof that `queryOnline` is `boolean`, not `boolean | null` — this only type-checks
 * if the field was actually narrowed (a `boolean | null` value is not assignable to a `boolean`
 * return type). Never called for its return value; exercised below purely so it is not dead code.
 */
function readQueryOnlineAsBoolean(details: ConnectivitySnapshot['details']): boolean {
  return details.queryOnline
}

function Probe() {
  const { details } = useConnectivity()
  return <span data-testid="query-online">{String(readQueryOnlineAsBoolean(details))}</span>
}

function StatusProbe() {
  const { status } = useConnectivity()
  return <span data-testid="status">{status}</span>
}

describe('ConnectivityProvider — queryOnline is boolean, never null (A12)', () => {
  test('the pre-hydration/SSR snapshot reports queryOnline: true, optimistic like browserOnline', () => {
    const html = renderToStaticMarkup(
      <ConnectivityProvider>
        <Probe />
      </ConnectivityProvider>,
    )
    expect(html).toContain('true')
  })

  test('after hydration, queryOnline reads back from the real onlineManager singleton (true by default)', () => {
    const { getByTestId } = render(
      <ConnectivityProvider>
        <Probe />
      </ConnectivityProvider>,
    )
    expect(getByTestId('query-online').textContent).toBe('true')
  })

  test('override.queryOnline is typed boolean (no null branch) and flows through the aggregated snapshot', () => {
    const { getByTestId } = render(
      <ConnectivityProvider override={{ queryOnline: false }}>
        <Probe />
      </ConnectivityProvider>,
    )
    expect(getByTestId('query-online').textContent).toBe('false')
  })

  test('queryOnline: false alone degrades the aggregated status, browserOnline staying true', () => {
    const { getByTestId } = render(
      <ConnectivityProvider override={{ queryOnline: false }}>
        <StatusProbe />
      </ConnectivityProvider>,
    )
    expect(getByTestId('status').textContent).toBe('degraded')
  })
})
