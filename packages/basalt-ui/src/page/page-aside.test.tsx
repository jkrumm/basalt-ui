/**
 * `PageAside`: the second surface, in a shell and not. Ported from the 2.x suites
 * (`src/shell/page-aside.test.tsx` 32 and `page-aside.module.css.test.ts` 3, executed on master) to
 * the v3 contract: a column from the `wide` container tier, a `Sheet` below it, a claim on the
 * shell's aside region, newest-claim ownership, the `DetailHost`. Geometry is
 * `tests/layout/page-core.layout.test.ts`'s.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { useContext, useEffect, useState } from 'react'
import { renderToString } from 'react-dom/server'
import type { ControlHandle, DetailHost } from '../core/ports'
import type { ClaimSnapshot } from './core/claims'
import { DetailHostContext, Page, PageContext, PageHostContext } from './page'
import { PageAside, PageAsidePanel } from './page-aside'
import {
  fakeHost,
  installLayoutDoubles,
  resizeTo,
  restoreLayoutDoubles,
  setWidth,
} from './page.test-support'

beforeEach(installLayoutDoubles)
afterEach(() => {
  cleanup()
  restoreLayoutDoubles()
})

const WIDE = 1440
const NARROW = 390

const aside = (): HTMLElement | null => document.querySelector('[data-slot="page-aside"]')
const trigger = (): HTMLElement | null => document.querySelector('[data-aside-trigger]')

/** A boolean `ControlHandle` over local state, with the setter observable. */
function handle(initial: boolean) {
  const sets: boolean[] = []
  let value = initial
  const bound: ControlHandle<boolean> = {
    key: 'inspector',
    kind: 'boolean',
    use: () => {
      const [v, setV] = useState(value)
      return [
        v,
        (next) => {
          value = next
          sets.push(next)
          setV(next)
        },
      ]
    },
    useSource: () => ({ source: 'own', inherited: undefined }),
    clear: () => {},
    isDefault: false,
  }
  return { bound, sets }
}

