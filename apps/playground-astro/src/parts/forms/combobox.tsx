import {
  Combobox,
  ComboboxChips,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
} from 'basalt-ui/ui/combobox'
import type { ReactElement } from 'react'
import { ZONES } from './fixtures'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Combobox items={ZONES} defaultValue="Europe/Berlin">
        <ComboboxInput aria-label="Time zone" placeholder="Search zones" />
        <ComboboxContent empty="No zone matches.">
          {(zone: string) => (
            <ComboboxItem key={zone} value={zone}>
              {zone}
            </ComboboxItem>
          )}
        </ComboboxContent>
      </Combobox>
      <Combobox items={ZONES} multiple defaultValue={['UTC', 'Asia/Tokyo']}>
        <ComboboxChips
          aria-label="Zones"
          placeholder="Add a zone"
          itemToLabel={(zone: string) => zone}
        />
        <ComboboxContent empty="No zone matches.">
          {(zone: string) => (
            <ComboboxItem key={zone} value={zone}>
              {zone}
            </ComboboxItem>
          )}
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
