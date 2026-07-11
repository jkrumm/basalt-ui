/**
 * BasaltStickToBottom — thin lazy wrapper over use-stick-to-bottom providing chat auto-scroll.
 *
 * LAZY-LOADED: use-stick-to-bottom is an OPTIONAL peer. This module uses React.lazy + dynamic
 * import() so importing 'basalt-ui/agent' does NOT eagerly resolve use-stick-to-bottom. The
 * package is loaded only when BasaltStickToBottom is first rendered.
 *
 * If use-stick-to-bottom is not installed, BasaltStickToBottom renders a plain scrollable <div>
 * (graceful degradation) — no unhandled rejection, no crash.
 *
 * Renders (when peer is present):
 *   <StickToBottom>
 *     <StickToBottom.Content>{children}</StickToBottom.Content>
 *     [scroll-to-bottom button when not at bottom]
 *   </StickToBottom>
 *
 * Install optional peer:
 *   bun add use-stick-to-bottom
 *
 * @example
 * import { BasaltStickToBottom } from 'basalt-ui/agent'
 *
 * <BasaltStickToBottom className="chat-messages">
 *   <PartList parts={parts} />
 * </BasaltStickToBottom>
 */
import { lazy, Suspense } from 'react'
import type { CSSProperties, JSX, ReactNode } from 'react'
import { VX } from '../tokens'

// ── Lazy-loaded StickToBottom ─────────────────────────────────────────────────

type WrapperProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/** Plain scrollable container rendered when use-stick-to-bottom peer is absent. */
function PlainContainerFallback({ children, className, style }: WrapperProps): JSX.Element {
  const props: { className?: string; style?: CSSProperties } = {
    style: { overflowY: 'auto', ...style },
  }
  if (className !== undefined) props.className = className
  return <div {...props}>{children}</div>
}

// The lazy wrapper resolves use-stick-to-bottom only when rendered.
// If the peer is absent the import fails — .catch resolves to PlainContainerFallback so
// the optional-peer contract is honoured: no unhandled rejection, no crash.
const LazyStickToBottom = lazy(() =>
  import('use-stick-to-bottom')
    .then(({ StickToBottom, useStickToBottomContext }) => {
      function StickToBottomInner({
        children,
        className,
      }: {
        children: ReactNode
        className?: string
      }): JSX.Element {
        const { isAtBottom, scrollToBottom } = useStickToBottomContext()
        const contentProps = className !== undefined ? { className } : {}
        return (
          <>
            <StickToBottom.Content {...contentProps}>{children}</StickToBottom.Content>
            {!isAtBottom && (
              <button
                type="button"
                className="basalt-agent-scroll-to-bottom"
                onClick={() => scrollToBottom()}
                aria-label="Scroll to bottom"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  margin: '8px auto 0',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'var(--vx-surface-panel)',
                  boxShadow: 'var(--vx-shadow-card)',
                  color: 'var(--vx-faint)',
                  fontFamily: 'var(--basalt-font-mono)',
                  fontSize: VX.text.md,
                }}
              >
                ↓
              </button>
            )}
          </>
        )
      }

      // oxlint-disable-next-line unicorn/consistent-function-scoping
      function StickToBottomWrapper({ children, className, style }: WrapperProps): JSX.Element {
        const outerProps = style !== undefined ? { style } : {}
        const innerProps = className !== undefined ? { className } : {}
        return (
          <StickToBottom {...outerProps}>
            <StickToBottomInner {...innerProps}>{children}</StickToBottomInner>
          </StickToBottom>
        )
      }

      return { default: StickToBottomWrapper }
    })
    .catch(() => ({ default: PlainContainerFallback })),
)

// ── BasaltStickToBottom ───────────────────────────────────────────────────────

export type BasaltStickToBottomProps = {
  readonly children: ReactNode
  /** Applied to the scroll content container. */
  readonly className?: string
  /** Applied to the outer StickToBottom element. */
  readonly style?: CSSProperties
}

/**
 * Auto-scrolling chat container — sticks to the bottom as content grows, surfaces a
 * scroll-to-bottom affordance when the user scrolls up. Lazy-loaded over use-stick-to-bottom.
 *
 * Falls back to a plain scrollable div while the package loads (first render only).
 *
 * @example
 * import { BasaltStickToBottom, PartList } from 'basalt-ui/agent'
 *
 * <BasaltStickToBottom style={{ height: '400px', overflow: 'auto' }}>
 *   <PartList parts={parts} />
 * </BasaltStickToBottom>
 */
export function BasaltStickToBottom({
  children,
  className,
  style,
}: BasaltStickToBottomProps): JSX.Element {
  const fallbackProps: { className?: string; style?: CSSProperties } = {}
  if (className !== undefined) fallbackProps.className = className
  if (style !== undefined) fallbackProps.style = style

  const lazyProps: WrapperProps = { children }
  if (className !== undefined) lazyProps.className = className
  if (style !== undefined) lazyProps.style = style

  return (
    <Suspense fallback={<div {...fallbackProps}>{children}</div>}>
      <LazyStickToBottom {...lazyProps} />
    </Suspense>
  )
}
