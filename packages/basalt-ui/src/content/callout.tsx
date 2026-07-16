/**
 * Callout — a soft tinted panel keyed to a semantic kind (docs/CONTENT-SPEC.md §3).
 *
 * @example
 * import { Callout } from 'basalt-ui/content'
 *
 * <Callout kind="warn" title="Heads up">
 *   <p>This endpoint is rate-limited to 60 requests/minute.</p>
 * </Callout>
 */
import type { CSSProperties, ReactNode } from 'react'
import classes from './callout.module.css'

export type CalloutKind = 'info' | 'good' | 'warn' | 'bad'

export type CalloutProps = {
  /** Semantic kind — drives the rail/tint color and the default icon. Default `'info'`. */
  readonly kind?: CalloutKind
  readonly title?: string
  /** Overrides the default per-kind icon. Only rendered alongside a `title`. */
  readonly icon?: ReactNode
  readonly children: ReactNode
  readonly className?: string
  readonly style?: CSSProperties
}

const KIND_CLASS: Record<CalloutKind, string> = {
  info: classes.info,
  good: classes.good,
  warn: classes.warn,
  bad: classes.bad,
}

function InfoGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" strokeWidth={2} />
      <path
        d="M12 9h.01M11 12h1v4h1"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GoodGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" strokeWidth={2} />
      <path d="M9 12l2 2l4 -4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WarnGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M12 4l9 16h-18z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 10v3M12 16.5v.01" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

function BadGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" strokeWidth={2} />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

const DEFAULT_ICON: Record<CalloutKind, ReactNode> = {
  info: <InfoGlyph />,
  good: <GoodGlyph />,
  warn: <WarnGlyph />,
  bad: <BadGlyph />,
}

export function Callout({ kind = 'info', title, icon, children, className, style }: CalloutProps) {
  const rootClass = [classes.root, KIND_CLASS[kind], className].filter(Boolean).join(' ')

  return (
    <div className={rootClass} {...(style !== undefined && { style })}>
      {title !== undefined && (
        <div className={classes.titleRow}>
          <span className={classes.icon}>{icon ?? DEFAULT_ICON[kind]}</span>
          <span className={classes.title}>{title}</span>
        </div>
      )}
      <div className={classes.body}>{children}</div>
    </div>
  )
}
