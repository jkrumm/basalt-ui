import { FilterSet, ViewTabs, spec } from 'basalt-ui/controls'
import type { ReactElement } from 'react'
import { runs } from './fixtures'

export function Demo(): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <ViewTabs state={runs.field.tab} label="Runs view" />
      <FilterSet specs={[spec(runs.field.region, 'Region'), spec(runs.field.status, 'Status')]} />
    </div>
  )
}
