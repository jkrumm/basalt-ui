/**
 * The `cards-schedule` fixture: `Schedule` from the cards entry, on its own markup with no shell and
 * no provider. The view comes from the URL (`?view=week`, the default, `day` or `month`); the shown
 * day is empty, so today is 2026-11-23. `now` is fixed, so the now line and the past events are stable.
 *
 * Probes:
 * - 2026-11-23: a cluster of four that overlaps (10:00-11:00, 10:15-10:45, 10:30-12:00, 10:40-10:55),
 *   a lone 14:00-15:00, back-to-back 08:00-08:30 and 08:30-09:00, and a past 07:00-07:15;
 * - 2026-11-25: three that overlap (09:00-10:00, 09:00-09:30, 09:20-11:00).
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { Schedule } from '../../../src/cards/schedule'
import type { ScheduleEvent, ScheduleView } from '../../../src/cards/schedule'

const NOW = Date.UTC(2026, 10, 23, 9, 30)
const at = (day: number, h: number, m = 0): number => Date.UTC(2026, 10, day, h, m)

const EVENTS: ScheduleEvent[] = [
  { id: 'bearing', title: 'Bearing delivery', start: at(23, 10), end: at(23, 11), tone: 'info' },
  {
    id: 'supplier',
    title: 'Supplier call',
    start: at(23, 10, 15),
    end: at(23, 10, 45),
    tone: 'good',
  },
  { id: 'crate', title: 'Crate handover', start: at(23, 10, 30), end: at(23, 12), tone: 'warn' },
  { id: 'seal', title: 'Seal check', start: at(23, 10, 40), end: at(23, 10, 55), tone: 'bad' },
  { id: 'lunch', title: 'Lunch review', start: at(23, 14), end: at(23, 15), tone: 'accent' },
  { id: 'dock', title: 'Dock opening', start: at(23, 8), end: at(23, 8, 30), tone: 'neutral' },
  {
    id: 'forklift',
    title: 'Forklift briefing',
    start: at(23, 8, 30),
    end: at(23, 9),
    tone: 'good',
  },
  { id: 'pickup', title: 'Early pickup', start: at(23, 7), end: at(23, 7, 15), tone: 'neutral' },
  { id: 'inbound', title: 'Inbound truck', start: at(25, 9), end: at(25, 10), tone: 'warn' },
  { id: 'sample', title: 'Quality sample', start: at(25, 9), end: at(25, 9, 30), tone: 'good' },
  { id: 'visit', title: 'Customer visit', start: at(25, 9, 20), end: at(25, 11), tone: 'accent' },
]

function Fixture(): ReactElement {
  const requested = new URLSearchParams(window.location.search).get('view')
  const initialView: ScheduleView =
    requested === 'day' || requested === 'month' ? requested : 'week'
  const [view, setView] = useState<ScheduleView>(initialView)
  const [date, setDate] = useState('')
  return (
    <main className="p-4">
      <div className="h-[900px] w-full">
        <Schedule
          label="Deliveries"
          events={EVENTS}
          now={NOW}
          view={{ use: () => [view, setView] }}
          date={{ use: () => [date, setDate] }}
          scrollTo={7}
        />
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
