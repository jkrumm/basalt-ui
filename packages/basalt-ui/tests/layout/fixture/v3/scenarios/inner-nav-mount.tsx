/**
 * The inner-nav scenario's browser half: a shell-less `Page` holding an `InnerNav` over a test-local
 * push field (`?section=`), standalone or as the list of a `SplitPage`. `inner-nav.ts` loads it on
 * mount, so the registry the test process imports stays free of DOM, CSS and `src` imports.
 */
import '../../tailwind-layers.css'
import '../../tailwind.generated.css'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { Page } from '../../../../../src/page/page'
import type { InnerNavGroup } from '../../../../../src/page/contract'
import { InnerNav } from '../../../../../src/page/parts/inner-nav'
import { pushField } from '../../../../../src/page/parts/inner-nav.test-support'
import { SplitPage } from '../../../../../src/page/parts/split-page'
import type { ControlsSlot } from '../../../../../src/core/ports'
import type { FixtureSpec } from '../../spec'
import type { InnerNavSpec } from './inner-nav'

const RESET = document.createElement('style')
RESET.textContent = '*,::before,::after{box-sizing:border-box}body{margin:0}'

function linkStylesheet(): Promise<void> {
  if (document.querySelector('link[data-inner-nav]') !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/main.css'
    link.dataset['innerNav'] = ''
    link.addEventListener('load', () => resolve())
    link.addEventListener('error', () =>
      reject(new Error('LAYOUT: the fixture bundle emitted no main.css')),
    )
    document.head.append(link)
  })
}

const SECTIONS = ['general', 'billing', 'team', 'security', 'integrations', 'audit'] as const
type Section = (typeof SECTIONS)[number]

const GROUPS: readonly InnerNavGroup[] = [
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'general', label: 'General' },
      { id: 'billing', label: 'Billing', badge: { count: 2, attention: true } },
      { id: 'team', label: 'Team', badge: { dot: true } },
    ],
  },
  {
    id: 'org',
    label: 'Organisation',
    items: [
      { id: 'security', label: 'Security' },
      {
        id: 'integrations',
        label: 'Integrations',
        menu: [
          { id: 'sync', label: 'Sync now', onSelect: () => {} },
          { id: 'reset', label: 'Reset', onSelect: () => {} },
        ],
      },
      { id: 'audit', label: 'Audit log' },
    ],
  },
]

const filter: ControlsSlot = {
  kind: 'controls-slot',
  count: 1,
  render: () => (
    <input
      aria-label="Filter sections"
      placeholder="Filter"
      className="h-ctl w-full rounded-ctrl bg-secondary px-3 text-sm"
    />
  ),
}

/** One field per page load: `mount` resets the address bar, so a remount starts unset. */
const field = pushField<Section>(SECTIONS, 'general', 'section')

function Body({ section }: { section: Section }): ReactElement {
  return (
    <div
      data-testid="pane"
      style={{ height: 2400 }}
      className="rounded-card bg-card p-4 text-sm text-muted-foreground"
    >
      Pane: {section}
    </div>
  )
}

function Screen({ mode }: { mode: 'standalone' | 'split' }): ReactElement {
  const state = field
  const [section] = state.use()
  const nav = <InnerNav label="Settings" state={state} filter={filter} groups={GROUPS} />
  return (
    <Page area="settings">
      <main className="px-0 py-4">
        {mode === 'standalone' ? (
          <>
            {nav}
            <Body section={section} />
          </>
        ) : (
          <SplitPage
            selected={state.isSet}
            list={() => nav}
            detail={() => <Body section={section} />}
          />
        )}
      </main>
    </Page>
  )
}

let root: Root | null = null

export async function mount(spec: FixtureSpec, container: HTMLElement): Promise<void> {
  await linkStylesheet()
  root?.unmount()
  if (!RESET.isConnected) document.head.append(RESET)
  window.history.replaceState(null, '', '/')
  window.scrollTo(0, 0)
  root = createRoot(container)
  const { mode } = (spec as InnerNavSpec).innerNav ?? { mode: 'standalone' as const }
  root.render(<Screen mode={mode} />)
}
