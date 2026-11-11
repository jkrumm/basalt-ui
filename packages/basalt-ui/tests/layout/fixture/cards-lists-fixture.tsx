/**
 * The `cards-lists` fixture (docs/v3/issues/g1/v3-cards-2-lists.json): `BarList` and `EventList` on
 * their own markup, no shell and no provider. It is the entry the `cards-lists` layout test
 * bundles; the harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes, each a `data-testid` box around one card:
 * - `cl-bar-<ready|loading|stale|empty|error>` and `cl-event-<...>`: one card per phase, same props,
 *   with more rows than the body holds, so `ready` scrolls;
 * - `cl-bar-short`, `cl-event-short`: three rows, nothing to scroll;
 * - `cl-bar-link`: rows that are a link, a button and plain text.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { BarList } from '../../../src/cards/bar-list'
import { EventList } from '../../../src/cards/event-list'
import type { BarListProps } from '../../../src/cards/bar-list'
import type { EventListProps } from '../../../src/cards/event-list'

const PHASES = ['ready', 'loading', 'stale', 'empty', 'error'] as const
type Probe = (typeof PHASES)[number]

const NOW = Date.UTC(2026, 8, 3, 12, 0)
const DAY = 86_400_000

const BARS = Array.from({ length: 12 }, (_, i) => ({
  label: i === 2 ? 'a-very-long-project-name-that-must-truncate-at-every-width' : `project-${i}`,
  value: 2400 - i * 180,
  ...(i % 3 === 0 && { secondary: `${40 - i}%` }),
}))

const EVENTS = Array.from({ length: 40 }, (_, i) => ({
  id: `e${i}`,
  at: NOW - i * 5_400_000 - (i > 8 ? DAY : 0),
  ...(i % 2 === 0 && { actor: 'Ada' }),
  title:
    i === 3 ? 'merged a pull request whose title is long enough to need truncating' : `event ${i}`,
  ...(i % 4 === 0 && { body: 'A note on the change' }),
  ...(i % 5 === 0 && { chips: ['main', 'ci'] }),
}))

const barProps = (phase: Probe): BarListProps => ({
  title: 'Top projects',
  subtitle: 'by tokens',
  info: 'Tokens spent per project in the range.',
  items: BARS,
  ...(phase === 'loading' || phase === 'stale' ? { phase } : {}),
  ...(phase === 'error' ? { phase: { tag: 'error', retry: () => undefined } } : {}),
  ...(phase === 'empty' ? { empty: { cause: 'No projects ran this week' } } : {}),
})

const eventProps = (phase: Probe): EventListProps => ({
  title: 'Activity',
  subtitle: 'last 7 days',
  info: 'Everything merged, opened or closed.',
  items: EVENTS,
  now: NOW,
  pageSize: 30,
  ...(phase === 'loading' || phase === 'stale' ? { phase } : {}),
  ...(phase === 'error' ? { phase: { tag: 'error', retry: () => undefined } } : {}),
  ...(phase === 'empty' ? { empty: { cause: 'No activity this week' } } : {}),
})

function Fixture(): ReactElement {
  return (
    // theme-allow -- the wrappers are the probe's payload (cards in a responsive grid)
    <main lang="en" className="flex flex-col gap-6 p-4 text-foreground">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] items-start gap-4">
        {PHASES.map((phase) => (
          <div key={phase} data-testid={`cl-bar-${phase}`}>
            <BarList {...barProps(phase)} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] items-start gap-4">
        {PHASES.map((phase) => (
          <div key={phase} data-testid={`cl-event-${phase}`}>
            <EventList {...eventProps(phase)} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] items-start gap-4">
        <div data-testid="cl-bar-short">
          <BarList title="Top three" items={BARS.slice(0, 3)} />
        </div>
        <div data-testid="cl-event-short">
          <EventList title="Latest three" now={NOW} items={EVENTS.slice(0, 3)} />
        </div>
        <div data-testid="cl-bar-link">
          <BarList
            title="Targets"
            items={[
              { label: 'A link', value: 30, href: '#link' },
              { label: 'A button', value: 20, onSelect: () => undefined },
              { label: 'Plain text', value: 10 },
            ]}
          />
        </div>
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
