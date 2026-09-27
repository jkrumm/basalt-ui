/**
 * CodeBlock — a chrome'd fenced code block with shiki syntax highlighting (optional peer, lazy
 * singleton), a copy button, and an optional filename/title tab (docs/CONTENT-SPEC.md §3).
 *
 * Degrades to a plain mono `<pre>` when `shiki` is not installed, when `language` is omitted, or
 * when the language isn't in the curated map — never a crash, never an unhandled rejection (see
 * `./highlighter`).
 *
 * @example
 * import { CodeBlock } from 'basalt-ui/content'
 *
 * <CodeBlock title="vite.config.ts" language="ts" code={source} />
 * <CodeBlock language="bash" code="bun add basalt-ui" showCopy />
 */
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import classes from './code-block.module.css'
import { CopyAction } from './copy-action'
import { highlightCode } from './highlighter'

export type CodeBlockProps = {
  readonly code: string
  readonly language?: string
  readonly title?: string
  /** Show the copy-to-clipboard action. Default `true`. */
  readonly showCopy?: boolean
  readonly className?: string
  readonly style?: CSSProperties
}

export function CodeBlock({
  code,
  language,
  title,
  showCopy = true,
  className,
  style,
}: CodeBlockProps) {
  // Intentionally NOT reset on every code/language change — keeping the last-good html while a
  // re-highlight is in flight avoids a flash back to plain mono on every keystroke of streamed code.
  const [html, setHtml] = useState<string | null>(null)
  const bodyRef = useRef<HTMLElement | null>(null)
  const setBodyRef = (node: HTMLElement | null): void => {
    bodyRef.current = node
  }

  useEffect(() => {
    if (language === undefined) return
    let cancelled = false
    highlightCode(code, language).then((result) => {
      if (!cancelled) setHtml(result)
      return undefined
    })
    return () => {
      cancelled = true
    }
  }, [code, language])

  // Trailing-edge overflow fade (docs/MATURATION-LEDGER.md): visible only while `.body` is
  // actually wider than its box AND not yet scrolled to the end — never a permanent decoration on a
  // block that already fits, never a fade implying more content once the reader reaches it. LTR
  // only (no `dir` handling exists anywhere else in this file); a future RTL pass would fade the
  // LEADING edge instead. `[data-code-overflow]` (not React state driving the mask itself) is the
  // toggle the CSS module reads, so the fade never re-renders the block — only this one attribute.
  const [showOverflowFade, setShowOverflowFade] = useState(false)

  // Layout effect, not a plain effect: measuring after paint would let a code block that's
  // already too wide on mount flash one frame with no fade before this fires. Isomorphic so an SSR
  // render never trips React's "useLayoutEffect does nothing on the server" warning.
  useIsomorphicLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const update = (): void => {
      const atEnd = body.scrollLeft + body.clientWidth >= body.scrollWidth - 1
      setShowOverflowFade(body.scrollWidth > body.clientWidth && !atEnd)
    }
    update()

    body.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(body)
    return () => {
      body.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [html, code])

  const containerClass = [classes.container, className].filter(Boolean).join(' ')

  return (
    <div className={containerClass} {...(style !== undefined && { style })}>
      {title !== undefined && (
        <div className={classes.header}>
          <span className={classes.title}>{title}</span>
          <div className={classes.headerRight}>
            {language !== undefined && <span className={classes.langBadge}>{language}</span>}
            {showCopy && <CopyAction value={code} ariaLabel="Copy code" />}
          </div>
        </div>
      )}
      {html !== null ? (
        <div
          ref={setBodyRef}
          className={classes.body}
          {...(showOverflowFade && { 'data-code-overflow': true })}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre
          ref={setBodyRef}
          className={classes.body}
          {...(showOverflowFade && { 'data-code-overflow': true })}
        >
          <code>{code}</code>
        </pre>
      )}
      {title === undefined && showCopy && (
        <div className={classes.floatingCopy}>
          <CopyAction value={code} ariaLabel="Copy code" />
        </div>
      )}
    </div>
  )
}
