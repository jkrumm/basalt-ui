/**
 * Expression cycle 12 kit fixes, the frame group: a StatGroup in ready, loading and error, as n53
 * draws it (a figure, a sub line and a delta per cell). Entry of `kit-expr12-frame.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { StatCell } from '../../../src/cards/stat-cell'
import { StatGroup } from '../../../src/cards/stat-group'
import type { Phase } from '../../../src/cards'

// One source per group: frames that share a `retry` draw one Retry between them (Issue 2452).
const RETRY = { strip: (): void => undefined, cards: (): void => undefined }

function Group({ variant, state }: { variant: 'strip' | 'cards'; state: string }): ReactElement {
  const phase: Phase =
    state === 'loading'
      ? 'loading'
      : state === 'error'
        ? { tag: 'error', retry: RETRY[variant] }
        : 'ready'
  const none = state !== 'ready' // the page holds no data in loading and error: null figures, no status
  return (
    <div data-testid={`x12-${variant}-${state}`} className="min-w-0">
      <StatGroup variant={variant} label="Plan">
        <StatCell
          title="Rows"
          phase={phase}
          value={none ? null : 17}
          sub="of 40"
          meter={{
            label: 'Done',
            value: none ? null : 17,
            max: 40,
            format: (v) => `${Math.round((v / 40) * 100)}%`,
          }}
          rows={[
            {
              label: 'Closed in 7 days',
              value: 4,
              delta: { value: '+1', polarity: 'up-good', label: 'vs last week' },
            },
            { label: 'Last closed', value: '17 Nov' },
          ]}
        />
        <StatCell
          title="Blocked"
          phase={phase}
          value={none ? null : 1}
          status={none ? undefined : { tone: 'bad', label: 'Backfill legacy entries' }}
          rows={[
            { label: 'Holds back', value: 6, bar: { value: 6, max: 23 } },
            { label: 'Open for', value: '4 d' },
          ]}
        />
        <StatCell
          title="Can start"
          phase={phase}
          value={none ? null : 3}
          status={none ? undefined : { tone: 'accent', label: 'Cursor pagination' }}
          rows={[
            { label: 'Holds back', value: 6, bar: { value: 6, max: 23 } },
            { label: 'Filed', value: '2 Nov' },
          ]}
        />
      </StatGroup>
    </div>
  )
}

function Fixture(): ReactElement {
  return (
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      {(['strip', 'cards'] as const).flatMap((variant) =>
        ['ready', 'loading', 'error'].map((state) => (
          <Group key={`${variant}-${state}`} variant={variant} state={state} />
        )),
      )}
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
