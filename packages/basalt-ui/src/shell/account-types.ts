/**
 * Provider-agnostic account contract for the sidebar footer (`SidebarAccount`). Mantine-free —
 * these are plain types; the consumer's real auth client (Better Auth, Clerk, a homegrown session
 * hook, …) maps into `BasaltAccountState` + `BasaltAccountActions`. basalt-ui has zero dependency
 * on any auth library and ships no `./auth` subpath — this is the seam, not an adapter.
 */
import type { ReactNode } from 'react'

/** Badge tone for a role/plan chip. No dedicated tone union exists elsewhere in the shell/tokens
 * layers, so this is defined locally. */
export type AccountBadgeTone = 'neutral' | 'brand' | 'success' | 'warn'

/** The signed-in user's identity. `image` is nullable — `SidebarAccount` falls back to initials. */
export type BasaltIdentity = {
  id: string
  name: string
  email: string
  image?: string | null
  emailVerified?: boolean
}

/** An optional role chip (e.g. org role, admin flag). */
export type BasaltRole = {
  label: string
  key?: string
  tone?: AccountBadgeTone
}

/** An optional plan/billing chip. `isFree` gates the "Upgrade" menu entry. */
export type BasaltPlan = {
  key: string
  label: string
  status?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none'
  isFree?: boolean
  renewsAt?: Date | null
  tone?: AccountBadgeTone
}

/** A consumer-supplied extra entry appended to the account menu, before the divider + sign-out. */
export type AccountMenuItem = {
  key: string
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
}

/**
 * The account's current state — a discriminated union so `SidebarAccount` renders exactly one of
 * a loading skeleton, a compact sign-in control, or the full identity row. Nothing here assumes a
 * particular auth library; the consumer derives this from whatever session hook it already has.
 */
export type BasaltAccountState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; identity: BasaltIdentity; role?: BasaltRole; plan?: BasaltPlan }

/** Callbacks wired by the consumer; each menu entry only renders when its callback is present. */
export type BasaltAccountActions = {
  onSignIn?: () => void
  onSignOut?: () => void | Promise<void>
  onManageAccount?: () => void
  onManageBilling?: () => void
  /** Surfaced only when `plan.isFree` is true. */
  onUpgrade?: () => void
  extraMenuItems?: AccountMenuItem[]
}

/**
 * Props for `SidebarAccount` (and the `account` prop threaded through `AppSidebar`/`BasaltShell`).
 * Presentational only — basalt-ui has no auth dependency; the consumer maps its real auth client
 * into this shape.
 *
 * ## Better-Auth mapping recipe (documentation only — basalt-ui does NOT depend on better-auth)
 *
 * - `identity` ← `authClient.useSession().data.user` (`id`/`name`/`email`/`image`/`emailVerified`).
 * - `state.status` ← derived from `useSession()`: `isPending` → `'loading'`; `data == null` →
 *   `'unauthenticated'`; else `'authenticated'`.
 * - `role` ← the admin plugin's `session.user.role`, or the org plugin's
 *   `authClient.organization.useActiveMember().data.role`.
 * - `plan` ← a billing adapter, provider-specific:
 *     - Polar: `authClient.customer.state().activeSubscriptions[]` (none ⇒
 *       `{ key: 'free', isFree: true }`).
 *     - Stripe: `authClient.subscription.list()`.
 * - `onSignOut` ← `authClient.signOut(...)`.
 * - `onManageBilling` ← Polar `authClient.customer.portal()`.
 * - `onUpgrade` ← `authClient.checkout({ slug })`.
 * - `onManageAccount` ← an account route built on `authClient.updateUser`/`authClient.changeEmail`.
 *
 * **Reactivity caveat:** only client `authClient.*` calls re-render `useSession` — a known Better
 * Auth issue (better-auth#3608). Server-side mutations need a manual refetch/invalidate.
 *
 * @example
 * const { data, isPending } = authClient.useSession()
 * const account: BasaltAccountProps = {
 *   state: isPending
 *     ? { status: 'loading' }
 *     : data == null
 *       ? { status: 'unauthenticated' }
 *       : { status: 'authenticated', identity: data.user, plan: myPlan },
 *   actions: {
 *     onSignIn: () => authClient.signIn.social({ provider: 'google' }),
 *     onSignOut: () => authClient.signOut(),
 *     onManageBilling: () => authClient.customer.portal(),
 *   },
 * }
 * <BasaltShell {...rest} account={account} />
 */
export type BasaltAccountProps = {
  state: BasaltAccountState
  actions?: BasaltAccountActions
}
