/**
 * The `option-list` fixture: a Combobox over ten thousand options, open with option 500 selected,
 * windowed through `VirtualList`, below a closed City combobox, in a frame of its own. No shell and
 * no provider.
 */
import { createRoot } from 'react-dom/client'
import { Combobox } from '../../../src/ui/combobox'
import { VirtualList } from '../../../src/ui/virtual-list'

const KINDS = ['Bearing', 'Bolt', 'Bracket', 'Gasket', 'Hinge', 'Spring', 'Valve', 'Washer']
const PARTS = Array.from({ length: 10_000 }, (_, i) => ({
  value: `p${i}`,
  label: `Part ${i} · ${KINDS[i % KINDS.length] ?? 'Part'}`,
  ...(i % 5 === 0 && { description: 'Reordered weekly' }),
}))

const CITIES = [
  { value: 'ber', label: 'Berlin' },
  { value: 'ham', label: 'Hamburg' },
  { value: 'par', label: 'Paris' },
  { value: 'lyo', label: 'Lyon' },
]

function Fixture() {
  return (
    <div data-testid="ol-frame" className="flex w-96 flex-col gap-4 p-4">
      <Combobox aria-label="City" options={CITIES} />
      <Combobox
        aria-label="Part"
        options={PARTS}
        virtual={VirtualList}
        defaultOpen
        defaultValue="p500"
      />
    </div>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
