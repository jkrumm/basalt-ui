import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { VX } from '../../tokens'

const infoWrapStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  marginLeft: 5,
}
const infoTriggerStyle: CSSProperties = {
  appearance: 'none',
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  cursor: 'help',
  display: 'inline-flex',
  alignItems: 'center',
}
// The tooltip bubble reads like every floating surface — panel bg + shadow-card + card radius
// (docs/DESIGN-SPEC.md section 5). It opens DOWNWARD (top: 100%) by convention, into/over the
// chart body. The header is intentionally outside the body's clip box (see `cardStyle` /
// `bodyClipStyle` below), so the bubble can overhang the card edge without ever being clipped.
// Mantine-free by design (the charts boundary), so this is a plain hover/focus-state bubble, not
// a Mantine Tooltip.
const bubbleStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 7px)',
  left: 0,
  zIndex: 10,
  maxWidth: 260,
  width: 'max-content',
  padding: '7px 10px',
  borderRadius: VX.radiusCard,
  backgroundColor: VX.surface.panel,
  boxShadow: VX.shadowCard,
  color: VX.muted,
  fontSize: VX.text.sm,
  fontWeight: 400,
  lineHeight: 1.4,
  whiteSpace: 'normal',
  pointerEvents: 'none',
}

function InfoIcon({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  const tipId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  return (
    <span style={infoWrapStyle}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="More information"
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
        style={{ ...infoTriggerStyle, color: open ? VX.muted : VX.faint }}
      >
        <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0 5a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z" />
        </svg>
      </button>
      {open && (
        <span id={tipId} role="tooltip" style={bubbleStyle}>
          {title}
        </span>
      )}
    </span>
  )
}

// Surfaces resolve per theme via CSS vars, so the styles are static (no useMemo/isDark).
// Depth = `shadow-card` (a whisper shadow + a 1px ring baked into the same value), never a
// `border` property (docs/DESIGN-SPEC.md §5) — so a ChartCard reads IDENTICALLY to a Mantine
// Card/Paper (same shadow token, same radius token, no intrinsic margin; outer spacing comes
// from the parent Stack/SimpleGrid gap). Shadow + panel background + card radius all live on
// this OUTER box, which is never clipped — only the chart body below clips its own bottom
// corners (`bodyClipStyle`). The header is a direct, unclipped child of this box on purpose: its
// info-tooltip bubble must be able to overflow the card bounds without being invisibly cut off.
const cardStyle = {
  borderRadius: VX.radiusCard,
  boxShadow: VX.shadowCard,
  backgroundColor: VX.surface.panel,
}
const bodyClipStyle = {
  // Clip the chart body to the card's bottom corners — a chart with its own square edges would
  // otherwise poke past the card's border-radius. Only the bottom corners: the body's top edge is
  // interior, sitting under the (unclipped) header. Trade-off: a chart tooltip that overflows the
  // card bounds is clipped too; the kinds keep tooltips inside the plot area, so this is fine in
  // practice — a consumer rendering an oversized/edge tooltip should portal it out of the card.
  borderBottomLeftRadius: VX.radiusCard,
  borderBottomRightRadius: VX.radiusCard,
  overflow: 'hidden' as const,
  padding: '2px var(--mantine-spacing-sm, 0.75rem) var(--mantine-spacing-xs, 0.625rem)',
}
const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  // Card inset = spacing xs (vertical) / sm (horizontal). The `--mantine-spacing-*` vars carry
  // basalt's OWNED scale (theme.spacing.xs 0.625rem / sm 0.75rem); the rem fallbacks keep a
  // Mantine-free `./charts`-only consumer (no MantineProvider vars) padded identically. No
  // header/body divider — the title block and the plot read as one continuous surface; a rule here
  // only doubled the card's shadow-embedded ring and made the header feel heavier.
  padding: 'var(--mantine-spacing-xs, 0.625rem) var(--mantine-spacing-sm, 0.75rem) 4px',
}
const titleColumnStyle = {
  display: 'inline-flex',
  flexDirection: 'column' as const,
  lineHeight: 1.15,
}
const titleStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  fontFamily: 'var(--basalt-font-head)',
  fontStretch: '88%',
  fontWeight: 550,
  fontSize: VX.text.md,
  color: VX.ink,
}
const subtitleStyle = {
  fontSize: VX.text.sm,
  fontWeight: 400,
  color: VX.muted,
  marginTop: 1,
}

/**
 * Standard wrapper for every visx chart — card with info-tooltip title + optional
 * subtitle (the question the chart answers) + optional extra slot (current value
 * badge etc.). Do not wrap visx charts in bare divs.
 */
export function ChartCard({
  title,
  subtitle,
  tooltip,
  extra,
  children,
}: {
  title: string
  subtitle?: string
  tooltip: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={titleColumnStyle}>
          <span style={titleStyle}>
            {title}
            <InfoIcon title={tooltip} />
          </span>
          {subtitle !== undefined && <span style={subtitleStyle}>{subtitle}</span>}
        </span>
        {extra !== undefined && <span>{extra}</span>}
      </div>
      <div style={bodyClipStyle}>{children}</div>
    </div>
  )
}
