/**
 * The peer is not installed. The loader gives `null` and one dev-only warning that names the swap;
 * with it `MermaidDiagram` keeps every fence as its code. `./pele-peer` is mocked for a fresh
 * `./mermaid` (a `?query` specifier), so no other file's loaded peer is in the way. `mock.module` is
 * process-global: the real module is put back in `afterAll`.
 */
import { cleanup, render } from '@testing-library/react'
import { afterAll, afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { createPeleLoader } from './pele-peer'
import type { PeleModule } from './pele-peer'

// A SNAPSHOT: the namespace object is live, so restoring from it would restore the mock.
const real = { ...(await import('./pele-peer')) }
const freshSpecifier = (path: string, tag: string): string => `${path}?${tag}`

afterEach(cleanup)
afterAll(() => {
  mock.module('./pele-peer', () => real)
})

const missing = (): Promise<PeleModule> => Promise.reject(new Error("Cannot find package 'pele'"))

describe('the pele loader — peer missing', () => {
  test('resolves null once, reported with the install and the swap, never thrown', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const load = createPeleLoader(missing)
      await expect(load()).resolves.toBeNull()
      await expect(load()).resolves.toBeNull()
      expect(warn).toHaveBeenCalledTimes(1)
      const message = String(warn.mock.calls[0]?.[0])
      expect(message).toContain('bun add pele')
      expect(message).toContain('bun remove beautiful-mermaid')
    } finally {
      warn.mockRestore()
    }
  })
})

describe('MermaidDiagram — peer missing', () => {
  test('the fence stays a code block with its text', async () => {
    mock.module('./pele-peer', () => ({ ...real, loadPele: () => Promise.resolve(null) }))
    const { MermaidDiagram } = (await import(
      freshSpecifier('./mermaid', 'mermaid-no-pele')
    )) as typeof import('./mermaid')
    const { container } = render(<MermaidDiagram code={'graph TD\n  A --> B'} />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container.querySelector('[data-slot="mermaid"]')).toBeNull()
    expect(container.querySelector('pre')?.textContent).toContain('graph TD')
  })
})