describe('PageAside as a column (the page is at least wide)', () => {
  test('portals into the page column as a named landmark with the title as header', () => {
    setWidth(WIDE)
    const { container } = render(
      <Page>
        <PageAside title="Run details">facts</PageAside>
      </Page>,
    )
    const el = aside()!
    expect(container.querySelector('[data-slot="page-aside-slot"]')?.contains(el)).toBe(true)
    expect(screen.getByRole('complementary', { name: 'Run details' })).toBe(el)
    expect(el.querySelector('h2')?.textContent).toBe('Run details')
    expect(el.textContent).toContain('facts')
  })

  test('the default width is 360 and the width prop moves it', () => {
    setWidth(WIDE)
    const { rerender } = render(
      <Page>
        <PageAside title="A">x</PageAside>
      </Page>,
    )
    expect(aside()!.style.getPropertyValue('--page-aside-w')).toBe('360px')
    rerender(
      <Page>
        <PageAside title="A" width={480}>
          x
        </PageAside>
      </Page>,
    )
    expect(aside()!.style.getPropertyValue('--page-aside-w')).toBe('480px')
  })

  test('dock defaults to auto and passes always through', () => {
    setWidth(WIDE)
    const { rerender } = render(
      <Page>
        <PageAside title="A">x</PageAside>
      </Page>,
    )
    expect(aside()!.getAttribute('data-dock')).toBe('auto')
    rerender(
      <Page>
        <PageAside title="A" dock="always">
          x
        </PageAside>
      </Page>,
    )
    expect(aside()!.getAttribute('data-dock')).toBe('always')
  })

  test('is open by default and has no close button without state', () => {
    setWidth(WIDE)
    render(
      <Page>
        <PageAside title="A">x</PageAside>
      </Page>,
    )
    expect(aside()).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Close panel' })).toBeNull()
  })

  test('state true shows it and the close button writes false through the handle', () => {
    setWidth(WIDE)
    const { bound, sets } = handle(true)
    render(
      <Page>
        <PageAside title="A" state={bound}>
          x
        </PageAside>
      </Page>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(sets).toEqual([false])
    expect(aside()).toBeNull()
  })

  test('state false renders no column content and no ghost', () => {
    setWidth(WIDE)
    const { bound } = handle(false)
    const { container } = render(
      <Page>
        <PageAside title="A" state={bound}>
          x
        </PageAside>
      </Page>,
    )
    expect(aside()).toBeNull()
    expect(container.querySelector('[data-slot="page-aside-slot"]')?.childElementCount).toBe(0)
  })

  test('the body scrolls in the ScrollArea primitive, not a raw overflow box', () => {
    setWidth(WIDE)
    render(
      <Page>
        <PageAside title="A">x</PageAside>
      </Page>,
    )
    expect(aside()!.querySelector('[data-slot="scroll-area"]')).not.toBeNull()
  })

  test('children mount exactly once', () => {
    setWidth(WIDE)
    let mounts = 0
    function Child() {
      useEffect(() => {
        mounts += 1
      }, [])
      return <span>child</span>
    }
    render(
      <Page>
        <PageAside title="A">
          <Child />
        </PageAside>
      </Page>,
    )
    expect(mounts).toBe(1)
  })

  test('unmounting removes the column content', () => {
    setWidth(WIDE)
    const { rerender } = render(
      <Page>
        <PageAside title="A">x</PageAside>
      </Page>,
    )
    rerender(<Page />)
    expect(aside()).toBeNull()
  })
})

describe('PageAside as a sheet (the page is narrower than wide)', () => {
  test('renders no column, only a trigger named by the title; the body is not mounted', () => {
    setWidth(NARROW)
    let mounts = 0
    function Child() {
      useEffect(() => {
        mounts += 1
      }, [])
      return <span>child</span>
    }
    render(
      <Page>
        <PageAside title="Run details">
          <Child />
        </PageAside>
      </Page>,
    )
    expect(aside()).toBeNull()
    expect(trigger()?.textContent).toBe('Run details')
    expect(mounts).toBe(0)
  })

  test('the trigger opens the same content in a sheet named by the title', () => {
    setWidth(NARROW)
    render(
      <Page>
        <PageAside title="Run details">
          <p>facts</p>
        </PageAside>
      </Page>,
    )
    fireEvent.click(trigger()!)
    expect(screen.getByRole('dialog', { name: 'Run details' })).toBeDefined()
    expect(screen.getAllByText('facts')).toHaveLength(1)
  })

  test('state true opens the sheet and its dismissal writes false', () => {
    setWidth(NARROW)
    const { bound, sets } = handle(true)
    render(
      <Page>
        <PageAside title="A" state={bound}>
          <p>facts</p>
        </PageAside>
      </Page>,
    )
    expect(screen.getByRole('dialog', { name: 'A' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(sets).toContain(false)
  })

  test('crossing the wide tier moves the content between the sheet trigger and the column', () => {
    setWidth(NARROW)
    const { container } = render(
      <Page>
        <PageAside title="A">
          <p>facts</p>
        </PageAside>
      </Page>,
    )
    expect(aside()).toBeNull()
    expect(trigger()).not.toBeNull()
    resizeTo(WIDE)
    expect(container.querySelector('[data-slot="page-aside-slot"]')?.contains(aside())).toBe(true)
    expect(trigger()).toBeNull()
    resizeTo(NARROW)
    expect(aside()).toBeNull()
    expect(trigger()).not.toBeNull()
  })

  test('renders on the server as the narrow form: a trigger, no aside element', () => {
    const html = renderToString(
      <Page>
        <PageAside title="Run details">
          <p>facts</p>
        </PageAside>
      </Page>,
    )
    expect(html).toContain('data-aside-trigger')
    expect(html).not.toContain('data-slot="page-aside"')
    expect(html).not.toContain('facts')
  })
})

describe('PageAside outside a Page', () => {
  test('renders in flow, open, with no column to measure', () => {
    const { container } = render(<PageAside title="Loose">x</PageAside>)
    expect(container.querySelector('[data-slot="page-aside"]')).not.toBeNull()
    expect(trigger()).toBeNull()
  })
})

describe('PageAside in a shell (PageHost)', () => {
  const inShell = (host: ReturnType<typeof fakeHost>['host'], children: React.ReactNode) =>
    render(
      <PageHostContext value={host}>
        <Page>{children}</Page>
      </PageHostContext>,
    )

  test('claims the aside region and renders nothing in place, whatever the width', () => {
    const shell = fakeHost()
    setWidth(NARROW)
    inShell(shell.host, <PageAside title="Run details">facts</PageAside>)
    expect(shell.of('aside')).toHaveLength(1)
    expect(aside()).toBeNull()
    expect(trigger()).toBeNull()
  })

  test('the claimed element carries title, width and dock for the shell to read', () => {
    const shell = fakeHost()
    inShell(
      shell.host,
      <PageAside title="Run details" width={480} dock="always">
        facts
      </PageAside>,
    )
    const element = shell.of('aside')[0]!.node as React.ReactElement<{
      title: string
      width: number
      dock: string
    }>
    expect(element.type).toBe(PageAsidePanel)
    expect(element.props.title).toBe('Run details')
    expect(element.props.width).toBe(480)
    expect(element.props.dock).toBe('always')
  })

  test('releases the claim on unmount, leaving the region unclaimed', () => {
    const shell = fakeHost()
    const { rerender } = inShell(shell.host, <PageAside title="A">x</PageAside>)
    rerender(
      <PageHostContext value={shell.host}>
        <Page />
      </PageHostContext>,
    )
    expect(shell.of('aside')).toHaveLength(0)
  })

  test('a closed aside holds no claim', () => {
    const shell = fakeHost()
    const { bound } = handle(false)
    inShell(
      shell.host,
      <PageAside title="A" state={bound}>
        x
      </PageAside>,
    )
    expect(shell.of('aside')).toHaveLength(0)
  })

  test('a title change re-claims with the new title and never leaves two claims', () => {
    const shell = fakeHost()
    const { rerender } = inShell(shell.host, <PageAside title="A">x</PageAside>)
    rerender(
      <PageHostContext value={shell.host}>
        <Page>
          <PageAside title="B">x</PageAside>
        </Page>
      </PageHostContext>,
    )
    const claims = shell.of('aside')
    expect(claims).toHaveLength(1)
    expect((claims[0]!.node as React.ReactElement<{ title: string }>).props.title).toBe('B')
  })
})

describe('PageAsidePanel', () => {
  test('is sticky, full viewport height and bounded by the width variable', () => {
    render(
      <PageAsidePanel title="A" width={320} dock="auto">
        x
      </PageAsidePanel>,
    )
    const cls = aside()!.className
    expect(cls).toContain('sticky')
    expect(cls).toContain('h-dvh')
    expect(cls).toContain('w-(--page-aside-w)')
  })

  test('draws a seam on its inline-start edge only', () => {
    render(
      <PageAsidePanel title="A" width={320} dock="auto">
        x
      </PageAsidePanel>,
    )
    expect(aside()!.className).toContain('border-s')
  })

  test('the close button appears only with a handler and calls it', () => {
    const calls: string[] = []
    const { rerender } = render(
      <PageAsidePanel title="A" width={320} dock="auto">
        x
      </PageAsidePanel>,
    )
    expect(screen.queryByRole('button', { name: 'Close panel' })).toBeNull()
    rerender(
      <PageAsidePanel title="A" width={320} dock="auto" onClose={() => calls.push('close')}>
        x
      </PageAsidePanel>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(calls).toEqual(['close'])
  })
})

function ClaimProbe({ onRead }: { onRead: (read: () => ClaimSnapshot<boolean>) => void }) {
  const context = useContext(PageContext)
  onRead(() => context!.asides.getSnapshot())
  return null
}

describe('PageAside claim ownership (two claimants)', () => {
  test('a second aside warns once, the newest owns the region and the older renders nothing', () => {
    setWidth(WIDE)
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render(
        <Page>
          <PageAside title="First">one</PageAside>
          <PageAside title="Second">two</PageAside>
        </Page>,
      )
      expect(document.querySelectorAll('[data-slot="page-aside"]')).toHaveLength(1)
      expect(aside()!.getAttribute('aria-label')).toBe('Second')
      const calls = warn.mock.calls.filter((c) => String(c[0]).includes('more than one PageAside'))
      expect(calls).toHaveLength(1)
    } finally {
      warn.mockRestore()
    }
  })

  test('a single aside does not warn', () => {
    setWidth(WIDE)
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render(
        <Page>
          <PageAside title="Only">x</PageAside>
        </Page>,
      )
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  test('the owner leaving hands the region back to the older aside', () => {
    setWidth(WIDE)
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { rerender } = render(
        <Page>
          <PageAside key="a" title="First">
            one
          </PageAside>
          <PageAside key="b" title="Second">
            two
          </PageAside>
        </Page>,
      )
      rerender(
        <Page>
          <PageAside key="a" title="First">
            one
          </PageAside>
        </Page>,
      )
      expect(aside()!.getAttribute('aria-label')).toBe('First')
    } finally {
      warn.mockRestore()
    }
  })

  test('an older aside leaving keeps the owner', () => {
    setWidth(WIDE)
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { rerender } = render(
        <Page>
          <PageAside key="a" title="First">
            one
          </PageAside>
          <PageAside key="b" title="Second">
            two
          </PageAside>
        </Page>,
      )
      rerender(
        <Page>
          <PageAside key="b" title="Second">
            two
          </PageAside>
        </Page>,
      )
      expect(aside()!.getAttribute('aria-label')).toBe('Second')
    } finally {
      warn.mockRestore()
    }
  })

  test('the claim publishes the fold: closed is folded, open is not', () => {
    setWidth(WIDE)
    let read: () => ClaimSnapshot<boolean> = () => {
      throw new Error('probe did not render')
    }
    const { bound } = handle(true)
    render(
      <Page>
        <ClaimProbe onRead={(r) => (read = r)} />
        <PageAside title="A" state={bound}>
          x
        </PageAside>
      </Page>,
    )
    expect(read().owner?.value).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(read().owner?.value).toBe(true)
  })

  test('a released aside leaves no claim behind', () => {
    setWidth(WIDE)
    let read: () => ClaimSnapshot<boolean> = () => {
      throw new Error('probe did not render')
    }
    const { rerender } = render(
      <Page>
        <ClaimProbe onRead={(r) => (read = r)} />
        <PageAside title="A">x</PageAside>
      </Page>,
    )
    expect(read().count).toBe(1)
    rerender(
      <Page>
        <ClaimProbe onRead={(r) => (read = r)} />
      </Page>,
    )
    expect(read().count).toBe(0)
  })
})

describe('PageAside as the DetailHost', () => {
  test('show() on a closed aside opens it with the entry title, and closing returns to closed', () => {
    setWidth(WIDE)
    const { bound } = handle(false)
    const seen: { host: DetailHost | null } = { host: null }
    function Reader({ onRead }: { onRead: (host: DetailHost | null) => void }) {
      onRead(useContext(DetailHostContext))
      return null
    }
    render(
      <Page>
        <Reader onRead={(h) => (seen.host = h)} />
        <PageAside title="A" state={bound}>
          own
        </PageAside>
      </Page>,
    )
    act(() => seen.host!.show({ title: 'Run 7', body: () => <p>seven</p> }))
    expect(screen.getByLabelText('Run 7').textContent).toContain('seven')
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(aside()).toBeNull()
  })
})

describe('PageAside extra rows', () => {
  test("mobile='sheet' is the narrow form and changes nothing in the column", () => {
    setWidth(NARROW)
    const { unmount } = render(
      <Page>
        <PageAside title="A" mobile="sheet">
          x
        </PageAside>
      </Page>,
    )
    expect(trigger()).not.toBeNull()
    unmount()
    setWidth(WIDE)
    render(
      <Page>
        <PageAside title="A" mobile="sheet">
          x
        </PageAside>
      </Page>,
    )
    expect(aside()).not.toBeNull()
    expect(trigger()).toBeNull()
  })

  test('the header is one h2 and the landmark is not named twice', () => {
    setWidth(WIDE)
    render(
      <Page>
        <PageAside title="Run details">x</PageAside>
      </Page>,
    )
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
    expect(screen.getAllByRole('complementary')).toHaveLength(1)
  })

  test('adds no h1: the page keeps exactly one', () => {
    setWidth(WIDE)
    render(
      <Page>
        <PageAside title="A">x</PageAside>
      </Page>,
    )
    expect(document.querySelectorAll('h1')).toHaveLength(0)
  })

  test('the body of a shown detail is handed a fill box', () => {
    setWidth(WIDE)
    const boxes: unknown[] = []
    const seen: { host: DetailHost | null } = { host: null }
    function Reader({ onRead }: { onRead: (host: DetailHost | null) => void }) {
      onRead(useContext(DetailHostContext))
      return null
    }
    render(
      <Page>
        <Reader onRead={(h) => (seen.host = h)} />
        <PageAside title="A">own</PageAside>
      </Page>,
    )
    act(() =>
      seen.host!.show({
        title: 'Run 7',
        body: (box) => {
          boxes.push(box)
          return <p>seven</p>
        },
      }),
    )
    expect(boxes[0]).toEqual({ height: 'fill', phase: 'ready' })
  })

  test('hide() on a closed aside removes it again', () => {
    setWidth(WIDE)
    const { bound } = handle(false)
    const seen: { host: DetailHost | null } = { host: null }
    function Reader({ onRead }: { onRead: (host: DetailHost | null) => void }) {
      onRead(useContext(DetailHostContext))
      return null
    }
    render(
      <Page>
        <Reader onRead={(h) => (seen.host = h)} />
        <PageAside title="A" state={bound}>
          own
        </PageAside>
      </Page>,
    )
    act(() => seen.host!.show({ title: 'Run 7', body: () => <p>seven</p> }))
    expect(aside()).not.toBeNull()
    act(() => seen.host!.hide())
    expect(aside()).toBeNull()
  })

  test('in a shell a shown detail re-claims with the entry title', () => {
    const shell = fakeHost()
    const seen: { host: DetailHost | null } = { host: null }
    function Reader({ onRead }: { onRead: (host: DetailHost | null) => void }) {
      onRead(useContext(DetailHostContext))
      return null
    }
    render(
      <PageHostContext value={shell.host}>
        <Page>
          <Reader onRead={(h) => (seen.host = h)} />
          <PageAside title="A">own</PageAside>
        </Page>
      </PageHostContext>,
    )
    act(() => seen.host!.show({ title: 'Run 7', body: () => <p>seven</p> }))
    const claims = shell.of('aside')
    expect(claims).toHaveLength(1)
    expect((claims[0]!.node as React.ReactElement<{ title: string }>).props.title).toBe('Run 7')
  })

  test('in a shell the claimed width defaults to 360 and dock to auto', () => {
    const shell = fakeHost()
    render(
      <PageHostContext value={shell.host}>
        <Page>
          <PageAside title="A">x</PageAside>
        </Page>
      </PageHostContext>,
    )
    const props = (
      shell.of('aside')[0]!.node as React.ReactElement<{ width: number; dock: string }>
    ).props
    expect(props.width).toBe(360)
    expect(props.dock).toBe('auto')
  })

  test('an aside outside a Page has no close button and no sheet trigger', () => {
    render(<PageAside title="Loose">x</PageAside>)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
