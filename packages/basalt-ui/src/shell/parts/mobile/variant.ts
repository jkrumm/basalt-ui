/**
 * Which phone nav the shell paints: the section bar with its short drawer (the default), or the tab
 * bar the shell shipped before it (the opt-out). The pick is `data-phone-nav="tabs"` on `<html>`; with
 * the attribute absent, on the server included, a phone gets the section bar. No prop names it, so the
 * shell's public types do not move. The server markup is always the section bar: an app that opts out and
 * renders on the server shows it until hydration swaps in the tab bar.
 *
 * The section bar is one full-width bar whose slots are the nav's SECTIONS, each with the summed badge
 * of its items, and a last More slot that slides the app aside to reveal the rail. A section opens a
 * short drawer over the bar that drags up to a tall snap and down to close.
 */
import { useSyncExternalStore } from 'react'

/** `drawer` is the section bar with its short drawer; `tabs` is the tab bar. */
export type PhoneNavVariant = 'drawer' | 'tabs'

/** The attribute on `<html>` that opts a phone into the tab bar. */
export const PHONE_NAV_ATTRIBUTE = 'data-phone-nav'

export function readPhoneNav(): PhoneNavVariant {
  if (typeof document === 'undefined') return 'drawer'
  return document.documentElement.getAttribute(PHONE_NAV_ATTRIBUTE) === 'tabs' ? 'tabs' : 'drawer'
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

const serverSnapshot = (): PhoneNavVariant => 'drawer'

/** The phone nav picked on `<html>`: `drawer` unless the app opted into `tabs`. */
export function usePhoneNav(): PhoneNavVariant {
  return useSyncExternalStore(subscribe, readPhoneNav, serverSnapshot)
}
