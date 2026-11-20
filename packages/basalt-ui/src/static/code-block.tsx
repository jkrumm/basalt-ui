import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { Glyph } from './glyphs'
import type { Slot } from './types'

export type SiteCodeBlockProps = {
  /** The block itself: a `<pre>` your toolchain rendered (Astro's Shiki, an MDX `pre`), or plain text. */
  children: Slot
  /** The copy button's accessible name ("Copy code"). */
  copyLabel: string
  /** Announced once the copy succeeded ("Copied"). */
  copiedLabel: string
  /** A caption above the block: a file name, a language. */
  caption?: Slot
  className?: string
}

/**
 * A code block with a copy button. Highlighting stays with the host's toolchain: pass the `<pre>`
 * it rendered as `children`, and the prose sheet styles it by element. The button is plain
 * markup; `siteScript()` copies the block's text, flips the glyph for a moment and announces
 * `copiedLabel`. Without the script the block stays selectable.
 *
 * @useWhen an article shows source a reader will paste
 * @neverWhen the code streams in from a model (use `CodeBlock` from `basalt-ui/content`)
 *
 * @example
 * <SiteCodeBlock copyLabel="Copy code" copiedLabel="Copied"><pre><code>bun add basalt-ui</code></pre></SiteCodeBlock>
 */
export function SiteCodeBlock({
  children,
  copyLabel,
  copiedLabel,
  caption,
  className,
}: SiteCodeBlockProps): ReactElement {
  return (
    <figure
      data-slot="code-block"
      data-basalt-code=""
      className={cn(
        'group/code relative m-0 in-[.basalt-prose]:mt-(--basalt-rhythm-2)',
        '[&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-inset [&_pre]:bg-inset [&_pre]:py-3 [&_pre]:ps-4 [&_pre]:pe-12 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:ring-1 [&_pre]:ring-border',
        className,
      )}
    >
      {caption !== undefined && (
        <figcaption className="mb-1.5 font-mono text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
      {children}
      <button
        type="button"
        data-basalt-copy=""
        aria-label={copyLabel}
        data-copied-label={copiedLabel}
        className="focus-ring absolute end-2 bottom-2 inline-flex size-8 items-center justify-center rounded-ctrl bg-card text-muted-foreground shadow-raised transition-opacity hover:text-foreground pointer-fine:opacity-0 pointer-fine:group-focus-within/code:opacity-100 pointer-fine:group-hover/code:opacity-100 data-copied:opacity-100 [&[data-copied]>[data-glyph=copy]]:hidden [&:not([data-copied])>[data-glyph=check]]:hidden"
      >
        <span data-glyph="copy" className="contents">
          <Glyph name="copy" />
        </span>
        <span data-glyph="check" className="contents text-good">
          <Glyph name="check" />
        </span>
      </button>
      <output className="sr-only" data-basalt-copy-status="" />
    </figure>
  )
}
