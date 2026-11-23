/**
 * `SplitPage`: both render props always mount; CSS alone shows the list while `selected` is false
 * and the pane once it is true. The viewport behaviour is `tests/layout/inner-nav.layout.test.ts`'s.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { widthStore } from '../core/panel-store'
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

const resizable = () => (
  <SplitPage
    selected={false}
    resize={{ id: 'mail' }}
    list={() => <p>list</p>}
    detail={() => <p>pane</p>}
  />
)
const separator = (): HTMLElement => screen.getByRole('separator', { name: 'Resize the list' })
const splitW = (): string | undefined =>
  document
    .querySelector<HTMLElement>('[data-slot="split-page"]')
    ?.style.getPropertyValue('--split-w')

describe('SplitPage resize', () => {
  const proto = HTMLElement.prototype
  const rect = Object.getOwnPropertyDescriptor(proto, 'getBoundingClientRect')
  const realStyle = window.getComputedStyle

  beforeEach(() => {
    proto.getBoundingClientRect = function (this: HTMLElement): DOMRect {
      const root = this.closest<HTMLElement>('[data-slot="split-page"]')
      const w =
        this.dataset['slot'] === 'split-page-list'
          ? parseFloat(root?.style.getPropertyValue('--split-w') ?? '') || 0
          : 0
      return { width: w, height: 0, x: 0, y: 0, top: 0, left: 0, right: w, bottom: 0, toJSON() {} }
    }
    window.getComputedStyle = ((node: Element) =>
      (node as HTMLElement).dataset?.['slot'] === 'split-page-list'
        ? ({ maxWidth: '640px' } as CSSStyleDeclaration)
        : realStyle(node)) as typeof realStyle
  })

  afterEach(() => {
    cleanup()
    widthStore('split:mail').reset()
    window.getComputedStyle = realStyle
    if (rect !== undefined) Object.defineProperty(proto, 'getBoundingClientRect', rect)
    else Reflect.deleteProperty(proto, 'getBoundingClientRect')
  })

  test('the separator is a named vertical separator with its px range', () => {
    render(resizable())
    expect(separator().getAttribute('aria-orientation')).toBe('vertical')
    expect(separator().getAttribute('aria-valuemin')).toBe('240')
  })

  test('a stored width is read from its basalt key and sets the list column on mount', () => {
    widthStore('split:mail').set(400)
    expect(window.localStorage.getItem('basalt:panel:split:mail:width')).not.toBeNull()
    render(resizable())
    expect(splitW()).toBe('400px')
  })

  test('a stored width outside the range is clamped to the max', () => {
    widthStore('split:mail').set(900)
    render(resizable())
    expect(splitW()).toBe('640px')
  })

  test('ArrowRight widens the list by 16px and commits it; ArrowLeft narrows it back', () => {
    render(resizable())
    fireEvent.keyDown(separator(), { key: 'ArrowRight' })
    expect(widthStore('split:mail').get()).toBe(336)
    expect(splitW()).toBe('336px')
    fireEvent.keyDown(separator(), { key: 'ArrowLeft' })
    expect(widthStore('split:mail').get()).toBe(320)
  })

  test('Enter resets the stored width to the default', () => {
    widthStore('split:mail').set(400)
    render(resizable())
    fireEvent.keyDown(separator(), { key: 'Enter' })
    expect(widthStore('split:mail').get()).toBeNull()
    expect(splitW()).toBe('320px')
  })

  test('a double click resets the stored width to the default', () => {
    widthStore('split:mail').set(400)
    render(resizable())
    fireEvent.doubleClick(separator())
    expect(widthStore('split:mail').get()).toBeNull()
  })

  test('without resize there is no separator and no list width variable', () => {
    render(<SplitPage selected={false} list={() => <p>list</p>} detail={() => <p>pane</p>} />)
    expect(screen.queryByRole('separator')).toBeNull()
    expect(splitW()).toBe('')
  })

  test('scroll panes: the list pane has no ScrollArea and is a flex column', () => {
    render(
      <SplitPage
        selected={false}
        scroll="panes"
        list={() => <p>list</p>}
        detail={() => <p>pane</p>}
      />,
    )
    expect(part('split-page-list').querySelector('[data-slot="scroll-area"]')).toBeNull()
    expect(part('split-page-list').textContent).toBe('list')
    expect(part('split-page-list').className).toContain('flex min-h-0 flex-col')
  })
})
