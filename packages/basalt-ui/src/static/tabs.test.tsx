/**
 * The tabs of `basalt-ui/static`, in a DOM: what the server writes, then what `siteScript()` does to it.
 * Panels are plain siblings, so the markup is built the way an MDX compiler hands it over.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { SiteDataTable } from './data-table'
import { SiteTab, SiteTabs } from './index'
import { siteScript } from './site-script'

const html = renderToStaticMarkup(
  <SiteTabs label="Install with" tabs={['bun', 'npm', 'pnpm']}>
    <SiteTab label="bun">bun add basalt-ui</SiteTab>
    <SiteTab label="npm">npm i basalt-ui</SiteTab>
    <SiteTab label="pnpm">pnpm add basalt-ui</SiteTab>
  </SiteTabs>,
)

const tabs = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('[role=tab]'))
const panel = (label: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[role=tabpanel][data-label="${label}"]`)
const key = (target: HTMLElement, name: string): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
}

describe('SiteTabs markup', () => {
  test('opens the first tab and tabs the others out of the order', () => {
    document.body.innerHTML = html
    const [first, second] = tabs()
    expect(first?.getAttribute('aria-selected')).toBe('true')
    expect(first?.tabIndex).toBe(0)
    expect(second?.getAttribute('aria-selected')).toBe('false')
    expect(second?.tabIndex).toBe(-1)
    document.body.innerHTML = ''
  })

  test('a panel is a tabpanel named by its label, and the server writes no script', () => {
    expect(html).not.toContain('<script')
    expect(html.match(/role="tabpanel"/g)).toHaveLength(3)
    expect(html).toContain('data-label="npm"')
  })

  test('without the head script every panel stays visible under its name', () => {
    // The hiding rules key on `data-basalt-js`, which only the head script sets.
    expect(html).toContain('[:root[data-basalt-js]_&')
    expect(html).not.toContain(' hidden')
  })
})

describe('siteScript tabs', () => {
  beforeAll(() => {
    // In a real head the script runs while the document is still loading and links ids on DOMContentLoaded.
    Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' })
    new Function(siteScript())()
    Reflect.deleteProperty(document, 'readyState')
  })
  beforeEach(() => {
    document.body.innerHTML = html
    // The script links ids once the document is parsed; a test document is already parsed.
    document.dispatchEvent(new Event('DOMContentLoaded'))
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('marks the document so the panels may hide', () => {
    expect(document.documentElement.hasAttribute('data-basalt-js')).toBe(true)
  })

  test('a click selects its tab and shows only its panel', () => {
    const [, npm] = tabs()
    npm?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
    expect(tabs().map((t) => t.tabIndex)).toEqual([-1, 0, -1])
    expect(panel('npm')?.hasAttribute('data-on')).toBe(true)
    expect(panel('bun')?.hasAttribute('data-on')).toBe(false)
    expect(document.querySelector('[data-basalt-tabs]')?.hasAttribute('data-picked')).toBe(true)
  })

  test('under dir="rtl" ArrowLeft moves to the next tab and ArrowRight to the previous', () => {
    // happy-dom derives no computed direction from `dir`; the inline style stands in for what a browser computes.
    const group = document.querySelector<HTMLElement>('[data-basalt-tabs]') as HTMLElement
    group.setAttribute('dir', 'rtl')
    group.style.direction = 'rtl'
    const [bun, npm] = tabs()
    key(bun as HTMLElement, 'ArrowLeft')
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
    key(npm as HTMLElement, 'ArrowRight')
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false'])
  })

  test('in ltr ArrowRight moves to the next tab', () => {
    const [bun, npm] = tabs()
    key(bun as HTMLElement, 'ArrowRight')
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
    key(npm as HTMLElement, 'ArrowLeft')
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false'])
  })

  test('the arrow keys, Home and End move the selection and the focus, and wrap', () => {
    const [bun, , pnpm] = tabs()
    key(bun as HTMLElement, 'ArrowLeft')
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true'])
    expect(document.activeElement).toBe(pnpm as HTMLElement)
    key(pnpm as HTMLElement, 'ArrowRight')
    expect(tabs()[0]?.getAttribute('aria-selected')).toBe('true')
    key(tabs()[0] as HTMLElement, 'End')
    expect(tabs()[2]?.getAttribute('aria-selected')).toBe('true')
    key(tabs()[2] as HTMLElement, 'Home')
    expect(tabs()[0]?.getAttribute('aria-selected')).toBe('true')
  })

  test('links each tab to its panel for assistive technology', () => {
    for (const tab of tabs()) {
      const target = document.getElementById(tab.getAttribute('aria-controls') ?? '')
      expect(target?.getAttribute('aria-labelledby')).toBe(tab.id)
      expect(target?.getAttribute('data-label')).toBe(tab.getAttribute('data-tab'))
    }
  })

  test('ignores a key that is not a tab key', () => {
    const [bun] = tabs()
    key(bun as HTMLElement, 'a')
    expect(bun?.getAttribute('aria-selected')).toBe('true')
  })
})

describe('SiteDataTable', () => {
  test('formats numbers by kind and dates as a calendar day, and marks a missing cell', () => {
    const out = renderToStaticMarkup(
      <SiteDataTable
        label="Releases"
        columns={[
          { key: 'v', label: 'Version' },
          { key: 'kb', label: 'Size', kind: 'number' },
          { key: 'on', label: 'Date', kind: 'date' },
        ]}
        rows={[{ v: '3.0', kb: 71500, on: '2026-07-06' }, { v: '3.1' }]}
      />,
    )
    expect(out).toContain('<caption')
    expect(out).toContain('71,500')
    expect(out).toContain('Jul 6')
    expect(out).toContain('—')
  })
})
