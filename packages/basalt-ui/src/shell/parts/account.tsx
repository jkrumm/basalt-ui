/**
 * The rail's account row, the last footer row: a skeleton while loading, "Sign in" when signed
 * out, and an avatar + name row opening a `Menu` when signed in. Collapsed, only the avatar
 * shows (the row keeps its accessible name through `aria-label`). Zero auth logic: the consumer
 * derives `Account` from its own client.
 */
import type { ReactElement } from 'react'
import { cn } from '../../core/cn'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../../ui/menu'
import { Skeleton } from '../../ui/skeleton'
import type { Account } from '../contract'

const COLLAPSED = '@max-[120px]'
const ROW =
  'flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-ctrl px-2.5 text-start text-sm text-muted-foreground hover:bg-accent hover:text-foreground'

/** First letter of the first and last name parts, uppercased. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return `${first}${last}`.toUpperCase()
}

function Avatar({ name, src }: { name: string; src: string | undefined }): ReactElement {
  if (src !== undefined) {
    return (
      <img
        src={src}
        alt=""
        data-slot="shell-rail-avatar"
        className="size-6 shrink-0 rounded-ctrl object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      data-slot="shell-rail-avatar"
      className="grid size-6 shrink-0 place-items-center rounded-ctrl bg-selected text-micro font-medium text-foreground"
    >
      {initialsOf(name)}
    </span>
  )
}

function UserGlyph(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 12a5 5 0 1 0 0 -10a5 5 0 0 0 0 10z" />
      <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
    </svg>
  )
}

export type RailAccountProps = { account: Account | undefined }

/** One footer row, or null when the shell has no account. */
export function RailAccount({ account }: RailAccountProps): ReactElement | null {
  if (account === undefined) return null
  // `status` is read first: a malformed object would otherwise surface as a raw TypeError.
  if (typeof account !== 'object' || account === null || typeof account.status !== 'string') {
    throw new Error('[basalt] RailAccount: prop "account" must be an object with a "status".')
  }
  if (account.status === 'loading') {
    return (
      <div
        data-slot="shell-rail-account"
        aria-hidden="true"
        className={cn('flex h-8 items-center gap-2 px-2.5', `${COLLAPSED}:justify-center`)}
      >
        <Skeleton className="size-6 shrink-0 rounded-ctrl" />
        <Skeleton className={cn('w-24 text-sm', `${COLLAPSED}:hidden`)} />
      </div>
    )
  }
  if (account.status === 'signed-out') {
    return (
      <button
        type="button"
        data-slot="shell-rail-account"
        aria-label="Sign in"
        className={cn(ROW, 'focus-ring', `${COLLAPSED}:justify-center`)}
        onClick={account.onSignIn}
      >
        <span className="grid size-6 shrink-0 place-items-center">
          <UserGlyph />
        </span>
        <span className={cn('truncate', `${COLLAPSED}:hidden`)}>Sign in</span>
      </button>
    )
  }
  return (
    <Menu>
      <MenuTrigger aria-label="Account menu" className={cn(ROW, `${COLLAPSED}:justify-center`)}>
        <Avatar name={account.name} src={account.avatar} />
        <span className={cn('flex min-w-0 flex-col leading-tight', `${COLLAPSED}:hidden`)}>
          <span className="truncate text-foreground">{account.name}</span>
          {account.detail !== undefined && (
            <span className="truncate text-xs text-faint">{account.detail}</span>
          )}
        </span>
      </MenuTrigger>
      <MenuContent side="right" align="end">
        {account.rows?.map((row) => (
          <MenuItem key={row.label} onClick={row.onClick}>
            {row.label}
          </MenuItem>
        ))}
        {account.onSignOut !== undefined && (
          <>
            {(account.rows?.length ?? 0) > 0 && <MenuSeparator />}
            <MenuItem onClick={account.onSignOut}>Sign out</MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  )
}
