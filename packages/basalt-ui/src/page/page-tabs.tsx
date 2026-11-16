import type { ReactElement, ReactNode } from 'react'
import type { ControlHandle } from '../core/ports'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import type { PageTabs } from './contract'

/** True when `tabs` draws nothing: unset, or a slot with no controls. A handle always draws. */
export function isEmptyTabs<K extends string>(tabs: PageTabs<K> | undefined): boolean {
  return tabs === undefined || ('kind' in tabs && tabs.count === 0)
}

/**
 * The strip a handle draws: one trigger per declared option, the handle owning the value, so a
 * deep link renders its tab on the first server pass. It is the page's own strip (`ui/tabs`), not
 * `ViewTabs`: `page -> controls` is an undeclared edge, and `./controls` would add its whole
 * closure to the page barrel. A phone track or a `Select` is the slot form: `filterSlot` or a
 * `ControlsSlot` whose `render` returns a `ViewTabs`.
 */
function HandleTabs<K extends string>({
  state,
  label,
}: {
  state: ControlHandle<K>
  label: string
}): ReactElement {
  const [value, set] = state.use()
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        set(next as K)
      }}
    >
      <TabsList aria-label={label}>
        {(state.options ?? []).map((option) => (
          <TabsTrigger key={option.value} value={option.value}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

/** The node a `PageBar` or `Section` puts in its tabs home: the slot's own, or the handle's strip. */
export function renderTabs<K extends string>(tabs: PageTabs<K> | undefined): ReactNode {
  if (tabs === undefined) return null
  if ('kind' in tabs) return tabs.render()
  return <HandleTabs state={(tabs.state ?? tabs.handle) as ControlHandle<K>} label={tabs.label} />
}
