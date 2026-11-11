/**
 * Wiring: `MermaidDiagram` routes the real renderer's SVG through `sanitizeMermaidFonts` (the
 * patterns are covered in `mermaid-sanitize.test.ts`), shows the source while nothing has rendered
 * and when the renderer is broken, and keeps the last good diagram on a parse error.
 */
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'

// `mock.module` is process-global and bun shares one process across test files, so the mock is
// put back in `afterAll`. The real function is captured BEFORE the mock lands.
const { sanitizeMermaidFonts: actual } = await import('./mermaid-sanitize')
const seen: string[] = []
mock.module('./mermaid-sanitize', () => ({
  sanitizeMermaidFonts: (svg: string): string => {
    seen.push(svg)
    return actual(svg)
  },
}))
const { MermaidDiagram } = await import('./mermaid')

afterEach(() => {
  cleanup()
  seen.length = 0
})
afterAll(() => {
  mock.module('./mermaid-sanitize', () => ({ sanitizeMermaidFonts: actual }))
})

describe('MermaidDiagram', () => {
  test('sanitizes the renderer output before it reaches the DOM', async () => {
    const { container } = render(<MermaidDiagram code={'flowchart LR\n  A[Start] --> B[Done]'} />)
    await waitFor(() => expect(seen.length).toBeGreaterThan(0))
    expect(seen[0]).toContain('@import')
    await waitFor(() => expect(container.querySelector('svg style')).not.toBeNull())
    expect(container.innerHTML).not.toContain('googleapis')
  })

  test('the diagram is an image named by its first line', async () => {
    const { container } = render(<MermaidDiagram code={'graph TD\n  A --> B'} />)
    await waitFor(() => expect(container.querySelector('[role="img"] svg')).not.toBeNull())
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('graph TD')
  })

  test('a source that does not parse stays a code block with the text', async () => {
    const { container } = render(<MermaidDiagram code="this is {{ not a diagram" />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container.querySelector('[data-slot="mermaid"]')).toBeNull()
    expect(container.querySelector('pre')?.textContent).toContain('this is {{ not a diagram')
  })

  test('a later parse error keeps the last good diagram', async () => {
    const { container, rerender } = render(<MermaidDiagram code={'graph TD\n  A --> B'} />)
    await waitFor(() => expect(container.querySelector('[role="img"] svg')).not.toBeNull())
    rerender(<MermaidDiagram code="graph TD\n  A -->" />)
    rerender(<MermaidDiagram code="not {{ valid" />)
    expect(container.querySelector('[role="img"] svg')).not.toBeNull()
  })

  test('the theme options are var(--vx-*) strings only', async () => {
    const { MERMAID_THEME_OPTIONS } = await import('./mermaid')
    for (const [key, value] of Object.entries(MERMAID_THEME_OPTIONS)) {
      if (typeof value === 'string') expect(`${key}: ${value}`).toMatch(/var\(--vx-/)
    }
  })
})
