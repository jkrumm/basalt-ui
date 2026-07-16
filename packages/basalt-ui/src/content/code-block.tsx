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
import { ActionIcon, CopyButton, Tooltip } from '@mantine/core'
import classes from './code-block.module.css'
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

function CopyGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"
        strokeWidth={2}
      />
      <path d="M16 8V6a2 2 0 0 0 -2 -2H6a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" strokeWidth={2} />
    </svg>
  )
}

function CheckGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M5 12l5 5l10 -10" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CopyAction({ code }: { code: string }) {
  return (
    <CopyButton value={code} timeout={1500}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="left">
          <ActionIcon
            variant="subtle"
            size="sm"
            color={copied ? 'teal' : 'gray'}
            onClick={copy}
            aria-label="Copy code"
          >
            {copied ? <CheckGlyph /> : <CopyGlyph />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  )
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
            {showCopy && <CopyAction code={code} />}
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
          <CopyAction code={code} />
        </div>
      )}
    </div>
  )
}
