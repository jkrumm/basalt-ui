import { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import type { RenderOptions } from 'beautiful-mermaid'
import { CodeBlock } from './code-block'
import { sanitizeMermaidFonts } from './mermaid-sanitize'

type MermaidModule = {
  renderMermaidSVG: (text: string, options?: RenderOptions) => string
}

/**
 * The diagram's colours as `var(--vx-*)` strings: the SVG references the custom properties through
 * presentation attributes, so a scheme flip is pure CSS and never re-renders the diagram.
 */
export const MERMAID_THEME_OPTIONS: RenderOptions = {
  bg: 'var(--vx-card)',
  fg: 'var(--vx-ink)',
  line: 'var(--vx-line)',
  accent: 'var(--vx-brand)',
  // theme-allow unknown-vx-token — a v3 token (css/tokens.css); the guard's name list is 2.x
  muted: 'var(--vx-ink-muted)',
  surface: 'var(--vx-card)',
  border: 'var(--vx-hairline)',
  font: 'var(--vx-font-sans)',
  transparent: true,
}

let modulePromise: Promise<MermaidModule | null> | null = null

/** Module-level singleton: every caller shares one load attempt; a missing peer resolves null. */
function loadMermaid(): Promise<MermaidModule | null> {
  modulePromise ??= import('beautiful-mermaid').catch(() => null)
  return modulePromise
}

/**
 * A mermaid diagram rendered by beautiful-mermaid (flowchart, state, sequence, class, ER, XY).
 * The module loads on first use. Until it loads, when it is missing, and when the source does not
 * parse with nothing rendered before, the block shows as code; a parse error after a good render
 * keeps the last good diagram. The font imports beautiful-mermaid writes into the SVG are removed
 * (`sanitizeMermaidFonts`), so the page makes no request to a font host.
 *
 * @example
 * <MermaidDiagram code={'graph TD\n  A --> B'} />
 */
export function MermaidDiagram({ code }: { code: string }): ReactElement {
  const [mod, setMod] = useState<MermaidModule | null | undefined>(undefined)
  const [lastGood, setLastGood] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadMermaid().then((loaded) => {
      if (!cancelled) setMod(loaded)
      return undefined
    })
    return () => {
      cancelled = true
    }
  }, [])

  // `null`: module not resolved; `undefined`: this source failed to parse; string: fresh SVG.
  const rendered = useMemo(() => {
    if (!mod) return null
    try {
      return sanitizeMermaidFonts(mod.renderMermaidSVG(code, MERMAID_THEME_OPTIONS))
    } catch {
      return undefined
    }
  }, [mod, code])
  if (typeof rendered === 'string' && rendered !== lastGood) setLastGood(rendered)
  const html = rendered === undefined ? lastGood : rendered

  if (html === null) return <CodeBlock lang="mermaid" code={code} />

  return (
    <div
      data-slot="mermaid"
      // a wrapper div is the standard way to give inline SVG markup an image role
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={code.split('\n')[0]?.trim() || 'Diagram'}
      className="overflow-x-auto rounded-inset bg-card p-3 ring-1 ring-border ring-inset in-[.vx-prose]:mt-(--vx-rhythm-2) [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
