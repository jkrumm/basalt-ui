/**
 * Settings page — a grown-up settings surface built from what basalt-ui already ships: the
 * account contract, notifications registry, connectivity aggregator, command shortcuts, the
 * theme lab, and the dashboard-composite `SettingsSection`/`SettingsRow`/`DangerZone` building
 * blocks. Rebuilt from the former raw demo dump (AccountDrawer + BillingDrawer + an inline
 * theme-lab-only /settings) into one real page with section cards.
 *
 * Layout: a centered column, stacked `SettingsSection` cards (head-font title + muted description,
 * panel + shadow-card + 10px radius), each holding a run of `SettingsRow`s (13px label + muted
 * 12.5px sub-description + a right-aligned control) — row dividers (`--vx-divider`) and the
 * no-border-on-last-row rule are handled by the section's own `.rows` container, so call sites
 * never manage a `borderBottom` flag.
 *
 * Sections: Account (+ a `DangerZone` for account deletion), Billing, Appearance (color scheme +
 * a collapsed Theme lab accordion), Notifications (per-intent Switch rows), Shortcuts
 * (ShortcutsHelp), Connectivity (useConnectivity + ConnectivityIndicator), Developer (the
 * createPersistedState counter demo).
 *
 * The sidebar account menu deep-links here via `navigate({ to: '/settings', hash: 'account' | 'billing' })`
 * (see routes/__root.tsx) — TanStack Router's `hashScrollIntoView` (default true) scrolls the
 * matching section into view. `SettingsSection` has no `id` prop, so each anchored section is
 * wrapped in a plain `<div id="…">` — `id="account"` / `id="billing"` / `id="appearance"` below are
 * load-bearing anchors.
 */
import type { CSSProperties } from 'react'
import { useState } from 'react'
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Code,
  Group,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  useMantineColorScheme,
} from '@mantine/core'
import {
  ConnectivityIndicator,
  DangerZone,
  SettingsRow,
  SettingsSection,
  useConnectivity,
} from 'basalt-ui'
import type { AccountBadgeTone } from 'basalt-ui'
import { ShortcutsHelp } from 'basalt-ui/commands'
import type { NotificationIntent } from 'basalt-ui/notifications'
import { createPersistedState } from 'basalt-ui/state'
import { COLOR_GROUPS, DeriveControls, ThemeLabControls } from 'basalt-ui/theme-lab'
import { alpha, VX } from 'basalt-ui/tokens'
import { IconCopy, IconReset } from './icons'
import { DEMO_SERIES } from './series'
import { scenarioToAccountState, scenarioToPlan, useUserScenario } from './user-scenario-store'
import type { UserScenario } from './user-scenario-store'

// ── Shared type styles (mirrors docs/DESIGN-SPEC.md §3, per-page convention — see DashboardPage) ──

// Same head-font treatment `SettingsSection` uses for its own title — the identity name IS a
// title, just rendered inline with the initials block rather than at the top of a card.
const identityNameStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-head)',
  fontStretch: '88%',
  fontWeight: 550,
  fontSize: VX.text.md,
  color: VX.ink,
}

// Status badge idiom (docs/DESIGN-SPEC.md §5 "Delta/status badge"): mono 11px uppercase — the
// theme's `variant="light"` resolver already supplies the status-13% tint + radius 6 (see
// `basaltVariantColorResolver` in the package theme), so only the mono font needs a call-site
// override.
const statusBadgeStyles = {
  label: { fontFamily: 'var(--basalt-font-mono)', fontSize: VX.text.micro },
}

const identityMetaStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-mono)',
  // Mono account-meta line kept at 12px (not bumped onto xs=12.5), matching the "12px stays a
  // theme-allow: literal" convention (see DashboardPage meterValueStyle) — no matching VX.text step.
  fontSize: 12,
  color: VX.faint,
}

const initialsBlockStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 44,
  height: 44,
  flexShrink: 0,
  borderRadius: 7,
  backgroundColor: alpha(VX.ink, 0.1),
  fontFamily: 'var(--basalt-font-mono)',
  fontSize: VX.text.md,
  fontWeight: 600,
  color: VX.ink,
}

// ── Account ───────────────────────────────────────────────────────────────────────────────────

