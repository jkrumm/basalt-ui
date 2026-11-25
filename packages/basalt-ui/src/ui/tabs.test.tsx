import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Tabs, TabsContent, TabsList, TabsTrigger, tabsParts, tabsVariants } from './tabs'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

const Sample = ({ size, keepMounted }: { size?: 'md' | 'sm'; keepMounted?: boolean }) => (
  <Tabs size={size} defaultValue="a">
    <TabsList aria-label="Sections">
      <TabsTrigger value="a">Alpha</TabsTrigger>
      <TabsTrigger value="b">Beta</TabsTrigger>
      <TabsTrigger value="c" disabled>
        Gamma
      </TabsTrigger>
      <TabsTrigger value="d">Delta</TabsTrigger>
      <TabsTrigger value="e" count={4} tone="bad" attention>
        Epsilon
      </TabsTrigger>
    </TabsList>
    <TabsContent value="a">
      <input aria-label="Draft" defaultValue="" />
    </TabsContent>
    <TabsContent value="b" keepMounted={keepMounted}>
      Beta panel
    </TabsContent>
    <TabsContent value="d">Delta panel</TabsContent>
  </Tabs>
)

const tab = (root: ParentNode, name: string): HTMLElement => {
  const el = [...root.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (t) => t.textContent === name,
  )
  if (!el) throw new Error(`no tab ${name}`)
  return el
}

describe('tabs module', () => {
  test('renders with no provider; every part carries data-slot and tabsParts lists them', () => {
    const { container } = render(<Sample />)
    expect(new Set(slots(container))).toEqual(new Set(tabsParts))
  })

  test('server render keeps every slot with no provider', () => {
    const html = renderToString(<Sample />)
    for (const part of tabsParts) expect(html).toContain(`data-slot="${part}"`)
  })

  test('md follows the density control height and is the default; sm is 24 px', () => {
    expect(tabsVariants()).toContain('[--tabs-h:var(--basalt-ctl-h)]')
    expect(tabsVariants({ size: 'sm' })).toContain('[--tabs-h:1.5rem]')
    const { container } = render(<Sample size="sm" />)
    expect(container.querySelector('[data-slot="tabs"]')?.className).toContain('[--tabs-h:1.5rem]')
  })

  test('triggers keep their height and reach a 44 px hit area under a coarse pointer', () => {
    const { container } = render(<Sample />)
    expect(tab(container, 'Alpha').className).toContain('pointer-coarse:after:min-h-11')
    expect(tab(container, 'Alpha').className).not.toContain('pointer-coarse:min-h-11')
  })

  test('className is merged after the variant classes and cannot replace the slot', () => {
    const { container } = render(
      <Tabs className="w-full" data-slot="hijacked">
        <TabsList />
      </Tabs>,
    )
    const root = container.firstElementChild
    expect(root?.className).toContain('w-full')
    expect(root?.className).toContain('flex-col')
    expect(root?.getAttribute('data-slot')).toBe('tabs')
  })

  test('the first tab is active, linked to its panel, and only that panel is mounted', () => {
    const { container, queryByText } = render(<Sample />)
    const alpha = tab(container, 'Alpha')
    expect(alpha.getAttribute('aria-selected')).toBe('true')
    const panel = container.querySelector('[role="tabpanel"]')
    expect(alpha.getAttribute('aria-controls')).toBe(panel?.id ?? 'missing')
    expect(queryByText('Beta panel')).toBeNull()
  })

  // Arrow-key focus order is proven in a real browser (tests/layout/ui-disclose.layout.test.ts):
  // Base UI orders the roving items by their rendered geometry, which happy-dom does not compute.

  test('Enter and Space activate the focused tab', () => {
    const { container, queryByText } = render(<Sample />)
    const beta = tab(container, 'Beta')
    beta.focus()
    fireEvent.keyDown(beta, { key: 'Enter' })
    fireEvent.click(beta)
    expect(beta.getAttribute('aria-selected')).toBe('true')
    expect(queryByText('Beta panel')).toBeTruthy()
    const delta = tab(container, 'Delta')
    delta.focus()
    fireEvent.keyDown(delta, { key: ' ' })
    fireEvent.click(delta)
    expect(delta.getAttribute('aria-selected')).toBe('true')
  })

  test('segment is a tinted track with a raised active face and no underline; line is the default', () => {
    const line = render(<Sample />)
    expect(line.container.querySelector('[data-slot="tabs"]')?.getAttribute('data-variant')).toBe(
      'line',
    )
    expect(tab(line.container, 'Alpha').className).toContain('data-active:border-brand')
    cleanup()
    const { container } = render(
      <Tabs variant="segment" defaultValue="a">
        <TabsList aria-label="View">
          <TabsTrigger value="a">Alpha</TabsTrigger>
        </TabsList>
      </Tabs>,
    )
    expect(container.querySelector('[data-slot="tabs"]')?.getAttribute('data-variant')).toBe(
      'segment',
    )
    const list = container.querySelector('[data-slot="tabs-list"]')?.className
    expect(list).toContain('bg-accent')
    expect(list).not.toContain('border-b')
    const trigger = tab(container, 'Alpha').className
    expect(trigger).toContain('data-active:bg-secondary')
    expect(trigger).not.toContain('border-brand')
    expect(trigger).toContain('pointer-coarse:after:min-h-11')
    expect(trigger).toContain('forced-colors:border')
  })

  test('a count draws the badge PageBar tabs draw: muted figures, the bad tone for attention', () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList aria-label="Sections">
          <TabsTrigger value="a" count={12}>
            Alpha
          </TabsTrigger>
          <TabsTrigger value="b" count={0} attention tone="bad">
            Beta
          </TabsTrigger>
          <TabsTrigger value="c">Gamma</TabsTrigger>
        </TabsList>
      </Tabs>,
    )
    const alpha = [...container.querySelectorAll('[role="tab"]')][0]!
    expect(alpha.textContent).toBe('Alpha12')
    const plain = alpha.querySelector('[data-badge="count"]')!
    expect(plain.className).toContain('text-muted-foreground')
    expect(plain.hasAttribute('data-attention')).toBe(false)
    const beta = [...container.querySelectorAll('[role="tab"]')][1]!
    const hot = beta.querySelector('[data-badge="count"]')!
    expect(hot.textContent).toBe('0')
    expect(hot.className).toContain('text-bad')
    expect(hot.hasAttribute('data-attention')).toBe(true)
    expect(beta.querySelector('[data-badge="dot"]')?.className).toContain('bg-bad')
    expect(container.querySelectorAll('[role="tab"]')[2]?.querySelector('[data-badge]')).toBeNull()
  })

  test('keepMounted keeps a hidden panel in the DOM', () => {
    const { container, queryByText } = render(<Sample keepMounted />)
    expect(queryByText('Beta panel')).toBeTruthy()
    expect(container.querySelector('[role="tabpanel"][hidden]')).toBeTruthy()
  })
})
