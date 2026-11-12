/**
 * Where the nav parts sit in the grid. The rail and the tab bar both render on the server and CSS
 * shows one (concept decision 7), so there is no hydration flash and no second rendering path.
 * Each part is wrapped in its grid cell here, so replacing a part never touches the frame.
 */
import type { ReactElement } from 'react'
import { cn } from '../../core/cn'
import { TabBar } from './mobile'
import type { TabBarProps } from './mobile'
import { PRINT_OFF } from './print'
import { Rail } from './rail'
import type { RailProps } from './rail'

export function RailMount(props: RailProps): ReactElement {
  return (
    <div className={cn('hidden min-h-0 [grid-area:rail] md:block', PRINT_OFF)}>
      <Rail {...props} />
    </div>
  )
}

export function TabBarMount(props: TabBarProps): ReactElement {
  return (
    <div className={cn('[grid-area:footer] md:hidden', PRINT_OFF)}>
      <TabBar {...props} />
    </div>
  )
}