/** First letter of the first + last name parts, uppercased — mirrors the sidebar footer's
 * initials-block derivation (basalt-ui's `SidebarAccount` never renders a photo/avatar either). */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return `${first}${last}`.toUpperCase()
}

function InitialsBlock({ name }: { name: string }) {
  return (
    <div style={initialsBlockStyle} aria-hidden>
      {getInitials(name)}
    </div>
  )
}

function AccountSection() {
  const [scenario, setScenario] = useUserScenario()
  const accountState = scenarioToAccountState(scenario)

  return (
    <>
      <div id="account">
        <SettingsSection title="Account" description="Your profile, security, and access.">
          {accountState.status === 'loading' && (
            <Text size="sm" c="dimmed">
              Loading account…
            </Text>
          )}

          {accountState.status === 'unauthenticated' && (
            <SettingsRow
              label="You're signed out"
              description="Sign in to manage your profile, security, and billing."
              control={
                <Button
                  size="compact-sm"
                  onClick={() => setScenario({ ...scenario, auth: 'signed-in' })}
                >
                  Sign in
                </Button>
              }
            />
          )}

          {accountState.status === 'authenticated' && (
            <>
              <Group gap="md" wrap="nowrap">
                <InitialsBlock name={scenario.name} />
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Group gap="xs" align="center">
                    <Text style={identityNameStyle}>{scenario.name}</Text>
                    <Badge size="sm" variant="light" color="green" styles={statusBadgeStyles}>
                      Email verified
                    </Badge>
                  </Group>
                  <Text style={identityMetaStyle}>{scenario.email}</Text>
                </Stack>
              </Group>

              <Stack gap="xs">
                <TextInput
                  label="Name"
                  value={scenario.name}
                  onChange={(e) => setScenario({ ...scenario, name: e.currentTarget.value })}
                />
                <TextInput
                  label="Email"
                  value={scenario.email}
                  onChange={(e) => setScenario({ ...scenario, email: e.currentTarget.value })}
                />
              </Stack>

              <SettingsRow
                label="Change password"
                description="Update your account password"
                control={
                  <Button size="compact-sm" variant="default" disabled>
                    Change
                  </Button>
                }
              />
              <SettingsRow
                label="Active sessions"
                description="Devices and browsers currently signed in"
                control={
                  <Button size="compact-sm" variant="default" disabled>
                    View
                  </Button>
                }
              />
            </>
          )}
        </SettingsSection>
      </div>

      {accountState.status === 'authenticated' && (
        <DangerZone
          title="Delete account"
          description="Permanently remove your account and all associated data."
        >
          <SettingsRow
            label="Delete this account"
            control={
              <Button
                variant="outline"
                color="red"
                size="compact-sm"
                onClick={() => setScenario({ ...scenario, auth: 'signed-out' })}
              >
                Delete account
              </Button>
            }
          />
        </DangerZone>
      )}
    </>
  )
}

// ── Billing ───────────────────────────────────────────────────────────────────────────────────

/** Maps the plan's tone to a Mantine color name — `brand` has no entry so the Badge falls back to
 * the theme's `primaryColor` (mirrors `SidebarAccount`'s `toneColorProp`, kept local here since
 * it isn't part of the published contract). */
const TONE_BADGE_COLOR: Partial<Record<AccountBadgeTone, string>> = {
  neutral: 'gray',
  success: 'green',
  warn: 'yellow',
}

function toneBadgeColorProp(tone: AccountBadgeTone): { color: string } | Record<string, never> {
  const color = TONE_BADGE_COLOR[tone]
  return color === undefined ? {} : { color }
}

const PLAN_STATUS_LABEL: Record<UserScenario['planStatus'], string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past due',
  canceled: 'Canceled',
}

