import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Button } from './button'
import { CopyButton } from './copy-button'
import {
  ButtonGroup,
  ControlGroup,
  InputAddon,
  InputGroup,
  controlGroupParts,
} from './control-group'
import { Input } from './input'
import { PasswordInput } from './password-input'
import { NativeSelect } from './select'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')
const byName = (root: ParentNode, name: string): HTMLElement =>
  root.querySelector<HTMLElement>(`[aria-label="${name}"]`)!

describe('control-group module', () => {
  test('each group is a named fieldset carrying its own slot', () => {
    const { container } = render(
      <>
        <ButtonGroup aria-label="Period">
          <Button>Today</Button>
        </ButtonGroup>
        <ControlGroup aria-label="Find">
          <Input aria-label="Query" />
        </ControlGroup>
        <InputGroup aria-label="Site">
          <InputAddon>https://</InputAddon>
          <Input aria-label="Website" />
        </InputGroup>
      </>,
    )
    const groups = [...container.querySelectorAll('fieldset')]
    expect(groups.map((g) => g.getAttribute('data-slot'))).toEqual([
      'button-group',
      'control-group',
      'input-group',
    ])
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Period', 'Find', 'Site'])
    expect(slots(container)).toEqual(expect.arrayContaining([...controlGroupParts]))
  })

  test('a group sets size and variant for its children; a child that passes its own keeps it', () => {
    const { container } = render(
      <ButtonGroup size="sm" variant="ghost">
        <Button aria-label="a" shape="icon">
          a
        </Button>
        <Button aria-label="b" shape="icon" size="md" variant="primary">
          b
        </Button>
      </ButtonGroup>,
    )
    const a = byName(container, 'a').className
    const b = byName(container, 'b').className
    expect(a).toContain('size-6')
    expect(a).not.toContain('bg-primary')
    expect(b).toContain('size-ctl')
    expect(b).toContain('bg-primary')
  })

  test('fields take the group size; outside a group nothing changes', () => {
    const { container } = render(
      <>
        <ControlGroup size="sm">
          <Input aria-label="in" />
          <NativeSelect aria-label="pick" options={[{ value: 'a', label: 'A' }]} />
        </ControlGroup>
        <Input aria-label="alone" />
      </>,
    )
    expect(byName(container, 'in').className).toContain('h-6')
    expect(byName(container, 'in').className).toContain('w-auto')
    expect(container.querySelector('[data-slot="native-select"]')!.className).toContain(
      '[&_select]:h-6',
    )
    expect(byName(container, 'alone').className).toContain('h-ctl')
    expect(byName(container, 'alone').className).toContain('w-full')
  })

  test('fill grows every child; grow-0 keeps one at its own width', () => {
    const { container } = render(
      <ControlGroup fill>
        <Input aria-label="grow" />
        <Button aria-label="keep" shape="icon" className="grow-0">
          k
        </Button>
      </ControlGroup>,
    )
    expect(container.querySelector('[data-slot="control-group"]')!.className).toContain('w-full')
    expect(byName(container, 'grow').className).toMatch(/(^| )grow( |$)/)
    const keep = byName(container, 'keep').className
    expect(keep).toContain('grow-0')
    expect(keep).not.toMatch(/(^| )grow( |$)/)
  })

  test('vertical orientation is written for CSS and stacks the children', () => {
    const { container } = render(
      <ButtonGroup orientation="vertical">
        <Button>One</Button>
        <Button>Two</Button>
      </ButtonGroup>,
    )
    const group = container.querySelector('[data-slot="button-group"]')!
    expect(group.getAttribute('data-orientation')).toBe('vertical')
    expect(group.className).toContain('flex-col')
  })

  test('a button inside a field belongs to the field, not to the group around it', () => {
    const { container } = render(
      <ControlGroup fill size="sm">
        <Input aria-label="key" end={<Button aria-label="clear" shape="icon" size="sm" />} />
      </ControlGroup>,
    )
    expect(byName(container, 'clear').className).not.toMatch(/(^| )grow( |$)/)
  })

  test('server render keeps the slots', () => {
    const html = renderToString(
      <InputGroup>
        <InputAddon>kg</InputAddon>
        <Input aria-label="Weight in kg" />
      </InputGroup>,
    )
    expect(html).toContain('data-slot="input-group"')
    expect(html).toContain('data-slot="input-addon"')
  })
})

describe('PasswordInput', () => {
  test('the reveal button flips the type, its name and aria-pressed', () => {
    const { container } = render(
      <PasswordInput aria-label="Password" autoComplete="current-password" />,
    )
    const field = container.querySelector('input')!
    expect(field.getAttribute('data-slot')).toBe('password-input')
    expect(field.type).toBe('password')
    const reveal = byName(container, 'Show password')
    expect(reveal.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(reveal)
    expect(field.type).toBe('text')
    expect(byName(container, 'Hide password').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('CopyButton', () => {
  test('writes the value, then names itself Copied until focus leaves', async () => {
    const writeText = mock<(text: string) => Promise<void>>(() => Promise.resolve())
    const restore = Object.getOwnPropertyDescriptor(window, 'isSecureContext')
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const onCopied = mock<(value: string) => void>(() => undefined)
    const { container } = render(<CopyButton value="sk-123" label="API key" onCopied={onCopied} />)
    const button = byName(container, 'Copy API key')
    expect(button.getAttribute('data-slot')).toBe('copy-button')
    await act(async () => {
      fireEvent.click(button)
    })
    expect(writeText).toHaveBeenCalledWith('sk-123')
    expect(onCopied).toHaveBeenCalledWith('sk-123')
    expect(button.getAttribute('aria-label')).toBe('Copied')
    fireEvent.blur(button)
    expect(button.getAttribute('aria-label')).toBe('Copy API key')
    if (restore !== undefined) Object.defineProperty(window, 'isSecureContext', restore)
  })
})
