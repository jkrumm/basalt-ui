import { RowList } from 'basalt-ui/cards'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="max-w-md">
      <RowList
        title="Open issues"
        lines={2}
        mono
        items={[
          {
            key: 'a',
            label: 'issue_2283',
            meta: 'building',
            detail: 'Lists: a bare border',
            value: '3.1 d',
            valueDetail: '2.4× typical',
          },
          {
            key: 'b',
            label: 'issue_2271',
            meta: 'review',
            detail: 'Table filters on the phone',
            value: '2.2 d',
            valueDetail: '1.7× typical',
          },
          {
            key: 'c',
            label: 'issue_2260',
            meta: 'verify',
            detail: 'Chart hover sweep',
            value: '1.4 d',
            valueDetail: '1.1× typical',
          },
          {
            key: 'd',
            label: 'issue_2254',
            meta: 'building',
            detail: 'Interval track kind',
            value: '19 h',
            valueDetail: '0.6× typical',
          },
        ]}
      />
    </div>
  )
}
