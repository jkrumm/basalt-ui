import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { ai } from '../core/messages/ai'
import { useMessages } from '../core/messages/use-messages'
import { Button } from '../ui/button'
import type { CodeBlockProps } from './contract'
import { highlightCode } from './highlighter'

export type { CodeBlockProps } from './contract'

const COPIED_MS = 1500

/** The scroll box both states share: its own horizontal scroll, room on the right for the button. */
const BODY =
  'm-0 block overflow-x-auto bg-transparent py-3 ps-3 pe-10 font-mono text-sm leading-relaxed text-foreground focus-ring'

/** Shiki emits `--shiki-light` and `--shiki-dark` per token; the scheme picks one (`[data-theme]`). */
const HIGHLIGHTED =
  '[&_.shiki_span]:text-(--shiki-light) dark:[&_.shiki_span]:text-(--shiki-dark) [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:bg-transparent! [&_pre]:py-3 [&_pre]:ps-3 [&_pre]:pe-10 [&_pre]:text-sm [&_pre]:leading-relaxed [&_pre]:shadow-none [&_pre]:ring-0'

function CopyGlyph({ copied }: { copied: boolean }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {copied ? (
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
      ) : (
        <>
          <rect x="5.5" y="5.5" width="7" height="8" rx="1.5" />
          <path d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4.5A1.5 1.5 0 0 0 3 4.5v6A1.5 1.5 0 0 0 4.5 12h1" />
        </>
      )}
    </svg>
  )
}

function CopyButton({ code }: { code: string }): ReactElement {
  const t = useMessages(ai)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = (): void => {
    // A denied or missing clipboard changes nothing on screen; the block stays selectable.
    navigator.clipboard?.writeText(code).then(
      () => setCopied(true),
      () => undefined,
    )
  }

  return (
    <div className="absolute top-1.5 right-1.5 transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within/code:opacity-100 pointer-fine:group-hover/code:opacity-100">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('ai.copy')}
        data-copied={copied ? '' : undefined}
        onClick={copy}
      >
        <CopyGlyph copied={copied} />
      </Button>
      <output className="sr-only">{copied ? t('ai.copied') : ''}</output>
    </div>
  )
}

/**
 * A fenced code block: the source always on screen in a box that scrolls on its own, highlighted
 * with shiki once the block is settled and the language is known, plain otherwise (an unknown
 * language, a streaming tail, a shiki that fails to load). The copy button is hidden while the
 * block is still streaming. The dark palette follows `[data-theme='dark']`.
 *
 * @useWhen a fenced or standalone block of source or terminal output is shown, highlighted, with a copy button
 * @neverWhen the text is inline (use <code> in prose) or is a diagram (use a mermaid fence)
 *
 * @example
 * <CodeBlock lang="ts" code={source} />
 * <CodeBlock lang="bash" code={partial} settled={false} />
 */
export function CodeBlock({ lang, code, settled = true }: CodeBlockProps): ReactElement {
  const [highlighted, setHighlighted] = useState<{
    code: string
    lang: string
    html: string
  } | null>(null)

  useEffect(() => {
    if (lang === undefined || !settled) return
    let cancelled = false
    void highlightCode(code, lang).then((html) => {
      if (!cancelled && html !== null) setHighlighted({ code, lang, html })
      return undefined
    })
    return () => {
      cancelled = true
    }
  }, [code, lang, settled])

  // Only markup for exactly this source is shown; anything older would lag the text behind it.
  const html =
    highlighted !== null && highlighted.code === code && highlighted.lang === lang
      ? highlighted.html
      : null

  return (
    <div
      data-slot="code-block"
      data-lang={lang}
      className="group/code relative rounded-inset bg-inset ring-1 ring-border ring-inset in-[.vx-prose]:mt-(--vx-rhythm-2)"
    >
      {html === null ? (
        // a scroll box must be reachable by keyboard (shiki's own pre carries tabindex 0 too)
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        <pre tabIndex={0} className={BODY}>
          <code>{code}</code>
        </pre>
      ) : (
        <div className={HIGHLIGHTED} dangerouslySetInnerHTML={{ __html: html }} />
      )}
      {settled && <CopyButton code={code} />}
    </div>
  )
}
