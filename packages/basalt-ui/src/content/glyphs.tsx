/**
 * The content surface's inline glyph set. Shared so every copy affordance reads as ONE idiom —
 * `CodeBlock`'s copy button and a heading's copy-link anchor resolve the same check, not two
 * hand-drawn ones that drift apart.
 *
 * Inline SVG rather than an icon dep: the framework takes icons as `ReactNode` from the consumer
 * (see the package CLAUDE.md) and ships none, but these are internal chrome of a shipped component,
 * not a consumer-facing slot. `currentColor` + `1em`-agnostic sizing keeps them steerable from CSS
 * — the heading anchor sizes its glyph as an optical ratio of whatever step the heading lands on
 * (docs/DESIGN-SPEC.md §3), while the code-block chrome pins a fixed 14px.
 *
 * Not part of the public surface.
 */

export function CopyGlyph() {
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

export function CheckGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M5 12l5 5l10 -10" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Chain/link glyph — the "copy a link to this section" affordance on a heading. */
export function LinkGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        d="M10 14a3.5 3.5 0 0 0 5 0l4 -4a3.5 3.5 0 0 0 -5 -5l-.5 .5"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 10a3.5 3.5 0 0 0 -5 0l-4 4a3.5 3.5 0 0 0 5 5l.5 -.5"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
