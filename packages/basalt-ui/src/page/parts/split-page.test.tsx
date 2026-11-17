/**
 * `SplitPage`: both render props always mount; CSS alone shows the list while `selected` is false
 * and the pane once it is true. The viewport behaviour is `tests/layout/inner-nav.layout.test.ts`'s.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
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

  test('a selected pane with onBack draws the back link, hidden from the wide tier, and calls it', () => {
    let backs = 0
    render(
      <SplitPage
        selected
        onBack={() => {
          backs += 1
        }}
        backLabel="Settings"
        list={() => <p>list</p>}
        detail={() => <p>pane</p>}
      />,
    )
    const back = screen.getByRole('button', { name: 'Settings' })
    expect(part('split-page-detail').contains(back)).toBe(true)
    expect(back.className).toContain('@wide:hidden')
    fireEvent.click(back)
    expect(backs).toBe(1)
  })

  test('the link names itself from the catalogue by default, and needs a selection and a handler', () => {
    const { rerender } = render(
      <SplitPage selected onBack={() => {}} list={() => <p>list</p>} detail={() => <p>pane</p>} />,
    )
    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined()
    rerender(
      <SplitPage
        selected={false}
        onBack={() => {}}
        list={() => <p>l</p>}
        detail={() => <p>p</p>}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<SplitPage selected list={() => <p>l</p>} detail={() => <p>p</p>} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

/** happy-dom has no Tailwind: the one rule the focus hand-off reads, `hidden` below the wide tier. */
function hideBelowWide(): void {
  const style = document.createElement('style')
  style.textContent = '.hidden { display: none }'
  document.head.append(style)
}

describe('SplitPage focus follows the swap', () => {
  beforeEach(() => {
    hideBelowWide()
  })
  afterEach(() => {
    document.head.querySelectorAll('style').forEach((el) => el.remove())
  })

  const Pair = ({ selected }: { selected: boolean }) => (
    <SplitPage
      selected={selected}
      onBack={() => {}}
      list={() => (
        <nav>
          <a href="#a">A</a>
          <a href="#b" aria-current="page">
            B
          </a>
        </nav>
      )}
      detail={() => <h2>Pane B</h2>}
    />
  )

  test('select: focus moves from the list link to the detail heading', () => {
    const { rerender } = render(<Pair selected={false} />)
    screen.getByRole('link', { name: 'B' }).focus()
    rerender(<Pair selected />)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Pane B' }))
  })

  test("back: focus moves from the back link to the list's current item", () => {
    const { rerender } = render(<Pair selected />)
    screen.getByRole('button', { name: 'Back' }).focus()
    rerender(<Pair selected={false} />)
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'B' }))
  })

  test('a first render with a selection does not take focus', () => {
    render(<Pair selected />)
    expect(document.activeElement).toBe(document.body)
  })

  test('at the wide tier both panes show and focus stays where it is', () => {
    document.head.querySelectorAll('style').forEach((el) => el.remove())
    const { rerender } = render(<Pair selected={false} />)
    const link = screen.getByRole('link', { name: 'B' })
    link.focus()
    rerender(<Pair selected />)
    expect(document.activeElement).toBe(link)
  })
})
