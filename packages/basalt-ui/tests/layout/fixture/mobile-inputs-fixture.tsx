/**
 * The `mobile-inputs` fixture: the text controls of the kit on their own markup, each carrying a
 * `data-testid`, plus `probe-text-sm`, an element at the control size (`text-sm`) the controls read
 * on a fine pointer. `bare-*` are plain elements for the `styles.css` sheet.
 */
import { createRoot } from 'react-dom/client'
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem } from '../../../src/ui/combobox'
import { DatePicker } from '../../../src/ui/date-picker'
import { Input } from '../../../src/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../src/ui/select'
import { Textarea } from '../../../src/ui/textarea'

const CITIES = ['Berlin', 'Lisbon']

function Fixture() {
  return (
    <main className="flex flex-col gap-4 p-4 text-foreground">
      <span data-testid="probe-text-sm" className="text-sm">
        probe
      </span>
      <Input aria-label="Name" data-testid="m-input" />
      <Input aria-label="Name, compact" size="sm" data-testid="m-input-sm" />
      <Textarea aria-label="Note" data-testid="m-textarea" />
      <Select defaultValue="a">
        <SelectTrigger aria-label="Stage" data-testid="m-select">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>
      <Combobox items={CITIES} present="popup">
        <ComboboxInput aria-label="City" data-testid="m-combobox" />
        <ComboboxContent empty="No results">
          {CITIES.map((c) => (
            <ComboboxItem key={c} value={c}>
              {c}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>
      <DatePicker aria-label="Due date" data-testid="m-date" />
    </main>
  )
}

;(window as unknown as { basaltMountFixture: () => void }).basaltMountFixture = () => {}
createRoot(document.getElementById('root')!).render(<Fixture />)
