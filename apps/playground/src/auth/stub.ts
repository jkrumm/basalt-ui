/**
 * The playground's stand-in for an account service: it accepts one login, remembers it for the tab,
 * and tells the shell who is signed in. A real app replaces this file with its client; the forms
 * call `signIn`, `register`, `requestReset` and `signOut` and map what they throw through
 * `toSubmitErrors`.
 */
import { useSyncExternalStore } from 'react'

export const DEMO_LOGIN = { username: 'demo', password: 'demo' } as const

/** The paths drawn outside the shell. */
export const AUTH_PATHS: readonly string[] = ['/sign-in', '/register']

export type Session = { username: string; email: string } | null

let session: Session = null
const listeners = new Set<() => void>()

const set = (next: Session): void => {
  session = next
  for (const listener of listeners) listener()
}

const later = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/** The current session; the shell's account row reads it. */
export function useSession(): Session {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => {
        listeners.delete(notify)
      }
    },
    () => session,
    () => null,
  )
}

/** Accepts `demo` / `demo`; any other pair comes back on the Password field, as a real service answers. */
export async function signIn(input: { username: string; password: string }): Promise<void> {
  await later(400)
  if (input.username !== DEMO_LOGIN.username || input.password !== DEMO_LOGIN.password) {
    throw {
      fieldErrors: { password: 'The username or password is wrong. The demo takes demo and demo.' },
    }
  }
  set({ username: input.username, email: `${input.username}@example.com` })
}

/** Creates the account and signs it in; the one name it refuses is a taken one. */
export async function register(input: {
  name: string
  email: string
  password: string
}): Promise<void> {
  await later(500)
  if (input.email.toLowerCase() === 'demo@example.com') {
    throw { fieldErrors: { email: 'An account with this address exists. Sign in instead.' } }
  }
  set({ username: input.name, email: input.email })
}

/** Always answers the same, so the page cannot be used to probe which addresses hold an account. */
export async function requestReset(_input: { email: string }): Promise<void> {
  await later(400)
}

export function signOut(): void {
  set(null)
}
