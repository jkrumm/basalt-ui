/**
 * The `ui-range` fixture (docs/v3/concepts/primitives-distribution.md section 4, rows 10-11): the
 * slider and segmented primitives on their own markup, no shell, the page set to `de-DE` by an
 * `IntlScope`. It is the entry the `ui-range` layout test bundles; the harness is told to "mount" it
 * by a no-op `window.basaltMountFixture`.
 *
 * Probes, each in a `data-testid` box:
 * - `ur-seg`: a three-option `Segmented` on `day`; `ur-seg-small`: `size="sm"`;
 * - `ur-seg-multi`: `multiple`, `a` on; `ur-seg-long`: long labels in a `w-full` group;
 * - `ur-slider`: one thumb on 1,5 of 0..5; `ur-range`: two thumbs, 20 and 80;
 * - `ur-log`: the `onValueChange` and `onValueCommitted` counts of `ur-slider`, and the last
 *   `Segmented` value.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { IntlScope } from '../../../src/core/provider-props'
import { Segmented, SegmentedItem } from '../../../src/ui/segmented'
import { Slider } from '../../../src/ui/slider'

const RANGES = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]
const LONG = [
  { value: 'a', label: 'A fairly long option label' },
  { value: 'b', label: 'Another long label here' },
  { value: 'c', label: 'And a third one that goes on' },
]

const ROW = 'flex flex-col gap-2'

function Fixture() {
  const [changes, setChanges] = useState(0)
  const [commits, setCommits] = useState(0)
  const [picked, setPicked] = useState('day')
  return (
    <IntlScope locale="de-DE">
      <main className="flex max-w-lg flex-col gap-6 p-4 text-foreground">
        <h1 className="text-lg font-medium">Range</h1>
        <p data-testid="ur-log" className="text-sm">
          {`changes:${changes} commits:${commits} picked:${picked}`}
        </p>
        <div className={ROW} data-testid="ur-seg">
          <span className="text-sm">Segmented</span>
          <Segmented
            aria-label="Range"
            options={RANGES}
            defaultValue="day"
            onValueChange={setPicked}
          />
        </div>
        <div className={ROW} data-testid="ur-seg-small">
          <span className="text-sm">Small</span>
          <Segmented aria-label="Range, small" size="sm" options={RANGES} defaultValue="week" />
        </div>
        <div className={ROW} data-testid="ur-seg-multi">
          <span className="text-sm">Multiple</span>
          <Segmented aria-label="Series" multiple defaultValue={['a']}>
            <SegmentedItem value="a">Alpha</SegmentedItem>
            <SegmentedItem value="b">Beta</SegmentedItem>
            <SegmentedItem value="c">Gamma</SegmentedItem>
          </Segmented>
        </div>
        <div className={ROW} data-testid="ur-seg-long">
          <span className="text-sm">Long labels</span>
          <Segmented aria-label="Long" options={LONG} defaultValue="a" className="w-full" />
        </div>
        <div className={ROW} data-testid="ur-slider">
          <span className="text-sm">Slider</span>
          <Slider
            aria-label="Level"
            defaultValue={1.5}
            min={0}
            max={5}
            step={0.5}
            onValueChange={() => setChanges((n) => n + 1)}
            onValueCommitted={() => setCommits((n) => n + 1)}
          />
        </div>
        <div className={ROW} data-testid="ur-range">
          <span className="text-sm">Range slider</span>
          <Slider defaultValue={[20, 80]} thumbLabels={['Minimum', 'Maximum']} />
        </div>
      </main>
    </IntlScope>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
