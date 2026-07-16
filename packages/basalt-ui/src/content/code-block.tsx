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
import { useEffect, useState } from 'react'
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
        <div className={classes.body} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className={classes.body}>
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
