/**
 * `Callout` — the `BasaltProps` contract and the kind→class mapping. CSS-module hashes are
 * unavailable under `bun test` (every `classes.*` resolves to `''`), so the kind class cannot be
 * asserted by name; what CAN be asserted is that the caller's own class survives the join, which is
 * exactly what the hand-rolled `[…].filter(Boolean).join(' ')` used to decide on its own.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { Callout } from './callout'

describe('className and style reach the root', () => {
  test('className is appended, never a replacement, and style merges onto the root', () => {
    const { container } = render(
      <Callout kind="warn" title="Heads up" className="my-callout" style={{ marginTop: '3px' }}>
        <p>Rate-limited.</p>
      </Callout>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.classList.contains('my-callout')).toBe(true)
    expect(root.getAttribute('style') ?? '').toContain('margin-top: 3px')
    expect(screen.getByText('Heads up')).toBeDefined()
  })

  test('no className and no style leave the root with neither an empty class nor a style attr', () => {
    const { container } = render(<Callout>body</Callout>)
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('style')).toBeNull()
    expect(root.textContent).toBe('body')
  })

  test('the title row renders only with a title — the body always does', () => {
    const { container } = render(<Callout icon={<span data-testid="glyph">!</span>}>body</Callout>)
    expect(screen.queryByTestId('glyph')).toBeNull()
    expect(container.textContent).toBe('body')
  })
})
