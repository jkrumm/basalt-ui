/**
 * GFM alert detection (`> [!NOTE]` etc.) shared by `./markdown` and `./mdx` (docs/CONTENT-SPEC.md
 * §3). Operates on RENDERED React children rather than the hast tree — react-markdown's
 * blockquote override and MDX's compiled `<blockquote><p>…</p></blockquote>` output share the
 * same shape, so one implementation covers both without needing a hast node (which MDX never
 * provides to its component overrides).
 *
 * Not part of the public surface — the `blockquote` renderers in `./markdown`/`./mdx` are the only
 * consumers.
 */
import type { ReactNode } from 'react'
import { cloneElement, isValidElement } from 'react'
import type { CalloutKind } from './callout'

export type AlertKind = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION'

const ALERT_MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/

/** GitHub's alert→severity mapping (NOTE/IMPORTANT read as informational, TIP as positive). */
export const ALERT_CALLOUT_KIND: Record<AlertKind, CalloutKind> = {
  NOTE: 'info',
  IMPORTANT: 'info',
  TIP: 'good',
  WARNING: 'warn',
  CAUTION: 'bad',
}

export const ALERT_TITLE: Record<AlertKind, string> = {
  NOTE: 'Note',
  TIP: 'Tip',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution',
}

export type AlertMatch = {
  readonly kind: AlertKind
  /** The exact matched marker text (including trailing whitespace) — pass to `stripAlertMarker`. */
  readonly marker: string
}

/** Inter-element whitespace (react-markdown emits `['\n', <p>…</p>, '\n']` blockquote children)
 * — never the marker carrier, so traversal skips it. */
function isSkippable(node: ReactNode): boolean {
  return node === null || node === undefined || (typeof node === 'string' && node.trim() === '')
}

/** Follows the first SUBSTANTIVE child at every level — mirrors "the first paragraph's first text
 * child" from docs/CONTENT-SPEC.md §3, and keeps this symmetric with `stripAlertMarker` below. */
function firstText(node: ReactNode): string | undefined {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) {
    const first = node.find((child) => !isSkippable(child))
    return first === undefined ? undefined : firstText(first as ReactNode)
  }
  if (isValidElement(node)) return firstText((node.props as { children?: ReactNode }).children)
  return undefined
}

/** Detects a GFM alert marker as the blockquote's first paragraph's first text child. */
export function detectAlert(children: ReactNode): AlertMatch | undefined {
  const text = firstText(children)
  if (text === undefined) return undefined
  const match = ALERT_MARKER_RE.exec(text)
  const kind = match?.[1]
  if (!kind) return undefined
  return { kind: kind as AlertKind, marker: match[0] }
}

/** Strips `marker` off the very first text child found via the same first-child traversal
 * `detectAlert` used to find it — the marker is guaranteed to be its leading substring. */
export function stripAlertMarker(node: ReactNode, marker: string): ReactNode {
  if (typeof node === 'string') {
    return node.startsWith(marker) ? node.slice(marker.length) : node
  }
  if (Array.isArray(node)) {
    const index = node.findIndex((child) => !isSkippable(child as ReactNode))
    if (index === -1) return node
    const copy = [...node]
    copy[index] = stripAlertMarker(copy[index] as ReactNode, marker)
    return copy
  }
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode }
    return cloneElement(node, undefined, stripAlertMarker(props.children, marker))
  }
  return node
}
