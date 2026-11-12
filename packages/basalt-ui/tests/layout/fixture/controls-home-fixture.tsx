/**
 * The `controls-home` fixture (docs/v3/issues/g1/v3-ctl-4b-control-home.json): `ControlHome` and
 * `filterSlot` on their own markup, no shell and no provider. The entry the `controls-home` layout
 * test bundles; the harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes, each a `data-testid` box:
 * - `ch-<home>-8` and `ch-<home>-0`: a home with eight filters and with none;
 * - `ch-<pill|row|inline>-<bound|override>`: one widget control per presentation, once following
 *   its global and once overriding it;
 * - `ch-fold`: a page-bar home whose fold opens a popover holding the same controls;
 * - `ch-custom`: a `filterSlot.custom` control, counted in `window.basaltEscapes`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement, ReactNode } from 'react'
import type { ControlHome as HomeName } from '../../../src/controls/contract'
import { ControlHome, FoldedControls } from '../../../src/controls/control-home'
import { memoryHandle, widgetHandle } from '../../../src/controls/control-view.handles'
import { countEscapes, filterSlot } from '../../../src/controls/filter-slot'
import { spec } from '../../../src/controls/spec'
import { Button } from '../../../src/ui/button'
import { Input } from '../../../src/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../../../src/ui/popover'

const RANGES = [
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]
const REGIONS = [
  { value: 'eu', label: 'Europe' },
  { value: 'us', label: 'United States' },
  { value: 'ap', label: 'Asia Pacific' },
]

function eight(id: string) {
  return [
    spec(
      memoryHandle(`${id}.env`, 'prod', {
        kind: 'enum',
        options: [
          { value: 'prod', label: 'Production' },
          { value: 'staging', label: 'Staging' },
        ],
      }),
      'Environment',
    ),
    spec(
      memoryHandle(`${id}.view`, 'all', {
        kind: 'enum',
        options: [
          { value: 'all', label: 'All' },
          { value: 'errors', label: 'Errors' },
        ],
      }),
      'View',
      { as: 'segmented' },
    ),
    spec(
      memoryHandle<readonly string[]>(`${id}.regions`, ['eu'], {
        kind: 'multi',
        options: REGIONS as never,
      }),
      'Regions',
    ),
    spec(memoryHandle(`${id}.q`, 'latency', { kind: 'string' }), 'Search', {
      clearable: true,
      placeholder: 'Search',
    }),
    spec(
      memoryHandle(`${id}.limit`, 20, { kind: 'number', bounds: { min: 1, max: 100, int: true } }),
      'Limit',
      { clearable: true },
    ),
    spec(memoryHandle(`${id}.live`, true, { kind: 'boolean' }), 'Live'),
    spec(memoryHandle(`${id}.range`, '24h', { kind: 'enum', options: RANGES }), 'Range'),
    spec(
      memoryHandle(`${id}.tier`, 'a', {
        kind: 'enum',
        options: [
          { value: 'a', label: 'Tier A' },
          { value: 'b', label: 'Tier B' },
        ],
      }),
      'Tier',
    ),
  ]
}

const widget = (key: string, override?: string) =>
  widgetHandle<string>(key, '24h', {
    kind: 'enum',
    options: RANGES,
    ...(override !== undefined && { override }),
  })

function Frame({ testid, children }: { testid: string; children: ReactNode }): ReactElement {
  return (
    <div
      data-testid={testid}
      className="flex w-full min-w-0 flex-col gap-3 rounded-card border border-border bg-card p-3"
    >
      {children}
    </div>
  )
}

const HOMES: readonly HomeName[] = [
  'page-bar',
  'view-mode',
  'card-header',
  'tool',
  'aside',
  'sheet',
]
const SHARED = { page: 'pill', row: 'row', inline: 'inline' } as const
const SHARED_HOME: Record<keyof typeof SHARED, HomeName> = {
  page: 'page-bar',
  row: 'aside',
  inline: 'card-header',
}

const customHandle = memoryHandle('ch.custom', 'abc', { kind: 'string' })
const customSlot = filterSlot.custom(customHandle, 'Free text', ({ value, set, label }) => (
  <Input
    aria-label={label}
    value={value}
    onChange={(e) => {
      set(e.currentTarget.value)
    }}
  />
))
const plainSlot = filterSlot([eight('plain')[0]!])
;(window as unknown as { basaltEscapes: number }).basaltEscapes = countEscapes([
  customSlot,
  plainSlot,
])

function Fold(): ReactElement {
  const slot = filterSlot(eight('fold').slice(0, 3))
  return (
    <Frame testid="ch-fold">
      <ControlHome home="page-bar">
        {filterSlot([eight('foldbar')[0]!]).render()}
        <Popover>
          <PopoverTrigger render={<Button variant="secondary" />}>More filters</PopoverTrigger>
          <PopoverContent aria-label="More filters" className="w-80 max-w-[90vw]">
            <FoldedControls>
              <ControlHome home="page-bar">{slot.render()}</ControlHome>
            </FoldedControls>
          </PopoverContent>
        </Popover>
      </ControlHome>
    </Frame>
  )
}

function Fixture(): ReactElement {
  return (
    <main lang="en" className="flex flex-col gap-4 p-4 text-foreground">
      {HOMES.flatMap((home) => [
        <Frame key={`${home}-8`} testid={`ch-${home}-8`}>
          <ControlHome home={home}>{filterSlot(eight(home)).render()}</ControlHome>
        </Frame>,
        <Frame key={`${home}-0`} testid={`ch-${home}-0`}>
          <ControlHome home={home}>{filterSlot([]).render()}</ControlHome>
        </Frame>,
      ])}
      {(Object.keys(SHARED) as (keyof typeof SHARED)[]).flatMap((kind) => [
        <Frame key={`${kind}-bound`} testid={`ch-${kind}-bound`}>
          <ControlHome home={SHARED_HOME[kind]}>
            {filterSlot([spec(widget(`${kind}.bound`), 'Range')]).render()}
          </ControlHome>
        </Frame>,
        <Frame key={`${kind}-override`} testid={`ch-${kind}-override`}>
          <ControlHome home={SHARED_HOME[kind]}>
            {filterSlot([spec(widget(`${kind}.override`, '7d'), 'Range')]).render()}
          </ControlHome>
        </Frame>,
      ])}
      <Fold />
      <Frame testid="ch-custom">
        <ControlHome home="card-header">{customSlot.render()}</ControlHome>
      </Frame>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
