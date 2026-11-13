/**
 * `ConnectionIndicator`: the word and glyph per state, the popover rows, the live region. Geometry
 * (the sr-only word below 840 px, the 44 px hit, axe) is `live-connection.layout.test.ts`'s.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ConnectionView } from '../core/ports'
import { ConnectionIndicator } from './connection-indicator'

afterEach(cleanup)

const view = (patch: Partial<ConnectionView> = {}): ConnectionView => ({
  state: 'polling',
  stream: 'none',
  online: true,
  reachable: true,
  ...patch,
})

const glyph = () => document.querySelector('[data-glyph]')?.getAttribute('data-glyph')
const trigger = () => document.querySelector('[data-trigger]') as HTMLElement

describe('state', () => {
  test.each([
    [{ state: 'live', stream: 'live' }, 'Live', 'dot'],
    [{ state: 'polling', stream: 'none' }, 'Polling', 'ring'],
    [{ state: 'polling', stream: 'retrying' }, 'Reconnecting', 'dashed'],
    [{ state: 'offline', reachable: false }, 'Offline', 'slash'],
    [{ state: 'polling', stream: 'unauthorized' }, 'Signed out', 'bang'],
  ] as const)('%j reads "%s" with the %s glyph', (patch, word, shape) => {
    render(<ConnectionIndicator connection={view(patch)} />)
    expect(trigger().textContent).toBe(word)
    expect(glyph()).toBe(shape)
  })

  test('offline outranks a stream that still says live', () => {
    render(<ConnectionIndicator connection={view({ state: 'offline', stream: 'live' })} />)
    expect(trigger().textContent).toBe('Offline')
  })

  test('every state has its own glyph', () => {
    const shapes = (
      [{ state: 'live', stream: 'live' }, { state: 'polling' }, { state: 'offline' }] as const
    ).map((patch) => {
      const { container, unmount } = render(<ConnectionIndicator connection={view(patch)} />)
      const shape = container.querySelector('[data-glyph]')?.getAttribute('data-glyph')
      unmount()
      return shape
    })
    expect(new Set(shapes).size).toBe(3)
  })

  test('the word is read by assistive tech below 840 px and printed nowhere', () => {
    render(<ConnectionIndicator connection={view()} />)
    expect(trigger().querySelector('span')?.className).toContain('max-md:sr-only')
    expect(document.querySelector('[data-slot="connection-indicator"]')?.className).toContain(
      'print:hidden',
    )
  })
})

describe('live region', () => {
  test('a polite status carries the word and changes only with the state', () => {
    const { rerender } = render(
      <ConnectionIndicator connection={view({ state: 'live', stream: 'live' })} />,
    )
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('Live')
    rerender(
      <ConnectionIndicator connection={view({ state: 'live', stream: 'live', lastFrameAt: 5 })} />,
    )
    expect(screen.getByRole('status').textContent).toBe('Live')
    rerender(<ConnectionIndicator connection={view({ state: 'offline' })} />)
    expect(screen.getByRole('status').textContent).toBe('Offline')
  })
})

describe('popover', () => {
  test('lists the stream, the last event and the data age, with a name', async () => {
    render(
      <ConnectionIndicator
        connection={view({
          state: 'live',
          stream: 'live',
          lastFrameAt: Date.now() - 2 * 60_000,
          lastUpdatedAt: Date.now() - 5 * 60_000,
        })}
      />,
    )
    await act(async () => void fireEvent.click(trigger()))
    const detail = document.querySelector('[data-slot="connection-indicator-detail"]')
    expect(detail?.textContent).toContain('StreamConnected')
    expect(detail?.textContent).toContain('Last event2 minutes ago')
    expect(detail?.textContent).toContain('Data5 minutes ago')
    expect(screen.getByRole('dialog', { name: 'Connection' })).toBeDefined()
  })

  test('an age that does not exist yet reads "None yet"', async () => {
    render(<ConnectionIndicator connection={view()} />)
    await act(async () => void fireEvent.click(trigger()))
    const detail = document.querySelector('[data-slot="connection-indicator-detail"]')
    expect(detail?.textContent).toContain('None yet')
  })

  test('renders closed on the server, with no detail', () => {
    const html = renderToStaticMarkup(<ConnectionIndicator connection={view()} />)
    expect(html).not.toContain('connection-indicator-detail')
  })
})
