import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import type { ReactElement } from 'react'

const LOG = [
  '05:58 watch connected',
  '06:00 run started, 4.2 km',
  '06:14 split 1: 5:12',
  '06:19 split 2: 5:08',
  '06:24 split 3: 5:15',
  '06:29 split 4: 5:04',
  '06:34 split 5: 5:11',
  '06:39 split 6: 5:09',
  '06:44 split 7: 5:20',
  '06:49 split 8: 5:06',
]

export function Demo(): ReactElement {
  return (
    <ScrollArea aria-label="Run log" className="max-h-48 max-w-md">
      <ul className="m-0 list-none p-0 font-mono text-xs">
        {LOG.map((line) => (
          <li key={line} className="py-0.5">
            {line}
          </li>
        ))}
      </ul>
    </ScrollArea>
  )
}
