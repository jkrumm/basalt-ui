/**
 * `ModelPicker` on the list engine, `Message` and `MessageActions` as typed data, and
 * `ReasoningTrace` on its own.
 */
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Message, MessageActions } from './message'
import type { MessageFeedback } from './message'
import { ModelPicker } from './model-picker'
import { ReasoningTrace } from './reasoning-trace'

afterEach(cleanup)

const MODELS = [
  {
    label: 'Fast',
    options: [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ],
  },
  { label: 'Deep', options: [{ value: 'c', label: 'Gamma' }] },
]

describe('ModelPicker', () => {
  test('a multi picker lists its groups and counts the choice in its footer', async () => {
    let value: string[] = []
    const { getByRole } = render(
      <ModelPicker
        aria-label="Models"
        multiple
        options={MODELS}
        defaultValue={['a', 'c']}
        onValueChange={(next) => (value = next)}
      />,
    )
    const trigger = getByRole('combobox', { name: 'Models' })
    expect(trigger.textContent).toContain('2 models')
    fireEvent.click(trigger)
    await waitFor(() =>
      expect(document.querySelectorAll('[data-slot="option-row"]')).toHaveLength(3),
    )
    expect(document.body.textContent).toContain('Fast')
    expect(document.body.textContent).toContain('Deep')
    expect(document.querySelector('[data-slot="model-picker-count"]')?.textContent).toBe(
      '2 models selected',
    )
    fireEvent.click([...document.querySelectorAll('[data-slot="option-row"]')][1]!)
    await waitFor(() => expect(value).toEqual(['a', 'c', 'b']))
    expect(document.querySelector('[data-slot="model-picker-count"]')?.textContent).toBe(
      '3 models selected',
    )
  })

  test('a single picker names its choice and draws no footer', () => {
    const { getByRole } = render(
      <ModelPicker aria-label="Model" options={MODELS} defaultValue="b" />,
    )
    expect(getByRole('combobox', { name: 'Model' }).textContent).toContain('Beta')
    expect(document.querySelector('[data-slot="model-picker-count"]')).toBeNull()
  })
})

describe('Message and MessageActions', () => {
  test('a user turn is a bubble; an assistant turn has none', () => {
    const { container } = render(
      <>
        <Message from="user">Which bearings run out?</Message>
        <Message from="assistant">Two of them.</Message>
      </>,
    )
    const [user, assistant] = [...container.querySelectorAll('[data-slot="ai-message-body"]')]
    expect(user?.className).toContain('rounded-ctrl')
    expect(user?.className).toContain('bg-inset')
    expect(assistant?.className).not.toContain('bg-inset')
  })

  test('actions are typed data in one named toolbar; feedback toggles', () => {
    const seen: MessageFeedback[] = []
    let regenerated = 0
    const { getByRole } = render(
      <MessageActions
        actions={[
          { kind: 'copy', text: 'Two of them.' },
          { kind: 'regenerate', onSelect: () => (regenerated += 1) },
          { kind: 'feedback', value: 'good', onChange: (v) => seen.push(v) },
          { kind: 'edit', onSelect: () => {} },
        ]}
      />,
    )
    const bar = getByRole('toolbar', { name: 'Message actions' })
    const names = [...bar.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual([
      'Copy Copy message',
      'Regenerate',
      'Good response',
      'Bad response',
      'Edit',
    ])
    fireEvent.click(getByRole('button', { name: 'Regenerate' }))
    expect(regenerated).toBe(1)
    const good = getByRole('button', { name: 'Good response' })
    expect(good.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(good)
    fireEvent.click(getByRole('button', { name: 'Bad response' }))
    expect(seen).toEqual([null, 'bad'])
  })

  test('inside a Message the actions show on hover and focus; a streaming turn has none yet', () => {
    const { container, rerender } = render(
      <Message from="assistant" actions={[{ kind: 'copy', text: 'x' }]}>
        x
      </Message>,
    )
    const bar = container.querySelector('[data-slot="ai-message-actions"]')
    expect(bar?.className).toContain('opacity-0')
    expect(bar?.className).toContain('group-focus-within/message:opacity-100')
    rerender(
      <Message from="assistant" streaming actions={[{ kind: 'copy', text: 'x' }]}>
        x
      </Message>,
    )
    expect(container.querySelector('[data-slot="ai-message-actions"]')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })
})

describe('ReasoningTrace', () => {
  test('an ordered rail of steps that folds once settled', () => {
    const { container, getByText } = render(
      <ReasoningTrace
        steps={[
          { kind: 'reasoning', text: 'Look up stock' },
          { kind: 'tool', view: { state: 'done', name: 'stock', args: {} } },
        ]}
      />,
    )
    expect(getByText('1 tool used')).toBeTruthy()
    expect(container.querySelector('ol')).toBeNull()
    fireEvent.click(getByText('1 tool used'))
    expect(container.querySelectorAll('ol > li')).toHaveLength(2)
  })
})
