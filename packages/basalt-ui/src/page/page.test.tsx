/**
 * `Page`: the screen root. Markup, the container, the `fill` and `landmark` props, the aside
 * column slot and the `DetailHost` it provides. Geometry is `tests/layout/page-core.layout.test.ts`'s.
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useContext } from 'react'
import { renderToString } from 'react-dom/server'
import type { DetailEntry, DetailHost } from '../core/ports'
import { DetailHostContext, Page, PageHostContext } from './page'
import { PageAside } from './page-aside'
import { PageBar } from './page-bar'
import { fakeHost, installLayoutDoubles, restoreLayoutDoubles } from './page.test-support'

beforeEach(installLayoutDoubles)
afterEach(() => {
  cleanup()
  restoreLayoutDoubles()
})

const root = (container: HTMLElement): HTMLElement =>
  container.querySelector<HTMLElement>('[data-slot="page"]')!

describe('Page markup', () => {
  test('renders a div root stamped data-slot="page" with its children in the main column', () => {
    const { container } = render(
      <Page>
        <p>body</p>
      </Page>,
    )
    expect(root(container).tagName).toBe('DIV')
    expect(container.querySelector('[data-slot="page-main"]')?.textContent).toBe('body')
  })

  test('area is stamped as data-area and omitted when absent', () => {
    const { container, rerender } = render(<Page area="photos" />)
    expect(root(container).getAttribute('data-area')).toBe('photos')
    rerender(<Page />)
    expect(root(container).hasAttribute('data-area')).toBe(false)
  })

  test('it is the page container the @wide tier is read against', () => {
    const { container } = render(<Page />)
    expect(root(container).classList.contains('@container')).toBe(true)
  })

  test('it declares --page-sticky-top as the published band height, zero without a bar', () => {
    const { container } = render(<Page />)
    expect(root(container).className).toContain('[--page-sticky-top:var(--page-bar-h,0px)]')
  })

  test('the aside slot is an empty hidden column while no aside is mounted', () => {
    const { container } = render(<Page />)
    const slot = container.querySelector('[data-slot="page-aside-slot"]')
    expect(slot).not.toBeNull()
    expect(slot?.childElementCount).toBe(0)
    expect(slot?.classList.contains('empty:hidden')).toBe(true)
  })

  test('without fill it sets no inline style', () => {
    const { container } = render(<Page />)
    expect(root(container).hasAttribute('style')).toBe(false)
  })
})

describe('Page landmark', () => {
  test('landmark renders <main> when there is no PageHost', () => {
    const { container } = render(<Page landmark />)
    expect(root(container).tagName).toBe('MAIN')
    expect(screen.getByRole('main')).toBeDefined()
  })

  test('without landmark there is no main landmark', () => {
    render(<Page />)
    expect(screen.queryByRole('main')).toBeNull()
  })

  test('under a PageHost the shell owns <main>: landmark renders a div and no aside slot', () => {
    const { host } = fakeHost()
    const { container } = render(
      <PageHostContext value={host}>
        <Page landmark />
      </PageHostContext>,
    )
    expect(root(container).tagName).toBe('DIV')
    expect(screen.queryByRole('main')).toBeNull()
    expect(container.querySelector('[data-slot="page-aside-slot"]')).toBeNull()
  })
})

describe('Page fill', () => {
  test('fill gives the page a definite height', () => {
    const { container } = render(<Page fill />)
    expect(root(container).hasAttribute('data-fill')).toBe(true)
    expect(root(container).classList.contains('h-full')).toBe(true)
  })

  test('fill={false} and an absent fill leave the height to the content', () => {
    const { container, rerender } = render(<Page fill={false} />)
    expect(root(container).hasAttribute('data-fill')).toBe(false)
    expect(root(container).classList.contains('h-full')).toBe(false)
    rerender(<Page />)
    expect(root(container).classList.contains('h-full')).toBe(false)
  })

  test('fill={{ min }} keeps a floor in px through --page-fill-min', () => {
    const { container } = render(<Page fill={{ min: 420 }} />)
    expect(root(container).style.getPropertyValue('--page-fill-min')).toBe('420px')
    expect(root(container).className).toContain('min-h-(--page-fill-min,0px)')
  })

  test('a partial fill follows its condition across renders', () => {
    const { container, rerender } = render(<Page fill={{ min: 420 }} />)
    rerender(<Page fill={false} />)
    expect(root(container).hasAttribute('data-fill')).toBe(false)
    expect(root(container).style.getPropertyValue('--page-fill-min')).toBe('')
  })
})

function HostProbe({ onRead }: { onRead: (host: DetailHost | null) => void }) {
  onRead(useContext(DetailHostContext))
  return null
}

describe('Page DetailHost', () => {
  test('there is no host while no PageAside is mounted: a consumer keeps its own sheet', () => {
    let seen: DetailHost | null | 'unset' = 'unset'
    render(
      <Page>
        <HostProbe onRead={(host) => (seen = host)} />
      </Page>,
    )
    expect(seen).toBeNull()
  })

  test('a mounted PageAside makes the page a DetailHost, closed until shown', () => {
    let seen: DetailHost | null = null
    render(
      <Page>
        <HostProbe onRead={(host) => (seen = host)} />
        <PageAside title="Details">x</PageAside>
      </Page>,
    )
    expect(seen).not.toBeNull()
    expect((seen as unknown as DetailHost).isOpen).toBe(false)
  })

  test('show() draws the entry in the aside and hide() returns to its own content', () => {
    let host: DetailHost | null = null
    render(
      <Page>
        <HostProbe onRead={(h) => (host = h)} />
        <PageAside title="Details">own content</PageAside>
      </Page>,
    )
    const entry: DetailEntry = { title: 'Run 7', body: () => <p>run seven</p> }
    act(() => (host as unknown as DetailHost).show(entry))
    expect(screen.getByLabelText('Run 7').textContent).toContain('run seven')
    expect(screen.queryByText('own content')).toBeNull()
    act(() => (host as unknown as DetailHost).hide())
    expect(screen.getByLabelText('Details').textContent).toContain('own content')
  })
})

describe('Page on the server', () => {
  test('renders to a string with the page markup and no aside column content', () => {
    const html = renderToString(
      <Page area="runs">
        <PageBar title="Runs" />
      </Page>,
    )
    expect(html).toContain('data-slot="page"')
    expect(html).toContain('<h1')
    expect(html).not.toContain('data-slot="page-aside"')
  })
})
