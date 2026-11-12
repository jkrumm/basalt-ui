import { createFileRoute } from '@tanstack/react-router'
import { InnerNav, Page, PageBar, Section, SplitPage } from 'basalt-ui/page'
import { useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { useV3Tokens } from '../demo/v3-tokens'

const SECTIONS = ['profile', 'appearance', 'members', 'billing', 'api-keys'] as const
type SectionId = (typeof SECTIONS)[number]

const COPY: Record<SectionId, { title: string; body: string }> = {
  profile: { title: 'Profile', body: 'Your name, email and the avatar shown to your team.' },
  appearance: { title: 'Appearance', body: 'Theme, density and the language of the interface.' },
  members: { title: 'Members', body: 'Who can open this workspace and what they may change.' },
  billing: { title: 'Billing', body: 'Plan, invoices and the card on file.' },
  'api-keys': { title: 'API keys', body: 'Tokens for scripts and integrations.' },
}

const GROUPS = [
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'profile', label: 'Profile' },
      { id: 'appearance', label: 'Appearance' },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'members', label: 'Members', badge: { count: 4 } },
      { id: 'billing', label: 'Billing', badge: { dot: true, attention: true } },
      { id: 'api-keys', label: 'API keys' },
    ],
  },
] as const

// The controls layer's push field binds here (v3-ctl-6). Until then the route owns this structural
// stand-in: `?section=<id>` written with `history.pushState`, so Back walks the sections.
const listeners = new Set<() => void>()
const notify = (): void => listeners.forEach((listener) => listener())
function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('popstate', notify)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('popstate', notify)
  }
}
const raw = (): string | null => new URLSearchParams(window.location.search).get('section')
const hrefOf = (value: SectionId): string => {
  const params = new URLSearchParams(window.location.search)
  params.set('section', value)
  return `?${params.toString()}`
}
const go = (value: SectionId): void => {
  window.history.pushState(null, '', hrefOf(value))
  notify()
}

const section = {
  key: 'section',
  kind: 'enum',
  history: 'push',
  options: SECTIONS.map((value) => ({ value, label: COPY[value].title })),
  use: () => {
    const stored = useSyncExternalStore(subscribe, raw, () => null)
    return [SECTIONS.find((value) => value === stored) ?? SECTIONS[0], go] as [
      SectionId,
      (v: SectionId) => void,
    ]
  },
  useSource: () => ({ source: 'own' as const, inherited: undefined }),
  clear: () => undefined,
  get isDefault() {
    return raw() === null
  },
  get isSet() {
    return raw() !== null
  },
  link: (value: SectionId) => ({
    href: hrefOf(value),
    onClick: (event: { preventDefault(): void }) => {
      event.preventDefault()
      go(value)
    },
  }),
} as const

function useIsSet(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => raw() !== null,
    () => false,
  )
}

// #region recipe:inner-nav
function SettingsPane({ id }: { id: SectionId }): ReactElement {
  const { title, body } = COPY[id]
  return (
    <Section title={title}>
      <p className="m-0 text-sm text-muted-foreground">{body}</p>
    </Section>
  )
}

export function SettingsPage(): ReactElement {
  const [current] = section.use()
  const selected = useIsSet()
  return (
    <Page area="settings">
      <PageBar title="Settings" />
      <SplitPage
        selected={selected}
        list={() => <InnerNav label="Settings sections" state={section} groups={GROUPS} />}
        detail={() => <SettingsPane id={current} />}
      />
    </Page>
  )
}
// #endregion

function SettingsRoute(): ReactElement {
  useV3Tokens()
  return <SettingsPage />
}

export const Route = createFileRoute('/settings')({
  staticData: { title: 'Settings' },
  component: SettingsRoute,
})
