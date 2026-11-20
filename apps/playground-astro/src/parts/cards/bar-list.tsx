import { BarList } from 'basalt-ui/cards'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="max-w-sm">
      <BarList
        title="Top projects"
        subtitle="by tokens"
        items={[
          { label: 'checkout', value: 840, secondary: '34%' },
          { label: 'search', value: 620, secondary: '27%' },
          { label: 'billing', value: 410, secondary: '17%' },
          { label: 'auth', value: 220, secondary: '13%' },
        ]}
      />
    </div>
  )
}
