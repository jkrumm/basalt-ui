/**
 * MermaidDiagram never lets a remote font request leave a render: beautiful-mermaid's Google Fonts
 * `@import` is stripped from the SVG and the `font-family` var() is unquoted so it resolves.
 *
 * The assertions read the exact markup string handed to `innerHTML` — the test DOM does not keep
 * the text of an inline SVG `<style>`, so the serialized DOM cannot be asserted on.
 */
import { MantineProvider } from '@mantine/core'
import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { MermaidDiagram } from './mermaid'

const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')
const assigned: string[] = []
afterEach(() => {
  if (descriptor) Object.defineProperty(Element.prototype, 'innerHTML', descriptor)
  assigned.length = 0
})

describe('MermaidDiagram fonts', () => {
  test('a rendered flowchart has no remote font import and an unquoted font-family var()', async () => {
    if (!descriptor?.set) throw new Error('Element.prototype.innerHTML has no setter')
    const { set } = descriptor
    Object.defineProperty(Element.prototype, 'innerHTML', {
      ...descriptor,
      set(this: Element, value: string) {
        assigned.push(value)
        set.call(this, value)
      },
    })
    render(
      <MantineProvider>
        <MermaidDiagram code={'flowchart LR\n  A[Start] --> B{Ok?}\n  B -->|yes| C[Done]'} />
      </MantineProvider>,
    )
    await waitFor(() => expect(assigned.some((html) => html.includes('<svg'))).toBe(true))
    const svg = assigned.find((html) => html.includes('<svg')) ?? ''
    expect(svg).not.toContain('@import')
    expect(svg).not.toContain('googleapis')
    expect(svg).toContain('font-family: var(--basalt-font-sans)')
    expect(svg).not.toMatch(/font-family\s*:\s*['"]var\(/)
  })
})
