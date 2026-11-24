/**
 * Which phone nav the shell paints: the shipped tab bar, or one of two trial variants the owner is
 * comparing (Issue 3205). The pick is `data-phone-nav` on `<html>`, written by the playground's
 * switch; nothing else writes it and no prop names it, so the trial moves no public type. With the
 * attribute absent (always on the server) the shell renders exactly what it rendered before.
 *
 * Both variants are one full-width bar whose slots are the nav's SECTIONS, each with the summed
 * badge of its items, and a last More slot that slides the app aside to reveal the rail:
 *
 * - `tray` (A): a section's items in a tray attached to the bar, grown from the tapped icon.
 * - `drawer` (B): a section's items in a short bottom drawer with a grabber, over the bar.
 */
import { useSyncExternalStore } from 'react'

export const PHONE_NAV_VARIANTS = ['tray', 'drawer'] as const

/** `tabs` is the shipped tab bar. */
export type PhoneNavVariant = 'tabs' | (typeof PHONE_NAV_VARIANTS)[number]

/** The attribute on `<html>` that picks a trial variant. */
export const PHONE_NAV_ATTRIBUTE = 'data-phone-nav'

export function readPhoneNav(): PhoneNavVariant {
  if (typeof document === 'undefined') return 'tabs'
  const value = document.documentElement.getAttribute(PHONE_NAV_ATTRIBUTE)
  return (PHONE_NAV_VARIANTS as readonly string[]).includes(value ?? '')
    ? (value as PhoneNavVariant)
    : 'tabs'
}

function subscribe(onChange: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return () => {}
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [PHONE_NAV_ATTRIBUTE],
  })
  return () => observer.disconnect()
}

const serverSnapshot = (): PhoneNavVariant => 'tabs'

/** The variant picked on `<html>`; `tabs` on the server and while nothing is picked. */
export function usePhoneNav(): PhoneNavVariant {
  return useSyncExternalStore(subscribe, readPhoneNav, serverSnapshot)
}
