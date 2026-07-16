/**
 * FenceBlock — renders a fenced code block's hast `pre` node as `CodeBlock` or `MermaidDiagram`
 * (docs/CONTENT-SPEC.md §2 decision 4 / §6). Shared by every `pre` override `./markdown` builds
 * (one per streamed block, each with its own `settled` flag).
 *
 * `mermaid` fences render as a plain `CodeBlock` while `settled` is `false` (the in-flight
 * streaming tail) and upgrade to `MermaidDiagram` once the fence's block settles — no flicker, no
 * wasted parse pass on a still-changing diagram. Every other fenced language hides its copy
 * action while unsettled for the same reason (copying a still-streaming block is misleading).
 *
 * Not part of the public surface.
 */
import type { Element } from 'hast'
import { CodeBlock } from './code-block'
import { extractFenceInfo } from './markdown-hast'
import { MermaidDiagram } from './mermaid'

export type FenceBlockProps = {
  readonly node?: Element
  readonly settled: boolean
}

export function FenceBlock({ node, settled }: FenceBlockProps) {
  const fence = node ? extractFenceInfo(node) : undefined
  if (!fence) return null

  if (fence.language === 'mermaid' && settled) {
    return <MermaidDiagram code={fence.code} />
  }

  return (
    <CodeBlock
      code={fence.code}
      showCopy={settled}
      {...(fence.language !== undefined && { language: fence.language })}
      {...(fence.title !== undefined && { title: fence.title })}
    />
  )
}
