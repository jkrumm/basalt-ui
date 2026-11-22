/**
 * `defineOverlays` and `OverlayHost`: typed keys, one stack, dialog or sheet, open-before-mount,
 * and no base-ui import in the two modules (they sit on `ui/dialog` and `ui/sheet`).
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToString } from 'react-dom/server'
import { defineOverlays } from './define-overlays'
import { OverlayHost } from './overlay-host'

afterEach(cleanup)

// Base UI waits for `getAnimations()` to settle before it unmounts a closing popup, and happy-dom
// has no animation clock: each close took 3 to 22 s. Its own switch unmounts at once, so a closed
// overlay is gone on the next commit with no timer to fake. Scoped to this file: other suites
// (a menu clicked item after item) rely on the exit staying mounted.
beforeAll(() => {
  Object.assign(globalThis, { BASE_UI_ANIMATIONS_DISABLED: true })
})
afterAll(() => {
  Reflect.deleteProperty(globalThis, 'BASE_UI_ANIMATIONS_DISABLED')
})

function make() {
  return defineOverlays({
    'user:edit': {
      title: 'Edit user',
      description: 'Shown to the team.',
      render: (p: { id: string }) => <p data-testid="edit">editing {p.id}</p>,
    },
    'logs:filter': {
      title: 'Filter logs',
      as: 'sheet',
      render: () => <p data-testid="logs">filters</p>,
    },
    'viewer:wide': { title: 'Viewer', size: 'wide', render: () => <p>doc</p> },
    'wizard:split': { title: 'Wizard', size: 'split', render: () => <p>steps</p> },
    'confirm:wide': {
      title: 'Wide',
      size: 'lg',
      render: (_: { n: number }, api) => (
        <button type="button" data-testid="close-me" onClick={api.close}>
          done
        </button>
      ),
    },
  })
}

describe('defineOverlays + OverlayHost', () => {
  test('open renders a dialog named by the title, with its payload', () => {
    const overlays = make()
    render(<OverlayHost overlays={overlays} />)
    act(() => overlays.open('user:edit', { id: '42' }))
    expect(screen.getByRole('dialog', { name: 'Edit user' })).toBeDefined()
    expect(screen.getByTestId('edit').textContent).toBe('editing 42')
    expect(screen.getByText('Shown to the team.')).toBeDefined()
  })

  test('a sheet overlay renders a sheet, not a dialog', () => {
    const overlays = make()
    render(<OverlayHost overlays={overlays} />)
    act(() => overlays.open('logs:filter'))
    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull()
  })

  test('size reaches the dialog panel', () => {
    const overlays = make()
    render(<OverlayHost overlays={overlays} />)
    act(() => overlays.open('confirm:wide', { n: 1 }))
    expect(document.querySelector('[data-slot="dialog-content"]')?.className).toContain('max-w-2xl')
  })

  test('the wide and split sizes reach the dialog panel', () => {
    const overlays = make()
    render(<OverlayHost overlays={overlays} />)
    act(() => overlays.open('viewer:wide'))
    expect(document.querySelector('[data-slot="dialog-content"]')?.className).toContain('max-w-5xl')
    act(() => overlays.close())
    act(() => overlays.open('wizard:split'))
    const panel = [...document.querySelectorAll('[data-slot="dialog-content"]')].at(-1)
    expect(panel?.className).toContain('max-w-275')
    expect(panel?.querySelector('header')).toBeNull()
  })

  test('opening before the host mounts keeps the entry until it does', () => {
    const overlays = make()
    overlays.open('user:edit', { id: '7' })
    render(<OverlayHost overlays={overlays} />)
    expect(screen.getByTestId('edit').textContent).toBe('editing 7')
  })

  test('the stack holds several overlays', () => {
    const overlays = make()
    render(<OverlayHost overlays={overlays} />)
    act(() => {
      overlays.open('user:edit', { id: '1' })
      overlays.open('logs:filter')
    })
    expect(screen.getByTestId('edit')).toBeDefined()
    expect(screen.getByTestId('logs')).toBeDefined()
  })

  test('close() closes the top overlay only', async () => {
    const overlays = make()
    render(<OverlayHost overlays={overlays} />)
    act(() => {
      overlays.open('user:edit', { id: '1' })
      overlays.open('logs:filter')
    })
    act(() => overlays.close())
    await waitFor(() => expect(screen.queryByTestId('logs')).toBeNull())
    expect(screen.getByTestId('edit')).toBeDefined()
  })

  test('close({ all: true }) closes the whole stack', async () => {
    const overlays = make()
    render(<OverlayHost overlays={overlays} />)
    act(() => {
      overlays.open('user:edit', { id: '1' })
      overlays.open('logs:filter')
    })
    act(() => overlays.close({ all: true }))
    await waitFor(() => expect(screen.queryByTestId('logs')).toBeNull())
    await waitFor(() => expect(screen.queryByTestId('edit')).toBeNull())
  })

  test('the body closes itself through the api', async () => {
    const overlays = make()
    render(<OverlayHost overlays={overlays} />)
    act(() => overlays.open('confirm:wide', { n: 1 }))
    act(() => screen.getByTestId('close-me').click())
    await waitFor(() => expect(screen.queryByTestId('close-me')).toBeNull())
  })

  test('the corner close button dismisses', async () => {
    const overlays = make()
    render(<OverlayHost overlays={overlays} />)
    act(() => overlays.open('user:edit', { id: '1' }))
    act(() => document.querySelector<HTMLElement>('[data-slot="dialog-close"]')?.click())
    await waitFor(() => expect(screen.queryByTestId('edit')).toBeNull())
  })

  test('defaultOpen opens an overlay from the first client render', () => {
    const overlays = make()
    render(
      <OverlayHost overlays={overlays} defaultOpen={{ key: 'user:edit', props: { id: '9' } }} />,
    )
    expect(screen.getByTestId('edit').textContent).toBe('editing 9')
  })

  test('two registries do not share a stack', () => {
    const a = make()
    const b = make()
    render(<OverlayHost overlays={b} />)
    act(() => a.open('user:edit', { id: '1' }))
    expect(screen.queryByTestId('edit')).toBeNull()
  })

  test('an unknown key at runtime warns and opens nothing', () => {
    const overlays = make()
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    render(<OverlayHost overlays={overlays} />)
    // @ts-expect-error -- the compile error is the point; the runtime guard backs a cast
    act(() => overlays.open('nope', {}))
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  test('the host renders nothing on the server', () => {
    const overlays = make()
    overlays.open('user:edit', { id: '1' })
    expect(renderToString(<OverlayHost overlays={overlays} />)).toBe('')
  })

  test('a host given an object defineOverlays did not return throws, naming it', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    // @ts-expect-error -- not a registry
    expect(() => render(<OverlayHost overlays={{ open: () => {}, close: () => {} }} />)).toThrow(
      /defineOverlays/,
    )
    spy.mockRestore()
  })
})

describe('the overlay modules sit on the primitives', () => {
  const read = (name: string): string => readFileSync(join(import.meta.dirname, name), 'utf8')
  for (const file of ['define-overlays.ts', 'overlay-host.tsx']) {
    test(`${file} imports no @base-ui/react`, () => {
      expect(read(file)).not.toMatch(/from '@base-ui\/react/)
    })
  }

  test('overlay-host composes ui/dialog and ui/sheet', () => {
    const src = read('overlay-host.tsx')
    expect(src).toContain("'../ui/dialog'")
    expect(src).toContain("'../ui/sheet'")
  })
})
