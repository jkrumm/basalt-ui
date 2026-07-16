/**
 * CopyAction — the content surface's ONE copy-to-clipboard affordance: a subtle icon button whose
 * tooltip reads "Copy" → "Copied" and whose glyph swaps to a teal check for a beat. `CodeBlock`
 * (copy the snippet) and `HeadingAnchor` (copy a link to the section) both render THIS component,
 * so the two never drift into two different copy languages.
 *
 * The check + tooltip are the entire success signal — no notification (docs/CONTENT-SPEC.md §7).
 * `color="teal"` resolves through the bridged Mantine family, so it stays on the token layer in
 * both schemes (see the package CLAUDE.md on `cssVariablesResolver`).
 *
 * Not part of the public surface — reach it through `CodeBlock` / `HeadingAnchor`.
 */
import type { FloatingPosition } from '@mantine/core'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Tooltip } from '@mantine/core'
import { CheckGlyph, CopyGlyph } from './glyphs'

const COPIED_RESET_MS = 1500

export type CopyActionProps = {
  /**
   * The text to copy. Pass a resolver to defer it to click time — a value derived from live
   * browser state (the current URL) would otherwise be captured at render, and read stale.
   */
  readonly value: string | (() => string)
  readonly label?: string
  readonly copiedLabel?: string
  readonly ariaLabel: string
  readonly tooltipPosition?: FloatingPosition
  /** Resting glyph. Defaults to the copy glyph; a heading anchor shows a link instead. */
  readonly glyph?: ReactNode
}

export function CopyAction({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  ariaLabel,
  tooltipPosition = 'left',
  glyph,
}: CopyActionProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [])

  const handleCopy = async () => {
    // Clipboard is unavailable on insecure origins — say nothing rather than flash a check we
    // didn't earn.
    if (!navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(typeof value === 'function' ? value() : value)
    } catch {
      return
    }
    setCopied(true)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS)
  }

  return (
    <Tooltip label={copied ? copiedLabel : label} withArrow position={tooltipPosition}>
      <ActionIcon
        variant="subtle"
        size="sm"
        color={copied ? 'teal' : 'gray'}
        onClick={handleCopy}
        aria-label={ariaLabel}
      >
        {copied ? <CheckGlyph /> : (glyph ?? <CopyGlyph />)}
      </ActionIcon>
    </Tooltip>
  )
}
