import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import type { ControlHandle, Tone } from '../core/ports'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import type { PageTabBadge, PageTabs } from './contract'

/** True when `tabs` draws nothing: unset, or a slot with no controls. A handle always draws. */
export function isEmptyTabs<K extends string>(tabs: PageTabs<K> | undefined): boolean {
  return tabs === undefined || ('kind' in tabs && tabs.count === 0)
}

/** Which look a home gives its handle tabs: the page bar's view row, or a section's segment. */
export type TabsLook = 'pill' | 'segment'

/** Below the `regular` container tier each segment tab takes an equal share of its (full-width) home. */
const PHONE_EQUAL = '@max-regular:flex-1 @max-regular:basis-0'

const DOT: Record<Tone, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  accent: 'bg-brand',
  neutral: 'bg-muted-foreground',
}

/** A tab's tone dot and count: the count in muted tabular figures, in the bad tone for attention. */
function TabBadge({ badge, children }: { badge: PageTabBadge | undefined; children: ReactNode }) {
  return (
    <>
      {badge?.tone !== undefined && (
        <span
          aria-hidden="true"
          data-slot="page-tab-dot"
          className={cn('size-1.5 shrink-0 rounded-full', DOT[badge.tone])}
        />
      )}
      {children}
      {badge?.count !== undefined && (
        <span
          data-slot="page-tab-count"
          data-attention={badge.attention === true ? '' : undefined}
          className={cn(
            'text-xs font-normal tabular-nums',
            badge.attention === true ? 'text-bad' : 'text-muted-foreground',
          )}
        >
          {badge.count}
        </span>
      )}
    </>
  )
}

/**
 * The strip a handle draws: one trigger per declared option, the handle owning the value, so a
 * deep link renders its tab on the first server pass. It is the page's own strip (`ui/tabs`), not
 * `ViewTabs`: `page -> controls` is an undeclared edge, and `./controls` would add its whole
 * closure to the page barrel. In the page bar it is the `pill` look, a tab per named view with its
 * count, scrolling sideways when the tabs outgrow the row. In a section it is the segment look of
 * `ViewTabs`' strip, and below the `regular` container tier its home takes the full line and every
 * tab an equal share. A `Select` for many options is the slot form: `filterSlot` or a
 * `ControlsSlot` whose `render` returns a `ViewTabs`.
 */
function HandleTabs<K extends string>({
  state,
  label,
  badges,
  look,
}: {
  state: ControlHandle<K>
  label: string
  badges: Partial<Record<K, PageTabBadge>> | undefined
  look: TabsLook
}): ReactElement {
  const [value, set] = state.use()
  return (
    <Tabs
      variant={look}
      value={value}
      className="min-w-0"
      onValueChange={(next) => {
        set(next as K)
      }}
    >
      <TabsList aria-label={label}>
        {(state.options ?? []).map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            {...(look === 'segment' && { className: PHONE_EQUAL })}
          >
            <TabBadge badge={badges?.[option.value]}>{option.label}</TabBadge>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

/** The node a `PageBar` or `Section` puts in its tabs home: the slot's own, or the handle's strip. */
export function renderTabs<K extends string>(
  tabs: PageTabs<K> | undefined,
  look: TabsLook,
): ReactNode {
  if (tabs === undefined) return null
  if ('kind' in tabs) return tabs.render()
  return (
    <HandleTabs
      state={(tabs.state ?? tabs.handle) as ControlHandle<K>}
      label={tabs.label}
      badges={tabs.badges}
      look={look}
    />
  )
}