function BillingSection() {
  const [scenario, setScenario] = useUserScenario()
  const plan = scenarioToPlan(scenario)
  const onUpgrade = () => setScenario({ ...scenario, plan: 'pro' })
  const onResubscribe = () => setScenario({ ...scenario, planStatus: 'active' })

  return (
    <div id="billing">
      <SettingsSection title="Billing" description="Plan, payment method, and invoices.">
        {scenario.planStatus === 'past_due' && (
          <Alert color="yellow" title="Payment failed">
            We couldn&apos;t process your last payment. Update your payment method to keep your plan
            active.
          </Alert>
        )}
        {scenario.planStatus === 'trialing' && (
          <Alert color="blue" title="Trial active">
            Your trial ends soon — add a payment method to keep your plan after it expires.
          </Alert>
        )}
        {scenario.planStatus === 'canceled' && (
          <Alert color="gray" title="Subscription canceled">
            Your plan was canceled. Resubscribe any time to regain access.
          </Alert>
        )}

        <SettingsRow
          label={`${plan.label} plan`}
          description={
            plan.renewsAt
              ? `Renews ${plan.renewsAt.toLocaleDateString()}`
              : 'No active billing cycle'
          }
          control={
            <Group gap="xs" wrap="nowrap">
              <Badge
                size="sm"
                variant="light"
                styles={statusBadgeStyles}
                {...toneBadgeColorProp(plan.tone ?? 'neutral')}
              >
                {PLAN_STATUS_LABEL[scenario.planStatus]}
              </Badge>
              {plan.isFree && (
                <Button size="compact-sm" onClick={onUpgrade}>
                  Upgrade to Pro
                </Button>
              )}
              {scenario.planStatus === 'canceled' && (
                <Button size="compact-sm" variant="default" onClick={onResubscribe}>
                  Resubscribe
                </Button>
              )}
            </Group>
          }
        />
        <SettingsRow
          label="Payment method"
          description="•••• 4242 · Visa"
          control={
            <Button size="compact-sm" variant="default">
              Manage payment method
            </Button>
          }
        />
        <SettingsRow
          label="Invoices"
          description="Download past invoices and receipts"
          control={
            <Button size="compact-sm" variant="default" disabled>
              View invoices
            </Button>
          }
        />
      </SettingsSection>
    </div>
  )
}

// ── Appearance ────────────────────────────────────────────────────────────────────────────────

/** Consumer-augmented theme-lab groups: structural framework chrome + the app's own Demo series. */
const LAB_GROUPS = [
  ...COLOR_GROUPS,
  {
    title: 'Demo series',
    items: Object.keys(DEMO_SERIES).map((key) => ({
      var: `--vx-demo-${key}`,
      label: key[0]!.toUpperCase() + key.slice(1),
    })),
  },
]

function AppearanceSection() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const [copied, setCopied] = useState<string | null>(null)

  return (
    <div id="appearance">
      <SettingsSection
        title="Appearance"
        description="Color scheme, palette derivation, and low-level token inspection."
      >
        <SettingsRow
          label="Color scheme"
          description="Charts and chrome share one --vx-* identity — toggling restyles both with no React re-render."
          control={
            <SegmentedControl
              size="xs"
              value={colorScheme}
              onChange={(v) => setColorScheme(v as 'light' | 'dark' | 'auto')}
              data={[
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
                { label: 'System', value: 'auto' },
              ]}
            />
          }
        />

        <Accordion variant="separated">
          <Accordion.Item value="derive">
            <Accordion.Control>Derive</Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="dimmed" mb="sm">
                Retune the whole palette from one accent seed + a neutral family + four level knobs
                (`basalt-ui/tokens`'s `deriveTokens`), plus a fifth, color-independent radius level
                (`deriveRadius`). This is the dev-tuning path — bake a config into production via
                `createBasaltTheme`'s `derive`/`radius` options instead.
              </Text>
              <DeriveControls resetIcon={<IconReset />} />
            </Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="theme-lab">
            <Accordion.Control>Theme lab</Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="dimmed" mb="sm">
                Low-level inspector for the structural `--vx-*` vars the derive engine doesn't own
                (chart-only status hues, chart line/dot chrome, the overlay surface) plus this app's
                own Demo series — not an identity tuner (use Derive above for that). Overrides are
                written as inline styles on &lt;html&gt; and persist to localStorage.
              </Text>
              <ThemeLabControls
                groups={LAB_GROUPS}
                copyIcon={<IconCopy />}
                resetIcon={<IconReset />}
                onCopy={(json) => setCopied(json)}
              />
              {copied && (
                <Stack gap={4} mt="sm">
                  <Text size="xs" c="dimmed">
                    Copied overrides (paste into palette.ts to bake in):
                  </Text>
                  <Code block>{copied}</Code>
                </Stack>
              )}
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </SettingsSection>
    </div>
  )
}

