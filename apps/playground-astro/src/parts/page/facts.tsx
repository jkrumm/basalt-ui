import { Facts } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { recordOf } from '../../../../playground/src/demo/peek-records'

export function Demo(): ReactElement {
  const record = recordOf('12')
  return (
    <div className="max-w-sm">
      <Facts
        rows={[
          { label: 'Version', value: 'v2.13.3' },
          { label: 'Duration', value: '174 s' },
          { label: 'State', value: record?.state ?? '' },
          { label: 'Owner', value: record?.owner ?? '' },
        ]}
      />
    </div>
  )
}
