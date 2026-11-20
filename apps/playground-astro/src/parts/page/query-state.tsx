import { Facts, QueryState } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { recordOf } from '../../../../playground/src/demo/peek-records'

export function Demo(): ReactElement {
  const record = recordOf('12')
  return (
    <QueryState phase="ready" empty={null}>
      <Facts
        rows={[
          { label: 'State', value: record?.state ?? '' },
          { label: 'Owner', value: record?.owner ?? '' },
        ]}
      />
    </QueryState>
  )
}
