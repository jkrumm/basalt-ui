/**
 * Compile-time proof of the page kit's guarantees, checked by `tsc --noEmit`. Every
 * `@ts-expect-error` is one "never": remove the line and the file stops compiling. The valid usage
 * above each group proves the guards fail for the stated reason and not because the props are wrong
 * everywhere.
 */
import type { ReactElement } from 'react'
import { CardGrid } from './card-grid'
import { defineOverlays } from './define-overlays'
import { EmptyState } from './empty-state'
import { OverlayHost } from './overlay-host'
import { PageSummary } from './page-summary'
import { QueryState } from './query-state'

export const validGrid: ReactElement = <CardGrid min="regular" />

export const gridColumns: ReactElement = (
  // @ts-expect-error a grid takes a closed min, never a column count
  <CardGrid columns={3} />
)

export const gridCols: ReactElement = (
  // @ts-expect-error a grid takes a closed min, never a column count
  <CardGrid cols={{ base: 1, md: 2 }} />
)

export const gridPixelMin: ReactElement = (
  // @ts-expect-error min is a container tier, not a length
  <CardGrid min="320px" />
)

export const gridClassName: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <CardGrid className="grid-cols-3" />
)

export const validEmpty: ReactElement = <EmptyState why="No runs yet." />

export const emptyWithoutWhy: ReactElement = (
  // @ts-expect-error an empty state states its cause: `why` is required
  <EmptyState />
)

export const emptyTitleOnly: ReactElement = (
  // @ts-expect-error the cause is `why`, not a `title`
  <EmptyState title="No data" />
)

export const emptyTwoActions: ReactElement = (
  // @ts-expect-error the filtered variant renders Clear filters instead of an action
  <EmptyState why="x" action={{ label: 'a', href: '/' }} filtered={{ reset: () => {} }} />
)

export const validSummary: ReactElement = <PageSummary sentence="3 open" facts={['a', null]} />

export const summaryLoadingBare: ReactElement = <PageSummary loading />

export const summaryWithoutSentence: ReactElement = (
  // @ts-expect-error a loaded summary needs its sentence
  <PageSummary facts={['a']} />
)

export const validQuery: ReactElement = <QueryState phase="loading">x</QueryState>

export const queryWithoutPhase: ReactElement = (
  // @ts-expect-error QueryState reads a phase, never a bare data array
  <QueryState>x</QueryState>
)

const OVERLAYS = defineOverlays({
  'user:edit': { title: 'Edit', render: (p: { id: string }) => <p>{p.id}</p> },
  'logs:filter': { title: 'Filter', as: 'sheet', render: () => <p>f</p> },
})

OVERLAYS.open('user:edit', { id: '1' })
OVERLAYS.open('logs:filter')
// @ts-expect-error unknown overlay key
OVERLAYS.open('user:delete', { id: '1' })
// @ts-expect-error a wrong payload
OVERLAYS.open('user:edit', { id: 1 })
// @ts-expect-error a payload is required where the body reads one
OVERLAYS.open('user:edit')

export const validHost: ReactElement = <OverlayHost overlays={OVERLAYS} />

export const hostKnownKey: ReactElement = (
  <OverlayHost overlays={OVERLAYS} defaultOpen={{ key: 'user:edit', props: { id: '1' } }} />
)

export const hostUnknownKey: ReactElement = (
  // @ts-expect-error OverlayHost mounted with a key the registry does not define
  <OverlayHost overlays={OVERLAYS} defaultOpen={{ key: 'user:delete', props: { id: '1' } }} />
)

export const hostRawMap: ReactElement = (
  // @ts-expect-error the host takes what defineOverlays returned, not a raw map
  <OverlayHost overlays={{ 'user:edit': { title: 'x', render: () => null } }} />
)

defineOverlays({
  // @ts-expect-error an overlay needs its title: the dialog is named by it
  bad: { render: () => null },
})