// ── Notifications ─────────────────────────────────────────────────────────────────────────────

/** Per-intent notification opt-in — reflects `basalt-ui/notifications`' `NotificationIntent`
 * union directly (success/info/warning/error), so the toggle set never drifts from the package's
 * actual typed surface. Playground-only preference; it doesn't gate the notify helpers demoed on
 * /notifications. */
const useNotificationPrefs = createPersistedState({
  key: 'notification-prefs',
  version: 1,
  initial: { success: true, info: true, warning: true, error: true } satisfies Record<
    NotificationIntent,
    boolean
  >,
})

type NotificationCategory = { intent: NotificationIntent; label: string; description: string }

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    intent: 'success',
    label: 'Success confirmations',
    description: 'Completed actions — saves, uploads, exports',
  },
  {
    intent: 'info',
    label: 'Product updates',
    description: 'New features, release notes, and general info',
  },
  {
    intent: 'warning',
    label: 'Warnings',
    description: 'Storage limits, expiring sessions, and other heads-up alerts',
  },
  {
    intent: 'error',
    label: 'Errors',
    description: 'Failed actions that need your attention',
  },
]

function NotificationsSection() {
  const [prefs, setPrefs] = useNotificationPrefs()

  return (
    <SettingsSection
      title="Notifications"
      description="Choose which notification intents raise a toast and land in your inbox."
    >
      {NOTIFICATION_CATEGORIES.map((category) => (
        <SettingsRow
          key={category.intent}
          label={category.label}
          description={category.description}
          control={
            <Switch
              checked={prefs[category.intent]}
              onChange={(e) => setPrefs({ ...prefs, [category.intent]: e.currentTarget.checked })}
            />
          }
        />
      ))}
    </SettingsSection>
  )
}

// ── Shortcuts ─────────────────────────────────────────────────────────────────────────────────

function ShortcutsSection() {
  return (
    <SettingsSection
      title="Shortcuts"
      description="Keyboard shortcuts registered through basalt-ui/commands."
    >
      <ShortcutsHelp title="Registered shortcuts" />
    </SettingsSection>
  )
}

// ── Connectivity ──────────────────────────────────────────────────────────────────────────────

function ConnectivitySection() {
  const snap = useConnectivity()

  return (
    <SettingsSection
      title="Connectivity"
      description="Aggregates browser online/offline, React Query cache, SSE, and health-check pings."
    >
      <SettingsRow
        label="Connection"
        description={`Status: ${snap.status}`}
        control={<ConnectivityIndicator />}
      />
    </SettingsSection>
  )
}

// ── Developer ─────────────────────────────────────────────────────────────────────────────────

// Created once at module scope — the hook is stable across renders and tabs.
// Navigate away and back: the counter value survives (stored as basalt:settings-counter).
const useSettingsCounter = createPersistedState({ key: 'settings-counter', version: 1, initial: 0 })

function DeveloperSection() {
  const [count, setCount] = useSettingsCounter()

  return (
    <SettingsSection
      title="Developer"
      description="createPersistedState — a factory hook backed by versioned localStorage."
    >
      <Text size="sm" c="dimmed" mb="sm">
        Navigate away and back — the counter survives. Cross-tab: open another window and click to
        see both stay in sync.
      </Text>
      <Group gap="sm" align="center">
        <Button size="compact-sm" variant="default" onClick={() => setCount(count - 1)}>
          −
        </Button>
        <Badge size="lg" variant="default">
          {count}
        </Badge>
        <Button size="compact-sm" variant="default" onClick={() => setCount(count + 1)}>
          +
        </Button>
        <Button size="compact-sm" variant="subtle" color="gray" onClick={() => setCount(0)}>
          Reset
        </Button>
      </Group>
    </SettingsSection>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  return (
    <Stack gap="md" maw={840} mx="auto" p="md">
      <AccountSection />
      <BillingSection />
      <AppearanceSection />
      <NotificationsSection />
      <ShortcutsSection />
      <ConnectivitySection />
      <DeveloperSection />
    </Stack>
  )
}
