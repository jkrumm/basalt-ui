/**
 * `SplitPage`: both render props always mount; CSS alone shows the list while `selected` is false
 * and the pane once it is true. The viewport behaviour is `tests/layout/inner-nav.layout.test.ts`'s.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { SplitPage } from './split-page'

afterEach(cleanup)

const part = (name: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`[data-slot="${name}"]`)
  if (el === null) throw new Error(`no ${name}`)
  return el
}

describe('SplitPage', () => {
  test('unset: the pane is hidden below the wide tier, the list is not', () => {
    render(<SplitPage selected={false} list={() => <p>list</p>} detail={() => <p>pane</p>} />)
    expect(part('split-page-detail').className).toContain('hidden @wide:block')
    expect(part('split-page-list').className).not.toContain('hidden')
    expect(part('split-page').hasAttribute('data-selected')).toBe(false)
  })

  test('set: the list is hidden below the wide tier, the pane is not', () => {
    render(<SplitPage selected list={() => <p>list</p>} detail={() => <p>pane</p>} />)
    expect(part('split-page-list').className).toContain('hidden @wide:block')
    expect(part('split-page-detail').className).not.toContain('hidden')
    expect(part('split-page').hasAttribute('data-selected')).toBe(true)
  })

  test('both panes stay in the DOM whichever is selected (no twin, no conditional mount)', () => {
    const { rerender } = render(
      <SplitPage selected={false} list={() => <p>list</p>} detail={() => <p>pane</p>} />,
    )
    for (const selected of [false, true]) {
      rerender(
        <SplitPage selected={selected} list={() => <p>list</p>} detail={() => <p>pane</p>} />,
      )
      expect(part('split-page-list').textContent).toBe('list')
      expect(part('split-page-detail').textContent).toBe('pane')
    }
  })

  test('the list column is a ScrollArea; the detail is not a scroller', () => {
    render(<SplitPage selected list={() => <p>list</p>} detail={() => <p>pane</p>} />)
    expect(part('split-page-list').querySelector('[data-slot="scroll-area"]')).not.toBeNull()
    expect(part('split-page-detail').querySelector('[data-slot="scroll-area"]')).toBeNull()
    expect(part('split-page-detail').className).not.toMatch(/overflow/)
  })
})
