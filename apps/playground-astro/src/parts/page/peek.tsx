import { Facts, Peek } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { recordOf } from '../../../../playground/src/demo/peek-records'

export function Demo(): ReactElement {
  const record = recordOf('12')
  return (
    <Peek title="Deploy checkout" tag="#12" fullPage="/peek/12" onClose={() => undefined}>
      <Facts
        rows={[
          { label: 'State', value: record?.state ?? '' },
          { label: 'Owner', value: record?.owner ?? '' },
          { label: 'Note', value: record?.note ?? '' },
        ]}
      />
    </Peek>
  )
}
