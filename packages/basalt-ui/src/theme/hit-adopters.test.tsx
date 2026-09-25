/**
 * The theme's `[data-basalt-hit]` adopters land on the element that owns the tap — Switch track,
 * Checkbox/Radio label, Modal close button — under both the base theme and the `ctl` tier. The
 * NumberInput steppers are NOT adopters (two siblings ~15px apart cannot each own a 44px overlay;
 * the coarse `.input` min-height is the floor).
 */
import { Checkbox, MantineProvider, Modal, NumberInput, Radio, Switch } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { createBasaltTheme } from './index'
import { CtlSlot } from './ctl-theme'

const theme = createBasaltTheme()

const HIT = '[data-basalt-hit]'

function hitTags(root: ParentNode): string[] {
  return [...root.querySelectorAll(HIT)].map((el) => el.tagName.toLowerCase())
}

describe('theme hit adopters', () => {
  test('Switch: the track carries the hit attribute', () => {
    const { container } = render(
      <MantineProvider theme={theme}>
        <Switch label="On" />
      </MantineProvider>,
    )
    const hit = container.querySelector(HIT)
    expect(container.querySelectorAll(HIT)).toHaveLength(1)
    expect(hit?.className).toContain('track')
  })

  test.each([
    ['Checkbox', <Checkbox key="c" label="Tick" />],
    ['Radio', <Radio key="r" label="Pick" />],
  ])('%s: the label carries the hit attribute, not the input', (_name, control) => {
    const { container } = render(<MantineProvider theme={theme}>{control}</MantineProvider>)
    expect(container.querySelectorAll(HIT)).toHaveLength(1)
    const hit = container.querySelector(HIT)
    expect(hit?.tagName.toLowerCase()).toBe('label')
    expect(hit?.querySelector('input')).toBeNull()
  })

  test('Modal: the close button carries the hit attribute', () => {
    render(
      <MantineProvider theme={theme}>
        <Modal opened onClose={() => {}} title="T" transitionProps={{ duration: 0 }}>
          body
        </Modal>
      </MantineProvider>,
    )
    const hits = [...document.body.querySelectorAll(HIT)]
    expect(hits).toHaveLength(1)
    expect(hits[0]?.tagName.toLowerCase()).toBe('button')
    expect(hits[0]?.className).toContain('close')
  })

  test('NumberInput: the stepper controls do not adopt the hit attribute', () => {
    const { container } = render(
      <MantineProvider theme={theme}>
        <NumberInput />
      </MantineProvider>,
    )
    expect(container.querySelector('[data-position]')).not.toBeNull()
    expect(hitTags(container)).toEqual([])
  })

  test('CtlSlot: Switch track and Checkbox/Radio labels adopt the hit attribute', () => {
    const { container } = render(
      <MantineProvider theme={theme}>
        <CtlSlot>
          <Switch label="On" />
          <Checkbox label="Tick" />
          <Radio label="Pick" />
        </CtlSlot>
      </MantineProvider>,
    )
    expect(hitTags(container)).toEqual(['span', 'label', 'label'])
  })
})
