import { Toc } from 'basalt-ui/page'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="max-w-xs">
      <Toc
        title="On this page"
        items={[
          { id: 'setup', label: 'Setup', level: 2 },
          { id: 'load', label: 'Training load', level: 2 },
          { id: 'taper', label: 'Taper', level: 3 },
          { id: 'recovery', label: 'Recovery', level: 2 },
        ]}
      />
    </div>
  )
}
