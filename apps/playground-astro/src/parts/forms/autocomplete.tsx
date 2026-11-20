import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
} from 'basalt-ui/ui/combobox'
import type { ReactElement } from 'react'
import { BASE_IMAGES } from './fixtures'

export function Demo(): ReactElement {
  return (
    <div className="max-w-sm">
      <Autocomplete items={BASE_IMAGES}>
        <AutocompleteInput aria-label="Base image" placeholder="node:22-alpine" />
        <AutocompleteContent empty="No suggestion; the typed image is kept.">
          {(base: string) => (
            <AutocompleteItem key={base} value={base}>
              {base}
            </AutocompleteItem>
          )}
        </AutocompleteContent>
      </Autocomplete>
    </div>
  )
}
