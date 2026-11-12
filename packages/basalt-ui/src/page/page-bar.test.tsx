/**
 * `PageBar`: the sticky band, in a shell and not. Ported from the 2.x suite
 * (`src/shell/page-bar.test.tsx`, 28 executed on master) to the v3 contract: one bar per `Page`, the
 * title as `h1` or breadcrumb leaf, the measured `--page-bar-h`, typed actions. Geometry is
 * `tests/layout/page-core.layout.test.ts`'s.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { useLayoutEffect } from 'react'
import { renderToString } from 'react-dom/server'
import type { PageAction } from './contract'
import { Page, PageHostContext } from './page'
import { PageBar, PageCrumb } from './page-bar'
import { fakeHost, installLayoutDoubles, restoreLayoutDoubles, slotOf } from './page.test-support'

const HEIGHT = 56

let rect: ReturnType<typeof spyOn>

beforeEach(() => {
  installLayoutDoubles()
  rect = spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const h = this.getAttribute('data-slot') === 'page-bar' ? HEIGHT : 0
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: h,
      width: 0,
      height: h,
      toJSON: () => ({}),
    }
  })
})

afterEach(() => {
  cleanup()
  rect.mockRestore()
  restoreLayoutDoubles()
  document.title = ''
  document.documentElement.style.removeProperty('--page-bar-h')
})

const band = (): HTMLElement | null => document.querySelector('[data-slot="page-bar"]')
const pageEl = (): HTMLElement => document.querySelector<HTMLElement>('[data-slot="page"]')!
const action = (id: string, extra: Partial<PageAction> = {}): PageAction =>
  ({ id, label: id, onClick: () => {}, ...extra }) as PageAction

describe('PageBar without a shell', () => {
  test('title is the visible h1 inside the band', () => {
    render(
      <Page>
        <PageBar title="Runs" />
      </Page>,
    )
    const h1 = screen.getByRole('heading', { level: 1, name: 'Runs' })
    expect(band()?.contains(h1)).toBe(true)
    expect(h1.classList.contains('sr-only')).toBe(false)
  })

  test('the band is sticky at the top of its scrollport', () => {
    render(
      <Page>
        <PageBar title="Runs" />
      </Page>,
    )
    expect(band()?.classList.contains('sticky')).toBe(true)
    expect(band()?.classList.contains('top-0')).toBe(true)
  })

  test('renders exactly one h1', () => {
    render(
      <Page>
        <PageBar title="Runs" controls={slotOf('Range')} actions={[action('new')]} />
      </Page>,
    )
    expect(document.querySelectorAll('h1')).toHaveLength(1)
  })

  test('an empty band renders nothing at all', () => {
    const { container } = render(
      <Page>
        <PageBar />
      </Page>,
    )
    expect(band()).toBeNull()
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('[data-slot="page-main"]')?.childElementCount).toBe(0)
  })

  test('an empty controls slot and empty actions do not make a band', () => {
    render(
      <Page>
        <PageBar controls={slotOf('Range', 0)} actions={[]} />
      </Page>,
    )
    expect(band()).toBeNull()
  })

  test('title alone is enough for a band', () => {
    render(
      <Page>
        <PageBar title="Runs" />
      </Page>,
    )
    expect(band()).not.toBeNull()
  })

  test('controls and tabs render through their slots', () => {
    render(
      <Page>
        <PageBar controls={slotOf('Range')} tabs={slotOf('Overview')} />
      </Page>,
    )
    expect(screen.getByRole('button', { name: 'Range' })).toBeDefined()
    expect(band()?.querySelector('[data-slot="page-bar-tabs"]')?.textContent).toBe('Overview')
    expect(band()?.querySelector('[data-slot="page-bar-controls"]')?.textContent).toBe('Range')
  })

  test('a string parent is a link before the leaf; a NavTarget parent is plain text', () => {
    const { rerender } = render(
      <Page>
        <PageBar title="Run 7" parent={{ label: 'Runs', href: '/runs' }} />
      </Page>,
    )
    expect(screen.getByRole('link', { name: 'Runs' }).getAttribute('href')).toBe('/runs')
    rerender(
      <Page>
        <PageBar
          title="Run 7"
          parent={{ label: 'Runs', href: { __brand: 'NavTarget' } as never }}
        />
      </Page>,
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Runs')).toBeDefined()
  })

  test('does not touch document.title: a bare route sets its own', () => {
    document.title = 'Sign in'
    render(
      <Page landmark>
        <PageBar title="Welcome" />
      </Page>,
    )
    expect(document.title).toBe('Sign in')
  })

  test('renders standalone outside a Page', () => {
    render(<PageBar title="Loose" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Loose' })).toBeDefined()
    expect(document.documentElement.style.getPropertyValue('--page-bar-h')).toBe(`${HEIGHT}px`)
  })
})

describe('PageBar refresh', () => {
  test('is a named button that calls onSync', () => {
    const calls: string[] = []
    render(
      <Page>
        <PageBar refresh={{ scope: 'page', syncing: false, onSync: () => calls.push('sync') }} />
      </Page>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(calls).toEqual(['sync'])
  })

  test('is busy while syncing and carries the error as its title', () => {
    render(
      <Page>
        <PageBar refresh={{ scope: 'global', syncing: true, onSync: () => {}, error: 'Offline' }} />
      </Page>,
    )
    const button = screen.getByRole('button', { name: 'Refresh' })
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.getAttribute('title')).toBe('Offline')
    expect(button.getAttribute('data-scope')).toBe('global')
  })
})

describe('PageBar actions', () => {
  test('a button action renders its label and runs onClick', () => {
    const calls: string[] = []
    render(
      <Page>
        <PageBar actions={[action('new', { onClick: () => calls.push('new') })]} />
      </Page>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'new' }))
    expect(calls).toEqual(['new'])
  })

  test('the primary action is the filled variant, the others are not', () => {
    render(
      <Page>
        <PageBar actions={[action('a'), action('b', { primary: true })]} />
      </Page>,
    )
    expect(screen.getByRole('button', { name: 'b' }).className).toContain('bg-primary')
    expect(screen.getByRole('button', { name: 'a' }).className).not.toContain('bg-primary')
  })

  test('no primary is allowed', () => {
    render(
      <Page>
        <PageBar actions={[action('a'), action('b')]} />
      </Page>,
    )
    expect(document.querySelectorAll('[data-action-id]')).toHaveLength(2)
  })

  test('actions sharing a group render joined in one group; others stand alone', () => {
    render(
      <Page>
        <PageBar
          actions={[
            action('prev', { group: 'date' }),
            action('today', { group: 'date' }),
            action('next', { group: 'date' }),
            action('export'),
          ]}
        />
      </Page>,
    )
    const groups = document.querySelectorAll('[data-slot="page-action-group"]')
    expect(groups).toHaveLength(1)
    expect([...groups[0]!.querySelectorAll('[data-action-id]')].map((e) => e.textContent)).toEqual([
      'prev',
      'today',
      'next',
    ])
    expect(groups[0]!.contains(document.querySelector('[data-action-id="export"]'))).toBe(false)
  })

  test('a text action renders its text and is not a button', () => {
    render(
      <Page>
        <PageBar actions={[{ kind: 'text', id: 'range', text: 'Nov 3 to 9' }]} />
      </Page>,
    )
    const text = document.querySelector('[data-action-id="range"]')!
    expect(text.textContent).toBe('Nov 3 to 9')
    expect(text.tagName).toBe('SPAN')
  })

  test("mobile 'hidden' hides the action below the wide tier, shown from it", () => {
    render(
      <Page>
        <PageBar actions={[action('a', { mobile: 'hidden' })]} />
      </Page>,
    )
    const cls = document.querySelector('[data-action-id="a"]')!.className
    expect(cls).toContain('hidden')
    expect(cls).toContain('@wide:inline-flex')
  })

  test('the primary and the first two actions stay in the bar; the third folds', () => {
    render(
      <Page>
        <PageBar actions={[action('a'), action('b'), action('c')]} />
      </Page>,
    )
    expect(document.querySelector('[data-action-id="a"]')!.className).not.toContain('hidden')
    expect(document.querySelector('[data-action-id="b"]')!.className).not.toContain('hidden')
    expect(document.querySelector('[data-action-id="c"]')!.className).toContain('hidden')
    expect(screen.getByRole('button', { name: 'More actions' })).toBeDefined()
  })

  test('there is no overflow menu when nothing folds', () => {
    render(
      <Page>
        <PageBar actions={[action('a'), action('b')]} />
      </Page>,
    )
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  test("an icon renders beside the label and the label stays the button's name", () => {
    const Icon = ({
      className,
      ...rest
    }: {
      className?: string
      'aria-hidden'?: boolean | 'true' | 'false'
    }) => <svg data-testid="icon" className={className} {...rest} />
    render(
      <Page>
        <PageBar actions={[action('new', { icon: Icon })]} />
      </Page>,
    )
    expect(screen.getByTestId('icon').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('button', { name: 'new' })).toBeDefined()
  })
})

describe('PageBar measures its height', () => {
  test('publishes --page-bar-h on the Page element', () => {
    render(
      <Page>
        <PageBar title="Runs" />
      </Page>,
    )
    expect(pageEl().style.getPropertyValue('--page-bar-h')).toBe(`${HEIGHT}px`)
  })

  test('a zero reading is refused', () => {
    rect.mockImplementation(
      () => ({ top: 0, bottom: 0, height: 0, width: 0, left: 0, right: 0, x: 0, y: 0 }) as DOMRect,
    )
    render(
      <Page>
        <PageBar title="Runs" />
      </Page>,
    )
    expect(pageEl().style.getPropertyValue('--page-bar-h')).toBe('')
  })

  test('unmounting removes the property so the next route does not inherit it', () => {
    const { rerender } = render(
      <Page>
        <PageBar title="Runs" />
      </Page>,
    )
    rerender(<Page />)
    expect(pageEl().style.getPropertyValue('--page-bar-h')).toBe('')
  })

  test('a passive effect already sees the property: it is published before first paint', () => {
    let seen = 'unset'
    function Probe() {
      useLayoutEffect(() => {
        seen = pageEl().style.getPropertyValue('--page-bar-h')
      }, [])
      return null
    }
    render(
      <Page>
        <PageBar title="Runs" />
        <Probe />
      </Page>,
    )
    expect(seen).toBe(`${HEIGHT}px`)
  })

  test('mounts and publishes once with no ResizeObserver at all', () => {
    const saved = globalThis.ResizeObserver
    // @ts-expect-error simulating a DOM without the observer
    delete globalThis.ResizeObserver
    try {
      render(
        <Page>
          <PageBar title="Runs" controls={slotOf('Range')} />
        </Page>,
      )
      expect(pageEl().style.getPropertyValue('--page-bar-h')).toBe(`${HEIGHT}px`)
    } finally {
      globalThis.ResizeObserver = saved
    }
  })

  test('the first publish re-aims location.hash once, instantly', () => {
    const target = document.createElement('section')
    target.id = 'latency'
    document.body.append(target)
    const scroll = spyOn(target, 'scrollIntoView').mockImplementation(() => {})
    const previous = location.hash
    location.hash = '#latency'
    try {
      render(
        <Page>
          <PageBar title="Runs" />
        </Page>,
      )
      expect(scroll).toHaveBeenCalledWith({ behavior: 'instant' })
    } finally {
      location.hash = previous
      target.remove()
    }
  })
})

describe('PageBar is one per Page', () => {
  test('a second bar under one Page renders nothing and warns once', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render(
        <Page>
          <PageBar title="First" />
          <PageBar title="Second" />
        </Page>,
      )
      expect(document.querySelectorAll('[data-slot="page-bar"]')).toHaveLength(1)
      expect(screen.queryByText('Second')).toBeNull()
      expect(document.querySelectorAll('h1')).toHaveLength(1)
      const bar = warn.mock.calls.filter((c: unknown[]) =>
        String(c[0]).includes('more than one PageBar'),
      )
      expect(bar).toHaveLength(1)
    } finally {
      warn.mockRestore()
    }
  })

  test('nested layouts that each render a bar raise the same assertion', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    function Layout({ children }: { children?: React.ReactNode }) {
      return (
        <div>
          <PageBar title="Layout" />
          {children}
        </div>
      )
    }
    try {
      render(
        <Page>
          <Layout>
            <Layout />
          </Layout>
        </Page>,
      )
      expect(document.querySelectorAll('[data-slot="page-bar"]')).toHaveLength(1)
      expect(
        warn.mock.calls.some((c: unknown[]) => String(c[0]).includes('more than one PageBar')),
      ).toBe(true)
    } finally {
      warn.mockRestore()
    }
  })

  test('one bar does not warn', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render(
        <Page>
          <PageBar title="Only" />
        </Page>,
      )
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  test('when the owner leaves, the other bar takes the band', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { rerender } = render(
        <Page>
          <PageBar key="a" title="First" />
          <PageBar key="b" title="Second" />
        </Page>,
      )
      rerender(
        <Page>
          <PageBar key="b" title="Second" />
        </Page>,
      )
      expect(screen.getByRole('heading', { level: 1, name: 'Second' })).toBeDefined()
    } finally {
      warn.mockRestore()
    }
  })

  test('bars under two different Pages do not conflict', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render(
        <>
          <Page>
            <PageBar title="One" />
          </Page>
          <Page>
            <PageBar title="Two" />
          </Page>
        </>,
      )
      expect(document.querySelectorAll('h1')).toHaveLength(2)
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  test('six actions and two primaries each raise a dev assertion', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const six = Array.from({ length: 6 }, (_, i) => action(`a${i}`))
      render(
        <Page>
          <PageBar actions={six as never} />
        </Page>,
      )
      expect(warn.mock.calls.some((c: unknown[]) => String(c[0]).includes('at most 5'))).toBe(true)
      cleanup()
      warn.mockClear()
      render(
        <Page>
          <PageBar actions={[action('a', { primary: true }), action('b', { primary: true })]} />
        </Page>,
      )
      expect(
        warn.mock.calls.some((c: unknown[]) => String(c[0]).includes('at most one primary')),
      ).toBe(true)
    } finally {
      warn.mockRestore()
    }
  })
})

describe('PageBar in a shell (PageHost)', () => {
  const inShell = (host: ReturnType<typeof fakeHost>['host'], bar: React.ReactNode) =>
    render(
      <PageHostContext value={host}>
        <Page>{bar}</Page>
      </PageHostContext>,
    )

  test('title claims the breadcrumb leaf, with its parent, and the title region', () => {
    const shell = fakeHost()
    inShell(shell.host, <PageBar title="Run 7" parent={{ label: 'Runs', href: '/runs' }} />)
    const [crumb] = shell.of('breadcrumb')
    expect(crumb).toBeDefined()
    const element = crumb!.node as React.ReactElement<{ title: string; parent: unknown }>
    expect(element.type).toBe(PageCrumb)
    expect(element.props.title).toBe('Run 7')
    expect(element.props.parent).toEqual({ label: 'Runs', href: '/runs' })
    expect(shell.of('title').map((c) => c.node)).toEqual(['Run 7'])
  })

  test('the h1 is in-flow and screen-reader only, and the band is absent when only title is set', () => {
    const shell = fakeHost()
    inShell(shell.host, <PageBar title="Run 7" />)
    const h1 = screen.getByRole('heading', { level: 1, name: 'Run 7' })
    expect(h1.classList.contains('sr-only')).toBe(true)
    expect(band()).toBeNull()
  })

  test('exactly one h1 in a shell as well', () => {
    const shell = fakeHost()
    inShell(shell.host, <PageBar title="Run 7" controls={slotOf('Range')} />)
    expect(document.querySelectorAll('h1')).toHaveLength(1)
  })

  test('names document.title and restores it on unmount', () => {
    document.title = 'basalt'
    const shell = fakeHost()
    const { unmount } = inShell(shell.host, <PageBar title="Run 7" />)
    expect(document.title).toBe('Run 7')
    unmount()
    expect(document.title).toBe('basalt')
  })

  test('actions claim the header end and are not drawn in the band', () => {
    const shell = fakeHost()
    inShell(shell.host, <PageBar controls={slotOf('Range')} actions={[action('new')]} />)
    expect(shell.of('actions')).toHaveLength(1)
    expect(band()?.querySelector('[data-action-id]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Range' })).toBeDefined()
  })

  test('every claim is released on unmount', () => {
    const shell = fakeHost()
    const { unmount } = inShell(shell.host, <PageBar title="Run 7" actions={[action('new')]} />)
    expect(shell.claims.length).toBeGreaterThan(0)
    unmount()
    expect(shell.claims).toHaveLength(0)
  })

  test('reports the band height to the host and resets it to 0 on unmount', () => {
    const shell = fakeHost()
    const { unmount } = inShell(shell.host, <PageBar controls={slotOf('Range')} />)
    expect(shell.heights).toContain(HEIGHT)
    unmount()
    expect(shell.heights.at(-1)).toBe(0)
  })

  test('a second bar claims nothing', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const shell = fakeHost()
      inShell(
        shell.host,
        <>
          <PageBar title="First" />
          <PageBar title="Second" />
        </>,
      )
      expect(shell.of('title').map((c) => c.node)).toEqual(['First'])
      expect(document.title).toBe('First')
    } finally {
      warn.mockRestore()
    }
  })

  test('a bar without a title claims no breadcrumb and leaves document.title alone', () => {
    document.title = 'basalt'
    const shell = fakeHost()
    inShell(shell.host, <PageBar controls={slotOf('Range')} />)
    expect(shell.of('breadcrumb')).toHaveLength(0)
    expect(document.title).toBe('basalt')
  })
})

describe('PageCrumb', () => {
  test('rendered as is it is a plain trail of parent and leaf', () => {
    const { container } = render(
      <PageCrumb title="Run 7" parent={{ label: 'Runs', href: '/runs' }} />,
    )
    expect(container.textContent).toBe('RunsRun 7')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/runs')
  })
})

describe('PageBar on the server', () => {
  test('renders the band markup to a string with one h1', () => {
    const html = renderToString(
      <Page>
        <PageBar title="Runs" controls={slotOf('Range')} />
      </Page>,
    )
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('data-slot="page-bar"')
  })
})
