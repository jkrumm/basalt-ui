/**
 * User-scenario store — playground-only simulator state for the `SidebarAccount` footer contract
 * (`BasaltAccountState`). Backed by `createPersistedState` (the same versioned-localStorage
 * primitive demoed in SettingsPage), so toggling a control on `/user` persists across navigation
 * and drives the live sidebar footer + the Account/Billing drawer demos.
 *
 * `scenarioToAccountState` is the pure mapper a real consumer would write against its own auth
 * client (see `BasaltAccountProps`' Better-Auth recipe) — here it maps the scenario knobs instead.
 */
import type { AccountBadgeTone, BasaltAccountState, BasaltPlan, BasaltRole } from 'basalt-ui'
import { createPersistedState } from 'basalt-ui'

export type UserScenario = {
  auth: 'loading' | 'signed-out' | 'signed-in'
  plan: 'free' | 'pro' | 'team'
  planStatus: 'active' | 'trialing' | 'past_due' | 'canceled'
  role: 'user' | 'admin' | 'owner'
  name: string
  email: string
  image: string
}

const INITIAL_SCENARIO: UserScenario = {
  auth: 'signed-in',
  plan: 'free',
  planStatus: 'active',
  role: 'user',
  name: 'Jordan Rivers',
  email: 'jordan@example.com',
  image: '',
}

export const useUserScenario = createPersistedState({
  key: 'user-scenario',
  version: 1,
  initial: INITIAL_SCENARIO,
})

const PLAN_LABEL: Record<UserScenario['plan'], string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
}

const ROLE_LABEL: Record<UserScenario['role'], string> = {
  user: 'Member',
  admin: 'Admin',
  owner: 'Owner',
}

const PLAN_TONE: Record<UserScenario['planStatus'], AccountBadgeTone> = {
  active: 'success',
  trialing: 'brand',
  past_due: 'warn',
  canceled: 'neutral',
}

// Fixed literal date — deterministic demo data, never `new Date()`/`Date.now()`.
const DEMO_RENEWS_AT = new Date('2026-08-15T00:00:00Z')

/** Exported separately from `scenarioToAccountState` so plan-driven UI (e.g. the Billing drawer)
 * can read the derived plan regardless of auth status. */
export function scenarioToPlan(scenario: UserScenario): BasaltPlan {
  const renews = scenario.planStatus === 'active' || scenario.planStatus === 'trialing'
  return {
    key: scenario.plan,
    label: PLAN_LABEL[scenario.plan],
    status: scenario.planStatus,
    isFree: scenario.plan === 'free',
    renewsAt: renews ? DEMO_RENEWS_AT : null,
    tone: PLAN_TONE[scenario.planStatus],
  }
}

function scenarioToRole(scenario: UserScenario): BasaltRole {
  return { key: scenario.role, label: ROLE_LABEL[scenario.role] }
}

/** Pure mapper: scenario knobs → `BasaltAccountState`. Mirrors what a real consumer derives from
 * its auth client's session/plan/role hooks. */
export function scenarioToAccountState(scenario: UserScenario): BasaltAccountState {
  if (scenario.auth === 'loading') return { status: 'loading' }
  if (scenario.auth === 'signed-out') return { status: 'unauthenticated' }

  return {
    status: 'authenticated',
    identity: {
      id: 'demo-user',
      name: scenario.name,
      email: scenario.email,
      image: scenario.image === '' ? null : scenario.image,
      emailVerified: true,
    },
    role: scenarioToRole(scenario),
    plan: scenarioToPlan(scenario),
  }
}
