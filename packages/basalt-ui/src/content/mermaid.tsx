import { useContext, useEffect, useId, useState } from 'react'
import type { ReactElement } from 'react'
import type { RenderOptions } from 'pele/lazy'
import { CodeBlock } from './code-block'
import { FenceTrust } from './fence-trust'
import { loadPele } from './pele-peer'

/**
 * pele colors its SVG through `--pele-*` custom properties, read by the SVG's own `var()`s. They
 * are set here on the wrapper, to basalt tokens, so a scheme flip is pure CSS and never re-renders
 * the diagram. `--pele-series-*` carries the five chart-series tokens, then repeats from the first.
 * The node surface lifts off the card; the border and the alt surface are ink mixed into the card.
 */
const PELE_THEME = [
  '[--pele-bg:var(--basalt-card)]',
  '[--pele-fg:var(--basalt-ink)]',
  '[--pele-muted:var(--basalt-ink-muted)]',
  '[--pele-line:var(--basalt-line)]',
  '[--pele-surface:var(--basalt-raised)]',
  '[--pele-surface-alt:color-mix(in_srgb,var(--basalt-ink)_6%,var(--basalt-card))]',
  '[--pele-border:color-mix(in_srgb,var(--basalt-ink)_22%,var(--basalt-card))]',
  '[--pele-accent:var(--basalt-brand)]',
  '[--pele-critical:var(--basalt-bad)]',
  '[--pele-error:var(--basalt-bad)]',
  '[--pele-radius:var(--basalt-radius-chip)]',
  '[--pele-font:var(--basalt-font-sans)]',
  '[--pele-font-mono:var(--basalt-font-mono)]',
  '[--pele-series-1:var(--basalt-chart-1)]',
  '[--pele-series-2:var(--basalt-chart-2)]',
  '[--pele-series-3:var(--basalt-chart-3)]',
  '[--pele-series-4:var(--basalt-chart-4)]',
  '[--pele-series-5:var(--basalt-chart-5)]',
  '[--pele-series-6:var(--basalt-chart-1)]',
  '[--pele-series-7:var(--basalt-chart-2)]',
  '[--pele-series-8:var(--basalt-chart-3)]',
].join(' ')

// the schemes basalt's content policy admits (`core/url.ts`); a relative reference is always allowed
const SCHEMES = ['https', 'mailto', 'tel']

/**
 * Untrusted text (model output) loads no image and links only where the content policy does.
 * Trusted text may show `https:` images. A diagram author never supplies options.
 */
function policyOptions(trust: 'trusted' | 'untrusted'): RenderOptions {
  const links = { linkSchemes: SCHEMES, linkRel: 'noopener noreferrer' }
  return trust === 'trusted'
    ? { ...links, images: true, imageSchemes: ['https'] }
    : { ...links, images: false }
}

/**
 * pele measures labels with the font it is given to size the nodes, and a `var()` string cannot be
 * measured: resolve the token's real family stack from the document (empty: pele's default).
 */
function measuredFonts(): Pick<RenderOptions, 'fontFamily' | 'fontFamilyMono'> {
  if (typeof document === 'undefined') return {}
  const style = getComputedStyle(document.documentElement)
  const sans = style.getPropertyValue('--basalt-font-sans').trim()
  const mono = style.getPropertyValue('--basalt-font-mono').trim()
  return { ...(sans && { fontFamily: sans }), ...(mono && { fontFamilyMono: mono }) }
}

/**
 * A mermaid diagram rendered by pele (every diagram type of Mermaid 12.1). The module loads on first
 * use, one diagram type at a time. Until it loads, when it is missing, and when the source does not
 * render with nothing drawn before, the block shows as code; a failure after a good render keeps the
 * last good diagram (the streaming case). The SVG carries no font import or other remote reference;
 * an image or a link in it follows the trust of the surrounding `Markdown` (`FenceTrust`).
 *
 * @example
 * <MermaidDiagram code={'graph TD\n  A --> B'} />
 */
export function MermaidDiagram({ code }: { code: string }): ReactElement {
  const trust = useContext(FenceTrust)
  const idPrefix = `pele-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  // the last SVG that rendered; `null`: nothing has rendered (pending, missing peer, bad source)
  const [html, setHtml] = useState<string | null>(null)
  // the wrapper's content width: pele re-lays a diagram out for it (wraps labels, turns vertical)
  // instead of scaling it down; unknown (no ResizeObserver, or nothing laid out yet) draws at full size
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!wrapper || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry?.contentRect.width ?? 0)
      setWidth(next > 0 ? next : undefined)
    })
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [wrapper])

  useEffect(() => {
    let cancelled = false
    void loadPele().then(async (pele) => {
      if (!pele || cancelled) return undefined
      try {
        const result = await pele.renderAsync(code, {
          ...policyOptions(trust),
          ...measuredFonts(),
          ...(width !== undefined && { maxWidth: width }),
          idPrefix,
        })
        if (!cancelled) setHtml(result.svg)
      } catch {
        // keep what is on screen: the last good diagram, or the code block
      }
      return undefined
    })
    return () => {
      cancelled = true
    }
  }, [code, trust, idPrefix, width])

  if (html === null) return <CodeBlock lang="mermaid" code={code} />

  return (
    <div
      ref={setWrapper}
      data-slot="mermaid"
      // a wrapper div is the standard way to give inline SVG markup an image role
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={code.split('\n')[0]?.trim() || 'Diagram'}
      className={`overflow-x-auto rounded-inset bg-card p-3 inset-ring-1 inset-ring-border in-[.basalt-prose]:mt-(--basalt-rhythm-2) [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full ${PELE_THEME}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
