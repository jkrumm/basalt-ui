import { Facts, PageAside } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { recordOf } from '../../../../playground/src/demo/peek-records'

export function Demo(): ReactElement {
  const record = recordOf('12')
  return (
    <PageAside title="Run details" width={360}>
      <Facts
        rows={[
          { label: 'State', value: record?.state ?? '' },
          { label: 'Owner', value: record?.owner ?? '' },
          { label: 'Note', value: record?.note ?? '' },
        ]}
      />
    </PageAside>
  )
}
