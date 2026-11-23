/**
 * `PageBar`: the sticky band, in a shell and not. Ported from the 2.x suite
 * (`src/shell/page-bar.test.tsx`, 28 executed on master) to the v3 contract: one bar per `Page`, the
 * title as `h1` or breadcrumb leaf, the measured `--page-bar-h`, typed actions. Geometry is
 * `tests/layout/page-core.layout.test.ts`'s.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { useLayoutEffect } from 'react'
import { renderToString } from 'react-dom/server'
import { memoryHandle } from '../controls/control-view.handles'
import { filterSlot } from '../controls/filter-slot'
import { spec } from '../controls/spec'
import type { PageAction } from './contract'
import { Page, PageHostContext } from './page'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
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

  test('a band that holds a control is sticky at the top of its scrollport', () => {
    render(
      <Page>
        <PageBar title="Runs" controls={slotOf('Range')} />
      </Page>,
    )
    expect(band()?.classList.contains('sticky')).toBe(true)
    expect(band()?.classList.contains('z-30')).toBe(true)
    expect(band()?.classList.contains('top-0')).toBe(true)
    expect(band()?.hasAttribute('data-sticky')).toBe(true)
  })

  test('a band of a title alone scrolls away with the page', () => {
    render(
      <Page>
        <PageBar title="Runs" />
      </Page>,
    )
    expect(band()?.classList.contains('sticky')).toBe(false)
    expect(band()?.hasAttribute('data-sticky')).toBe(false)
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

  test('a filterSlot in the controls slot renders as a FilterSet, and its pills take the room the row leaves', () => {
    const range = memoryHandle<string>('range', 'a', {
      kind: 'enum',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    })
    render(
      <Page>
        <PageBar
          controls={filterSlot([
            spec(range, 'Range'),
            spec(
              memoryHandle<string>('team', 'a', {
                kind: 'enum',
                options: [{ value: 'a', label: 'A' }],
              }),
              'Team',
            ),
          ])}
        />
      </Page>,
    )
    const controls = band()!.querySelector('[data-slot="page-bar-controls"]')!
    expect(controls.querySelector('[data-slot="filter-set"]')).not.toBeNull()
    expect(controls.className).toContain('has-[[data-slot=filter-pills]]:flex-1')
    expect(controls.parentElement!.getAttribute('data-slot')).toBe('page-bar-end')
    expect(controls.parentElement!.className).toContain('flex-1')
  })

  test('a band with no controls keeps its cell at content width', () => {
    render(
      <Page>
        <PageBar title="Runs" actions={[action('new')]} />
      </Page>,
    )
    expect(
      band()!.querySelector('[data-slot="page-actions"]')!.parentElement!.className,
    ).not.toContain('basis-full')
  })

  test('tabs take { handle, label } and draw a tab strip bound to the handle', () => {
    const view = memoryHandle<string>('view', 'a', {
      kind: 'enum',
      options: [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ],
    })
    render(
      <Page>
        <PageBar tabs={{ state: view, label: 'Orders view' }} />
      </Page>,
    )
    const home = band()?.querySelector('[data-slot="page-bar-tabs"]')
    expect(home?.querySelector('[data-slot="tabs"]')).not.toBeNull()
    expect(screen.getByRole('tablist', { name: 'Orders view' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }))
    expect(view.writes).toEqual(['b'])
  })

  test('the tab strip is the pill look on the one line of the row, scrolling instead of wrapping', () => {
    const view = memoryHandle<string>('view', 'a', {
      kind: 'enum',
      options: [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ],
    })
    render(
      <Page>
        <PageBar tabs={{ state: view, label: 'Orders view' }} />
      </Page>,
    )
    const home = band()?.querySelector('[data-slot="page-bar-tabs"]')
    expect(home?.className).not.toContain('basis-full')
    expect(home?.parentElement?.className).toContain('flex-nowrap')
    expect(home?.querySelector('[data-slot="tabs"]')?.getAttribute('data-variant')).toBe('pill')
    for (const name of ['Alpha', 'Beta']) {
      expect(screen.getByRole('tab', { name }).className).not.toContain('@max-regular:flex-1')
    }
  })

  test('a handle in tabs makes the band non-empty on its own', () => {
    const view = memoryHandle<string>('view', 'a', {
      kind: 'enum',
      options: [{ value: 'a', label: 'Alpha' }],
    })
    render(
      <Page>
        <PageBar tabs={{ handle: view, label: 'View' }} />
      </Page>,
    )
    expect(band()).not.toBeNull()
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

describe('PageBar connection', () => {
  const view = { state: 'live', stream: 'live', online: true, reachable: true } as const

  test('draws the indicator before the refresh button, and a bar of only a connection still renders', () => {
    const { container } = render(
      <Page>
        <PageBar connection={view} refresh={{ scope: 'page', syncing: false, onSync: () => {} }} />
      </Page>,
    )
    const indicator = container.querySelector('[data-slot="connection-indicator"]')
    const refresh = container.querySelector('[data-scope]')
    expect(indicator).not.toBeNull()
    expect(
      indicator!.compareDocumentPosition(refresh!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    cleanup()
    const alone = render(
      <Page>
        <PageBar connection={view} />
      </Page>,
    )
    expect(alone.container.querySelector('[data-slot="page-bar"]')).not.toBeNull()
  })

  test('without the prop no indicator is drawn', () => {
    const { container } = render(
      <Page>
        <PageBar refresh={{ scope: 'page', syncing: false, onSync: () => {} }} />
      </Page>,
    )
    expect(container.querySelector('[data-slot="connection-indicator"]')).toBeNull()
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
    const button = screen.getByRole('button', { name: 'Refresh — Offline' })
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.getAttribute('title')).toBe('Offline')
    expect(button.getAttribute('data-scope')).toBe('global')
  })
})

describe('PageBar refresh age', () => {
  test('is the RefreshButton: the print line states when the data was taken', () => {
    render(
      <Page>
        <PageBar
          refresh={{ scope: 'page', syncing: false, onSync: () => {}, lastCompletedAt: Date.now() }}
        />
      </Page>,
    )
    expect(document.querySelector('[data-slot="refresh-button-age"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="refresh-button-print"]')).not.toBeNull()
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
    const groups = document.querySelectorAll('[data-slot="button-group"]')
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

  test('only the primary stays in the phone bar; the rest fold into the one overflow menu', () => {
    render(
      <Page>
        <PageBar actions={[action('a', { primary: true }), action('b'), action('c')]} />
      </Page>,
    )
    expect(document.querySelector('[data-action-id="a"]')!.className).not.toContain('hidden')
    expect(document.querySelector('[data-action-id="b"]')!.className).toContain('hidden')
    expect(document.querySelector('[data-action-id="c"]')!.className).toContain('hidden')
    expect(screen.getAllByRole('button', { name: 'More actions' })).toHaveLength(1)
  })

  test("an explicit mobile: 'bar' keeps a non-primary action in the phone bar", () => {
    render(
      <Page>
        <PageBar actions={[action('a', { primary: true }), action('b', { mobile: 'bar' })]} />
      </Page>,
    )
    expect(document.querySelector('[data-action-id="b"]')!.className).not.toContain('hidden')
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  test('there is no overflow menu when nothing folds', () => {
    render(
      <Page>
        <PageBar actions={[action('a', { primary: true })]} />
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

  test('beside a control the actions end the band, the view row, and claim nothing in the header', () => {
    const shell = fakeHost()
    inShell(shell.host, <PageBar controls={slotOf('Range')} actions={[action('new')]} />)
    expect(shell.of('actions')).toHaveLength(0)
    expect(band()?.querySelector('[data-action-id="new"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Range' })).toBeDefined()
  })

  test('with no control in the band the actions claim the header end, the identity row', () => {
    const shell = fakeHost()
    inShell(shell.host, <PageBar title="Runs" actions={[action('new')]} />)
    expect(shell.of('actions')).toHaveLength(1)
    expect(band()).toBeNull()
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

describe('PageBar view row', () => {
  const statusOf = () =>
    memoryHandle<string>('status', 'all', {
      kind: 'enum',
      options: [
        { value: 'all', label: 'All' },
        { value: 'overdue', label: 'Overdue' },
      ],
    })

  test('a tab carries its count and tone, and the count follows the value it is given', () => {
    const status = statusOf()
    const bar = (overdue: number) => (
      <Page>
        <PageBar
          tabs={{
            state: status,
            label: 'Invoices',
            badges: {
              all: { count: 236 },
              overdue: { count: overdue, attention: true, tone: 'bad' },
            },
          }}
        />
      </Page>
    )
    const { rerender } = render(bar(17))
    const overdue = screen.getByRole('tab', { name: 'Overdue 17' })
    const count = overdue.querySelector('[data-slot="tabs-trigger-count"]')!
    expect(count.hasAttribute('data-attention')).toBe(true)
    expect(count.className).toContain('text-bad')
    expect(overdue.querySelector('[data-slot="tabs-trigger-dot"]')?.className).toContain('bg-bad')
    expect(
      screen.getByRole('tab', { name: 'All 236' }).querySelector('[data-slot="tabs-trigger-count"]')
        ?.className,
    ).toContain('text-muted-foreground')
    rerender(bar(18))
    expect(screen.getByRole('tab', { name: 'Overdue 18' })).toBeDefined()
  })

  test('a page tab draws the badge a plain TabsTrigger draws', () => {
    const status = statusOf()
    const { container } = render(
      <Page>
        <PageBar
          tabs={{
            state: status,
            label: 'Invoices',
            badges: { overdue: { count: 7, attention: true, tone: 'bad' } },
          }}
        />
        <Tabs defaultValue="x">
          <TabsList aria-label="Plain">
            <TabsTrigger value="x" count={7} attention tone="bad">
              Overdue
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Page>,
    )
    const badge = (tab: Element): string[] =>
      [...tab.querySelectorAll('[data-slot^="tabs-trigger-"]')].map((el) => el.outerHTML)
    const tabs = [...container.querySelectorAll('[role="tab"]')]
    const inBar = tabs.find((el) => el.textContent === 'Overdue7')!
    const plain = tabs.find((el) => el !== inBar && el.textContent === 'Overdue7')!
    expect(badge(inBar)).toHaveLength(2)
    expect(badge(inBar)).toEqual(badge(plain))
  })

  test('a counted tab binds its handle: a click writes it, a write from outside selects it', () => {
    const status = statusOf()
    render(
      <Page>
        <PageBar tabs={{ state: status, label: 'Invoices', badges: { overdue: { count: 3 } } }} />
      </Page>,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Overdue 3' }))
    expect(status.writes).toEqual(['overdue'])
    act(() => {
      status.put('all')
    })
    expect(screen.getByRole('tab', { name: 'All' }).hasAttribute('data-active')).toBe(true)
  })

  test('the search writes as the reader types, an empty box unsets, a composition writes at its end', () => {
    const q = memoryHandle<string>('q', '', { kind: 'string' })
    render(
      <Page>
        <PageBar search={{ state: q, label: 'Search invoices' }} />
      </Page>,
    )
    const [box] = screen.getAllByRole('searchbox', { name: 'Search invoices' })
    fireEvent.change(box!, { target: { value: 'acme' } })
    expect(q.writes).toEqual(['acme'])
    fireEvent.change(box!, { target: { value: '' } })
    expect(q.clears.count).toBe(1)
    fireEvent.compositionEnd(box!, { target: { value: 'とう' } })
    expect(q.writes.at(-1)).toBe('とう')
    act(() => {
      q.put('from a link')
    })
    expect((box as HTMLInputElement).value).toBe('from a link')
  })

  test('a field that reports its value late keeps every typed character; an outside value still lands', () => {
    // A URL field reports a write a render or more after it: the store moves only on `put`.
    const q = memoryHandle<string>('q', '', { kind: 'string' })
    const sent: string[] = []
    const late = { ...q, use: () => [q.use()[0], (next: string) => sent.push(next)] as const }
    render(
      <Page>
        <PageBar search={{ state: late as never, label: 'Search' }} />
      </Page>,
    )
    const [box] = screen.getAllByRole('searchbox', { name: 'Search' }) as HTMLInputElement[]
    fireEvent.change(box!, { target: { value: 'a' } })
    fireEvent.change(box!, { target: { value: 'ab' } })
    expect(sent).toEqual(['a', 'ab'])
    act(() => {
      q.put('a')
    })
    expect(box!.value).toBe('ab')
    act(() => {
      q.put('ab')
    })
    expect(box!.value).toBe('ab')
    act(() => {
      q.put('from a link')
    })
    expect(box!.value).toBe('from a link')
  })

  test('below wide the search takes a line of its own under the sticky band; the inline one is hidden there', () => {
    const q = memoryHandle<string>('q', '', { kind: 'string' })
    render(
      <Page>
        <PageBar
          search={{ state: q, label: 'Search' }}
          tabs={{ state: statusOf(), label: 'Views' }}
        />
      </Page>,
    )
    const boxes = [...document.querySelectorAll('[data-slot="page-bar-search"]')]
    expect(boxes).toHaveLength(2)
    const row = band()!.querySelector('[data-slot="page-bar-row"]')!
    expect(row.contains(boxes[0]!)).toBe(true)
    expect(boxes[0]!.className).toContain('hidden')
    expect(boxes[0]!.className).toContain('@wide:block')
    expect(band()!.contains(boxes[1]!)).toBe(false)
    const line = boxes[1]!.closest('[data-slot="page-bar-search-line"]')!
    expect(line.className).toContain('@wide:hidden')
    expect(band()!.nextElementSibling).toBe(line)
  })

  test('the primary moves last with its segment, so two groups it parted never fuse', () => {
    const q = memoryHandle<string>('q', '', { kind: 'string' })
    render(
      <Page>
        <PageBar
          search={{ state: q, label: 'Search' }}
          actions={[
            { id: 'a', label: 'A', group: 'g', onClick: () => {} },
            { id: 'new', label: 'New', primary: true, onClick: () => {} },
            { id: 'b', label: 'B', group: 'g', onClick: () => {} },
          ]}
        />
      </Page>,
    )
    const ids = [...band()!.querySelectorAll('[data-action-id]')].map((el) =>
      el.getAttribute('data-action-id'),
    )
    expect(ids).toEqual(['a', 'b', 'new'])
    for (const id of ['a', 'b']) {
      const action = band()!.querySelector(`[data-action-id="${id}"]`)!
      expect(action.parentElement!.getAttribute('data-slot')).toBe('page-actions')
    }
  })

  test('a primary inside a group ends its group, and the group stays joined', () => {
    const q = memoryHandle<string>('q', '', { kind: 'string' })
    render(
      <Page>
        <PageBar
          search={{ state: q, label: 'Search' }}
          actions={[
            { id: 'new', label: 'New', primary: true, group: 'g', onClick: () => {} },
            { id: 'b', label: 'B', group: 'g', onClick: () => {} },
          ]}
        />
      </Page>,
    )
    const ids = [...band()!.querySelectorAll('[data-action-id]')].map((el) =>
      el.getAttribute('data-action-id'),
    )
    expect(ids).toEqual(['b', 'new'])
    const parent = band()!.querySelector('[data-action-id="b"]')!.parentElement
    expect(parent).toBe(band()!.querySelector('[data-action-id="new"]')!.parentElement)
    expect(parent!.getAttribute('data-slot')).not.toBe('page-actions')
  })

  test('the end holds search, controls, layout, settings, then the actions with the primary last', () => {
    const layout = memoryHandle<string>('layout', 'table', { kind: 'enum' })
    const opened: string[] = []
    const Icon = () => <svg aria-hidden="true" />
    render(
      <Page>
        <PageBar
          search={{ state: memoryHandle<string>('q', '', { kind: 'string' }), label: 'Search' }}
          controls={slotOf('Range')}
          layout={{
            state: layout,
            label: 'Layout',
            options: [
              { value: 'table', label: 'Table', icon: Icon },
              { value: 'cards', label: 'Cards', icon: Icon },
            ],
          }}
          settings={{ label: 'View settings', onClick: () => opened.push('settings') }}
          actions={[action('new', { primary: true }), action('export')]}
        />
      </Page>,
    )
    const end = band()!.querySelector('[data-slot="page-bar-end"]')!
    const order = [...end.children].map(
      (el) =>
        el.getAttribute('data-slot') ?? el.getAttribute('aria-label') ?? el.tagName.toLowerCase(),
    )
    expect(order).toEqual([
      'page-bar-search',
      'page-bar-controls',
      'page-bar-layout',
      'button',
      'page-actions',
    ])
    const ids = [...end.querySelectorAll('[data-action-id]')].map((el) =>
      el.getAttribute('data-action-id'),
    )
    expect(ids).toEqual(['export', 'new'])
    fireEvent.click(screen.getByRole('button', { name: 'View settings' }))
    expect(opened).toEqual(['settings'])
  })
})

describe('PageBar identity', () => {
  const identity = {
    avatar: { shape: 'object' as const },
    subtitle: 'Hamburg, DE',
    tags: <span>Preferred</span>,
  }
  const view = () =>
    memoryHandle<string>('view', 'a', {
      kind: 'enum',
      options: [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ],
    })

  test('without a shell the title is one heading with its face, subtitle and tag, in the band', () => {
    render(
      <Page>
        <PageBar title="Acme" identity={identity} />
      </Page>,
    )
    const h1 = screen.getByRole('heading', { level: 1, name: 'Acme' })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const title = h1.closest('[data-slot="entity-title"]')!
    expect(band()?.contains(title)).toBe(true)
    expect(title.textContent).toContain('Hamburg, DE')
    expect(title.textContent).toContain('Preferred')
    expect(title.querySelector('[role="img"]')).not.toBeNull()
  })

  test('a title alone with an identity still draws the band, and a title with none does not change', () => {
    const { rerender } = render(
      <Page>
        <PageBar title="Acme" identity={identity} />
      </Page>,
    )
    expect(band()).not.toBeNull()
    rerender(
      <Page>
        <PageBar title="Acme" />
      </Page>,
    )
    expect(document.querySelector('[data-slot="entity-title"]')).toBeNull()
  })

  test('in a shell the visible h1 is the identity and the breadcrumb leaf is kept', () => {
    const shell = fakeHost()
    render(
      <PageHostContext value={shell.host}>
        <Page>
          <PageBar title="Acme" identity={identity} />
        </Page>
      </PageHostContext>,
    )
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]!.classList.contains('sr-only')).toBe(false)
    expect(band()?.contains(headings[0]!)).toBe(true)
    expect(shell.of('breadcrumb')).toHaveLength(1)
    expect(document.title).toBe('Acme')
  })

  test('the tabs take their own line under the identity row', () => {
    render(
      <Page>
        <PageBar
          title="Acme"
          identity={identity}
          tabs={{ state: view(), label: 'Supplier' }}
          actions={[action('edit', { primary: true })]}
        />
      </Page>,
    )
    const row = band()!.querySelector('[data-slot="page-bar-row"]')!
    const tabsRow = band()!.querySelector('[data-slot="page-bar-tabs-row"]')!
    expect(row.querySelector('[data-slot="page-bar-tabs"]')).toBeNull()
    expect(tabsRow.querySelector('[data-slot="page-bar-tabs"]')).not.toBeNull()
    expect(row.querySelector('[data-action-id="edit"]')).not.toBeNull()
    expect(band()?.classList.contains('sticky')).toBe(true)
  })

  test('without an identity the tabs stay in the row', () => {
    render(
      <Page>
        <PageBar title="Acme" tabs={{ state: view(), label: 'Supplier' }} />
      </Page>,
    )
    expect(band()!.querySelector('[data-slot="page-bar-tabs-row"]')).toBeNull()
    expect(
      band()!.querySelector('[data-slot="page-bar-row"] [data-slot="page-bar-tabs"]'),
    ).not.toBeNull()
  })

  test('an identity without a title draws nothing', () => {
    render(
      <Page>
        <PageBar identity={identity} />
      </Page>,
    )
    expect(document.querySelector('[data-slot="entity-title"]')).toBeNull()
    expect(band()).toBeNull()
  })
})
