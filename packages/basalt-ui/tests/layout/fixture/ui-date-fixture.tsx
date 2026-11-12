/**
 * The `ui-date` fixture: a `DatePicker` and a `DateRangePicker` on their own markup, no shell and
 * no provider. It is the entry the `ui-date` layout test bundles; the harness is told to "mount" it
 * by a no-op `window.basaltMountFixture`, since the page renders itself on load.
 *
 * Probes, each a `data-testid`:
 * - `ud-day`, `ud-range`: the two triggers; `ud-day-out`, `ud-range-out`: the last value each
 *   reported, as text (`none` until one is);
 * - `ud-page`: the page content behind the popups.
 */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import type { ReactElement } from 'react'
import type { CalendarDate } from '../../../src/core/format'
import { DatePicker, DateRangePicker } from '../../../src/ui/date-picker'
import type { CalendarRange } from '../../../src/ui/date-picker'

function Fixture(): ReactElement {
  const [day, setDay] = useState<CalendarDate | null>('2026-11-15')
  const [range, setRange] = useState<CalendarRange | null>(null)
  const [lastDay, setLastDay] = useState('none')
  const [lastRange, setLastRange] = useState('none')
  return (
    <main
      className="flex min-h-dvh flex-col gap-4 bg-background p-4 text-foreground"
      data-testid="ud-page"
    >
      <h1 className="text-lg font-medium">Dates</h1>
      <div className="flex flex-wrap gap-2">
        <DatePicker
          aria-label="Due date"
          className="w-48"
          id="ud-day"
          value={day}
          onChange={(v) => {
            setDay(v)
            setLastDay(v)
          }}
        />
        <DateRangePicker
          aria-label="Report window"
          className="w-64"
          id="ud-range"
          value={range}
          onChange={(r) => {
            setRange(r)
            setLastRange(`${r.from}..${r.to}`)
          }}
        />
      </div>
      <p className="text-sm text-muted-foreground" data-testid="ud-day-out">
        {lastDay}
      </p>
      <p className="text-sm text-muted-foreground" data-testid="ud-range-out">
        {lastRange}
      </p>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Fixture />)
