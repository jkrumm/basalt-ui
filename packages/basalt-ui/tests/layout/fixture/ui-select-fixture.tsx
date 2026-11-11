/**
 * The `ui-select` fixture (docs/v3/concepts/primitives-distribution.md section 4, rows 5-6): the
 * select, native select, combobox, multi combobox and autocomplete on their own markup, no shell
 * and no provider. It is the entry the `ui-select` layout test bundles; the harness is told to
 * "mount" it by a no-op `window.basaltMountFixture`, since the page renders itself on load.
 *
 * Probes, each in a `data-testid` box:
 * - `us-select`: a 60-option `Select` (taller than any phone viewport), `w-40`;
 * - `us-select-small`: a three-option `Select size="sm"`, `w-full`;
 * - `us-native`: a `NativeSelect`;
 * - `us-combobox`: a 60-item `Combobox`; `us-chips`: a `multiple` one with two chips;
 * - `us-auto`: an `Autocomplete`.
 */
import { createRoot } from 'react-dom/client'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  Combobox,
  ComboboxChips,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
} from '../../../src/ui/combobox'
import { NativeSelect, Select } from '../../../src/ui/select'

const NAMES = Array.from({ length: 60 }, (_, i) => `Option ${String(i + 1).padStart(2, '0')}`)
const OPTIONS = NAMES.map((label) => ({ value: label, label }))
const FEW = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
]
const ROW = 'flex flex-col gap-1 text-sm'

const item = (name: string) => (
  <ComboboxItem key={name} value={name}>
    {name}
  </ComboboxItem>
)

function Fixture() {
  return (
    <main className="flex flex-col gap-6 p-4 text-foreground">
      <h1 className="text-lg font-medium">Pickers</h1>
      <div className={ROW} data-testid="us-select">
        <span id="us-select-label">Select</span>
        <Select
          aria-labelledby="us-select-label"
          options={OPTIONS}
          defaultValue="Option 03"
          className="w-40"
        />
      </div>
      <div className={ROW} data-testid="us-select-small">
        <span>Select small</span>
        <Select
          aria-label="Small"
          size="sm"
          options={FEW}
          placeholder="Pick one"
          className="w-full"
        />
      </div>
      <div className={ROW} data-testid="us-native">
        <span>Native</span>
        <NativeSelect aria-label="Native" options={FEW} defaultValue="b" className="w-full" />
      </div>
      <div className={ROW} data-testid="us-combobox">
        <span>Combobox</span>
        <Combobox items={NAMES}>
          <ComboboxInput aria-label="Combobox" placeholder="Search" />
          <ComboboxContent empty="No results">{item}</ComboboxContent>
        </Combobox>
      </div>
      <div className={ROW} data-testid="us-chips">
        <span>Chips</span>
        <Combobox multiple items={NAMES} defaultValue={['Option 01', 'Option 02']}>
          <ComboboxChips aria-label="Chips" placeholder="Add" />
          <ComboboxContent empty="No results">{item}</ComboboxContent>
        </Combobox>
      </div>
      <div className={ROW} data-testid="us-auto">
        <span>Autocomplete</span>
        <Autocomplete items={NAMES}>
          <AutocompleteInput aria-label="Autocomplete" placeholder="Type" />
          <AutocompleteContent empty="No suggestions">
            {(name: string) => (
              <AutocompleteItem key={name} value={name}>
                {name}
              </AutocompleteItem>
            )}
          </AutocompleteContent>
        </Autocomplete>
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Fixture />)
