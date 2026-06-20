/**
 * BasaltStickToBottom — thin lazy wrapper over use-stick-to-bottom providing chat auto-scroll.
 *
 * LAZY-LOADED: use-stick-to-bottom is an OPTIONAL peer. This module uses React.lazy + dynamic
 * import() so importing 'basalt-ui/agent' does NOT eagerly resolve use-stick-to-bottom. The
 * package is loaded only when BasaltStickToBottom is first rendered.
 *
 * Renders:
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
import { type CSSProperties, lazy, Suspense, type JSX, type ReactNode } from 'react'

// ── Lazy-loaded StickToBottom ─────────────────────────────────────────────────

type WrapperProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

// The lazy wrapper resolves use-stick-to-bottom only when rendered.
const LazyStickToBottom = lazy(async () => {
  const { StickToBottom, useStickToBottomContext } = await import('use-stick-to-bottom')

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
