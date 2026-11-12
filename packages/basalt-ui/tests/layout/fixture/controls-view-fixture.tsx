/**
 * The `controls-view` fixture (docs/v3/issues/g1/v3-ctl-4-control-view.json): `ControlView` on its
 * own markup, no shell and no provider. It is the entry the `controls-view` layout test bundles; the
 * harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes, each a `data-testid` box:
 * - `cv-<pill|row|inline>-<bound|override>`: one widget control per presentation, once following
 *   its global and once overriding it;
 * - `cv-kinds-<pill|row|inline>`: one control of every kind in that presentation, the range on
 *   `custom` so its day inputs are drawn.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import type { ControlPresentation } from '../../../src/controls/contract'
import { ControlPresentationContext, ControlView } from '../../../src/controls/control-view'
import { memoryHandle, widgetHandle } from '../../../src/controls/control-view.handles'
import { spec } from '../../../src/controls/spec'

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

const PRESENTATIONS: readonly ControlPresentation[] = ['pill', 'row', 'inline']

const widget = (key: string, override?: string) =>
  widgetHandle<string>(key, '24h', {
    kind: 'enum',
    options: RANGES,
    ...(override !== undefined && { override }),
  })

function Frame({
  presentation,
  testid,
  children,
}: {
  presentation: ControlPresentation
  testid: string
  children: ReactElement | ReactElement[]
}): ReactElement {
  return (
    <ControlPresentationContext value={presentation}>
      <div
        data-testid={testid}
        className="flex w-[min(100%,24rem)] flex-col gap-3 rounded-card border border-border bg-card p-3"
      >
        {children}
      </div>
    </ControlPresentationContext>
  )
}

function Kinds({ presentation }: { presentation: ControlPresentation }): ReactElement {
  const id = presentation
  const specs = [
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
    spec(
      memoryHandle(
        `${id}.range`,
        { preset: 'custom', from: '2026-01-01', to: '2026-01-31' } as {
          preset: string
          from?: string
          to?: string
        },
        { kind: 'range', options: [...RANGES, { value: 'custom', label: 'Custom' }] as never },
      ),
      'Range',
    ),
  ]
  return (
    <Frame presentation={presentation} testid={`cv-kinds-${presentation}`}>
      {specs.map((s) => (
        <ControlView key={s.handle.key} spec={s} />
      ))}
    </Frame>
  )
}

function Fixture(): ReactElement {
  return (
    <main lang="en" className="flex flex-col gap-4 p-4 text-foreground">
      {PRESENTATIONS.flatMap((presentation) => [
        <Frame
          key={`${presentation}-bound`}
          presentation={presentation}
          testid={`cv-${presentation}-bound`}
        >
          <ControlView spec={spec(widget(`${presentation}.bound`), 'Range')} />
        </Frame>,
        <Frame
          key={`${presentation}-override`}
          presentation={presentation}
          testid={`cv-${presentation}-override`}
        >
          <ControlView spec={spec(widget(`${presentation}.override`, '7d'), 'Range')} />
        </Frame>,
        <Kinds key={`${presentation}-kinds`} presentation={presentation} />,
      ])}
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
