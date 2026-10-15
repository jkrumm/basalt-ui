/**
 * Wiring only: `MermaidDiagram` routes the real renderer's SVG through `sanitizeMermaidFonts`
 * (the patterns themselves are covered in `mermaid-sanitize.test.ts`).
 */
import { MantineProvider } from '@mantine/core'
import { render, waitFor } from '@testing-library/react'
import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'

// Captured BEFORE the mock lands (the factory below must not re-enter the mocked module); the
// mock is process-global, so `afterAll` puts the real function back for later test files.
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
  seen.length = 0
})
afterAll(() => {
  mock.module('./mermaid-sanitize', () => ({ sanitizeMermaidFonts: actual }))
})

describe('MermaidDiagram fonts', () => {
  test('sanitizes the renderer output before it reaches the DOM', async () => {
    const { container } = render(
      <MantineProvider>
        <MermaidDiagram code={'flowchart LR\n  A[Start] --> B[Done]'} />
      </MantineProvider>,
    )
    await waitFor(() => expect(seen.length).toBeGreaterThan(0))
    expect(seen[0]).toContain('@import')
    await waitFor(() => expect(container.querySelector('svg style')).not.toBeNull())
    expect(container.innerHTML).not.toContain('googleapis')
  })
})
