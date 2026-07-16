/**
 * MermaidDiagram — beautiful-mermaid (OPTIONAL PEER), `--vx-*` themed, streaming-safe
 * (docs/CONTENT-SPEC.md §2 decision 4).
 *
 * Lazy dynamic `import('beautiful-mermaid')` behind a module-level singleton promise, mirroring
 * the `./highlighter` optional-peer pattern: no unhandled rejection, no crash. Without the peer
 * installed — or on a mermaid parse error with no previously-rendered diagram — it degrades to a
 * plain `CodeBlock language="mermaid"` (or the `fallback` prop, if supplied).
 *
 * Theming passes `var(--vx-*)` strings straight through as the render options: the emitted SVG
 * references those custom properties via presentation attributes, so a Mantine scheme flip is
 * pure CSS — the SVG never needs to be re-rendered on a color-scheme change.
 *
 * Supported diagram types: flowchart, state, sequence, class, ER, XY chart. Full-grammar `mermaid`
 * stays a consumer escape hatch (`agent/rules/basalt-content.md`).
 *
 * @example
 * import { MermaidDiagram } from 'basalt-ui/content'
 *
 * <MermaidDiagram code={'graph TD\n  A --> B'} />
 */
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CodeBlock } from './code-block'
import classes from './mermaid.module.css'

// Import the type only — erased at runtime (verbatimModuleSyntax safe). `beautiful-mermaid` is a
// devDependency purely so this type resolves; the runtime import below is fully dynamic.
import type { RenderOptions } from 'beautiful-mermaid'

type MermaidModule = {
  renderMermaidSVG: (text: string, options?: RenderOptions) => string
}

/**
 * Static theme mapping onto the `--vx-*` token layer — every value is a `var(--vx-*)` string, so
 * this object never changes across renders/schemes and can live at module scope.
 */
const MERMAID_THEME_OPTIONS: RenderOptions = {
  bg: 'var(--vx-surface-panel)',
  fg: 'var(--vx-ink)',
  line: 'var(--vx-line)',
  accent: 'var(--vx-accent)',
  muted: 'var(--vx-muted)',
  surface: 'var(--vx-surface-panel)',
  border: 'var(--vx-surface-border)',
  font: 'var(--basalt-font-sans)',
  transparent: true,
}

let modulePromise: Promise<MermaidModule | null> | null = null

/** Module-level singleton — resolves once; every caller shares the same load attempt. */
function loadMermaidModule(): Promise<MermaidModule | null> {
  modulePromise ??= import('beautiful-mermaid').catch(() => null)
  return modulePromise
}

export type MermaidDiagramProps = {
  /** Raw mermaid source (the fence body, without the surrounding ``` marks). */
  readonly code: string
  readonly className?: string
  readonly style?: CSSProperties
  /** Rendered instead of the default `CodeBlock language="mermaid"` degrade. */
  readonly fallback?: ReactNode
}

export function MermaidDiagram({ code, className, style, fallback }: MermaidDiagramProps) {
  const [mod, setMod] = useState<MermaidModule | null | undefined>(undefined)
  const lastGoodRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadMermaidModule().then((loaded) => {
      if (!cancelled) setMod(loaded)
      return undefined
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Pure and synchronous once `mod` is resolved — parse errors keep the last successfully
  // rendered SVG (docs/CONTENT-SPEC.md §2 decision 4) instead of blanking a settled diagram.
  const html = useMemo(() => {
    if (!mod) return null
    try {
      const svg = mod.renderMermaidSVG(code, MERMAID_THEME_OPTIONS)
      lastGoodRef.current = svg
      return svg
    } catch {
      return lastGoodRef.current
    }
  }, [mod, code])

  if (html === null) {
    return (
      fallback ?? (
        <CodeBlock
          language="mermaid"
          code={code}
          {...(className !== undefined && { className })}
          {...(style !== undefined && { style })}
        />
      )
    )
  }

  const firstLine = code.split('\n')[0]?.trim() || 'Diagram'
  const containerClass = [classes.container, className].filter(Boolean).join(' ')

  return (
    <div
      className={containerClass}
      // a real <img> can't host inline SVG markup — `role="img"` on the wrapping div is the
      // standard WAI-ARIA pattern for this.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={firstLine}
      {...(style !== undefined && { style })}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
