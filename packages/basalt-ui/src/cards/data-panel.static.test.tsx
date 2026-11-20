/**
 * `DataPanel` draws one picture on the server and in the browser: the height a phone gives the
 * panel is CSS (a container query on the panel), never a width measured after mount.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { DataPanel } from './data-panel'

afterEach(cleanup)

const list = () => (
  <ul>
    <li>one</li>
  </ul>
)

describe('DataPanel: the server HTML is the final layout', () => {
  test('a loading rows frame floors its height on a phone by CSS: a custom property and a container variant', () => {
    const html = renderToString(
      <DataPanel title="Open tasks" phase="loading" bodySize={{ rows: 6 }} body={list} />,
    )
    // the five data rows, one tallest card each
    expect(html).toContain('--panel-cards:540px')
    expect(html).toContain('@max-regular:min-h-(--panel-cards)')
    expect(html).toContain('height:calc(6 * var(--basalt-row-h, 2rem))')
  })

  test('the loading skeleton folds to cards by container query, one markup for both widths', () => {
    const html = renderToString(
      <DataPanel title="Open tasks" phase="loading" bodySize={{ rows: 3 }} body={list} />,
    )
    const bars = html.match(/@max-regular:flex-1/g) ?? []
    expect(bars).toHaveLength(3)
  })

  test('a ready frame holds the declared rows at the row token, whatever the pointer, and no phone floor', () => {
    const html = renderToString(<DataPanel title="Open tasks" bodySize={{ rows: 6 }} body={list} />)
    expect(html).not.toContain('--panel-cards')
    // the row token is CSS: a coarse pointer's taller row is the server's height too
    expect(html).toContain('height:calc(6 * var(--basalt-row-h, 2rem))')
  })

  test('the first client render is the server render (no measured width changes the height)', () => {
    const server = renderToString(
      <DataPanel title="Open tasks" bodySize={{ rows: 6 }} body={list} />,
    )
    const { container } = render(
      <DataPanel title="Open tasks" bodySize={{ rows: 6 }} body={list} />,
    )
    const box = container.querySelector<HTMLElement>('[data-slot="card-phase"]')
    expect(server).toContain(`height:${box?.style.height}`)
  })
})
