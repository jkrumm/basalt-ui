/**
 * MermaidDiagram never lets a remote font request leave a render: beautiful-mermaid's Google Fonts
 * `@import` is stripped from the SVG while the `font-family` declaration is kept.
 */
import { MantineProvider } from '@mantine/core'
import { render, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { MermaidDiagram } from './mermaid'

describe('MermaidDiagram fonts', () => {
  test('a rendered flowchart has no remote font import', async () => {
    const { container } = render(
      <MantineProvider>
        <MermaidDiagram code={'flowchart LR\n  A[Start] --> B{Ok?}\n  B -->|yes| C[Done]'} />
      </MantineProvider>,
    )
    await waitFor(() => expect(container.querySelector('[role="img"] svg')).not.toBeNull())
    const html = container.querySelector('[role="img"]')?.innerHTML ?? ''
    expect(html).not.toContain('@import')
    expect(html).not.toContain('googleapis')
    expect(html).toContain('var(--basalt-font-sans)')
  })
})
