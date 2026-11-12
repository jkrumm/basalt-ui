/**
 * The probes of the `controls-filter-set` fixture (docs/v3/issues/g1/v3-ctl-5-filterset.json),
 * shared by the client entry and the SSR entry so both draw the same tree. Each probe is a
 * `data-testid` box:
 *
 * - `fs-8`: eight filters with long labels and long values, filling the width;
 * - `fs-3`: three that fit a desktop row;
 * - `fs-0`: none, which draws nothing;
 * - `fs-w560`: the same eight in a 560 px box, so the fold is forced on a desktop and a tablet;
 * - `fs-bar`: a `FilterSet` beside a button, the sibling whose position must not move after hydration;
 * - `fs-aside`: three filters in an `aside` home, drawn as stacked rows.
 *
 * Three of the eight are off their default, so `Filters (3)` is the count everywhere.
 */
import type { ReactElement, ReactNode } from 'react'
import { ControlHome } from '../../../src/controls/control-home'
import { memoryHandle } from '../../../src/controls/control-view.handles'
import { FilterSet } from '../../../src/controls/filter-set'
import { spec } from '../../../src/controls/spec'
import { Button } from '../../../src/ui/button'

const REGIONS = [
  { value: 'eu', label: 'Europe, Middle East and Africa' },
  { value: 'us', label: 'United States and Canada' },
  { value: 'ap', label: 'Asia Pacific (Tokyo, Singapore, Sydney)' },
]
const TIERS = [
  { value: 'free', label: 'Free' },
  { value: 'team', label: 'Team subscription with annual billing' },
  { value: 'legacy', label: 'Legacy plan (archived)', disabled: true },
]

function eight(id: string) {
  const env = memoryHandle(`${id}.env`, 'prod', {
    kind: 'enum',
    options: [
      { value: 'prod', label: 'Production deployment' },
      { value: 'staging', label: 'Staging deployment with preview data' },
    ],
  })
  env.put('staging')
  const regions = memoryHandle<readonly string[]>(`${id}.regions`, [], {
    kind: 'multi',
    options: REGIONS as never,
  })
  regions.put(['eu', 'us'])
  const q = memoryHandle(`${id}.q`, '', { kind: 'string' })
  q.put('latency regression')
  return [
    spec(env, 'Environment of the deployment'),
    spec(regions, 'Operating regions worldwide'),
    spec(q, 'Search the full text', { placeholder: 'Search the full text' }),
    spec(
      memoryHandle(`${id}.tier`, 'free', { kind: 'enum', options: TIERS as never }),
      'Subscription tier',
    ),
    spec(
      memoryHandle(`${id}.limit`, 20, { kind: 'number', bounds: { min: 1, max: 100, int: true } }),
      'Maximum rows per page',
    ),
    spec(memoryHandle(`${id}.live`, true, { kind: 'boolean' }), 'Live updates'),
    spec(
      memoryHandle(`${id}.view`, 'all', {
        kind: 'enum',
        options: [
          { value: 'all', label: 'Everything' },
          { value: 'errors', label: 'Errors only' },
        ],
      }),
      'View',
    ),
    spec(
      memoryHandle(`${id}.sort`, 'recent', {
        kind: 'enum',
        options: [
          { value: 'recent', label: 'Most recent first' },
          { value: 'oldest', label: 'Oldest first' },
        ],
      }),
      'Sort order',
    ),
  ]
}

function Frame({
  testid,
  className = '',
  children,
}: {
  testid: string
  className?: string
  children: ReactNode
}): ReactElement {
  return (
    <div
      data-testid={testid}
      className={`flex min-w-0 max-w-full flex-col gap-3 rounded-card border border-border bg-card p-3 ${className}`}
    >
      {children}
    </div>
  )
}

export function Probe(): ReactElement {
  return (
    <main lang="en" className="flex flex-col gap-4 p-4 text-foreground">
      <Frame testid="fs-8" className="w-full">
        <FilterSet specs={eight('a')} />
      </Frame>
      <Frame testid="fs-3" className="w-full">
        <FilterSet specs={eight('b').slice(0, 3)} />
      </Frame>
      <Frame testid="fs-0" className="w-full">
        <FilterSet specs={[]} />
      </Frame>
      <Frame testid="fs-w560" className="w-[560px]">
        <FilterSet specs={eight('c')} />
      </Frame>
      <Frame testid="fs-bar" className="w-full">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <FilterSet specs={eight('d')} />
          </div>
          <Button data-testid="fs-bar-after" variant="primary">
            Export
          </Button>
        </div>
      </Frame>
      <Frame testid="fs-aside" className="w-full">
        <ControlHome home="aside">
          <FilterSet specs={eight('e').slice(0, 3)} />
        </ControlHome>
      </Frame>
    </main>
  )
}
