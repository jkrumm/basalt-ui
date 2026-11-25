import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { PropertyList } from './property-list'
import type { PropertyRow } from './property-list'

afterEach(cleanup)

const editButton = (label: string): HTMLElement =>
  screen.getByRole('button', { name: `Edit ${label}` })

describe('PropertyList layout', () => {
  test('is a Facts-shaped dl: one term and description per row, a read-only row included', () => {
    const rows: PropertyRow[] = [
      { id: 'since', label: 'Since', value: 'Mar 2021' },
      {
        id: 'contact',
        kind: 'text',
        label: 'Contact',
        value: 'Ida',
        autoComplete: 'off',
        onCommit: () => {},
      },
    ]
    const { container } = render(<PropertyList rows={rows} />)
    expect([...container.querySelectorAll('dt')].map((el) => el.textContent)).toEqual([
      'Since',
      'Contact',
    ])
    expect(container.querySelector('[data-slot="property-list"]')?.className).toContain(
      '@container',
    )
    expect(container.querySelector('dl')?.className).toContain('@regular:grid-cols-')
    expect(container.querySelectorAll('button')).toHaveLength(1)
  })

  test('on touch a row keeps its density height; an editable value is one target with a 44 px hit area, and no negative margin spills it', () => {
    const { container } = render(
      <PropertyList
        rows={[
          { id: 'since', label: 'Since', value: 'Mar 2021' },
          {
            id: 'contact',
            kind: 'text',
            label: 'Contact',
            value: 'Ida',
            autoComplete: 'off',
            onCommit: () => {},
          },
        ]}
      />,
    )
    for (const cell of container.querySelectorAll('dt, [data-kind="fact"] dd'))
      expect(cell.className).not.toContain('pointer-coarse')
    const button = container.querySelector('button')!
    expect(button.className).toContain('pointer-coarse:after:min-h-11')
    expect(button.className).not.toContain('pointer-coarse:min-h-11')
    expect(button.className).not.toContain('pointer-coarse:-my')
  })
})

describe('PropertyList text row', () => {
  const row = (
    onCommit: (next: string) => void | Promise<void>,
    extra: Partial<PropertyRow> = {},
  ) =>
    ({
      id: 'email',
      kind: 'text',
      label: 'Email',
      value: 'ida@acme.test',
      autoComplete: 'email',
      type: 'email',
      onCommit,
      ...extra,
    }) as PropertyRow

  test('the value is a button; a click opens an input that carries the autocomplete token', () => {
    render(<PropertyList rows={[row(() => {})]} />)
    fireEvent.click(editButton('Email'))
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Email' })
    expect(input.value).toBe('ida@acme.test')
    expect(input.getAttribute('autocomplete')).toBe('email')
    expect(input.type).toBe('email')
    expect(document.activeElement).toBe(input)
  })

  test('Enter commits once, even though the closing editor blurs', () => {
    const writes: string[] = []
    render(<PropertyList rows={[row((next) => void writes.push(next))]} />)
    fireEvent.click(editButton('Email'))
    const input = screen.getByRole('textbox', { name: 'Email' })
    fireEvent.change(input, { target: { value: 'ida@new.test' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(writes).toEqual(['ida@new.test'])
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  test('a keystroke commits nothing; blur does', () => {
    const writes: string[] = []
    render(<PropertyList rows={[row((next) => void writes.push(next))]} />)
    fireEvent.click(editButton('Email'))
    const input = screen.getByRole('textbox', { name: 'Email' })
    fireEvent.change(input, { target: { value: 'x' } })
    expect(writes).toEqual([])
    fireEvent.blur(input)
    expect(writes).toEqual(['x'])
  })

  test('Escape drops the draft and writes nothing', () => {
    const writes: string[] = []
    render(<PropertyList rows={[row((next) => void writes.push(next))]} />)
    fireEvent.click(editButton('Email'))
    const input = screen.getByRole('textbox', { name: 'Email' })
    fireEvent.change(input, { target: { value: 'x' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)
    expect(writes).toEqual([])
    expect(screen.getByRole('button', { name: 'Edit Email' }).textContent).toBe('ida@acme.test')
  })

  test('an IME confirming Enter does not commit', () => {
    const writes: string[] = []
    render(<PropertyList rows={[row((next) => void writes.push(next))]} />)
    fireEvent.click(editButton('Email'))
    const input = screen.getByRole('textbox', { name: 'Email' })
    fireEvent.change(input, { target: { value: 'あ' } })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    expect(writes).toEqual([])
  })

  test('an unchanged value closes without a write', () => {
    const writes: string[] = []
    render(<PropertyList rows={[row((next) => void writes.push(next))]} />)
    fireEvent.click(editButton('Email'))
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Email' }), { key: 'Enter' })
    expect(writes).toEqual([])
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  test('a validation error shows on Enter, names the field, and keeps the editor open', () => {
    const writes: string[] = []
    render(
      <PropertyList
        rows={[
          row((next) => void writes.push(next), {
            validate: (next: string) => (next.includes('@') ? undefined : 'Error: needs an @.'),
          } as Partial<PropertyRow>),
        ]}
      />,
    )
    fireEvent.click(editButton('Email'))
    const input = screen.getByRole('textbox', { name: 'Email' })
    fireEvent.change(input, { target: { value: 'nope' } })
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByRole('alert').textContent).toBe('Error: needs an @.')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
    expect(writes).toEqual([])
    expect(screen.getByRole('textbox', { name: 'Email' })).toBe(input)
  })

  test('a rejected save keeps the editor open and shows its message', async () => {
    render(<PropertyList rows={[row(() => Promise.reject(new Error('Error: server said no.')))]} />)
    fireEvent.click(editButton('Email'))
    const input = screen.getByRole('textbox', { name: 'Email' })
    fireEvent.change(input, { target: { value: 'ida@new.test' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Error: server said no.')
    })
    expect(screen.getByRole('textbox', { name: 'Email' })).toBe(input)
  })

  test('an empty value reads Not set', () => {
    render(<PropertyList rows={[row(() => {}, { value: '' } as Partial<PropertyRow>)]} />)
    expect(editButton('Email').textContent).toBe('Not set')
  })
})

describe('PropertyList number row', () => {
  const row = (writes: number[]): PropertyRow => ({
    id: 'lead',
    kind: 'number',
    label: 'Lead time',
    value: 14,
    unit: 'days',
    min: 0,
    max: 365,
    onCommit: (next) => void writes.push(next),
  })

  test('shows the value with its unit and edits it as a number', () => {
    const writes: number[] = []
    render(<PropertyList rows={[row(writes)]} />)
    expect(editButton('Lead time').textContent).toBe('14 days')
    fireEvent.click(editButton('Lead time'))
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Lead time' })
    expect(input.getAttribute('inputmode')).toBe('decimal')
    fireEvent.change(input, { target: { value: '21' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(writes).toEqual([21])
  })

  test('a value out of range or not a number shows the range and writes nothing', () => {
    const writes: number[] = []
    render(<PropertyList rows={[row(writes)]} />)
    fireEvent.click(editButton('Lead time'))
    const input = screen.getByRole('textbox', { name: 'Lead time' })
    fireEvent.change(input, { target: { value: '900' } })
    fireEvent.blur(input)
    expect(screen.getByRole('alert').textContent).toBe('Error: enter a number from 0 to 365.')
    fireEvent.change(input, { target: { value: 'soon' } })
    fireEvent.blur(input)
    expect(writes).toEqual([])
  })
})

describe('PropertyList date row', () => {
  test('prints the day through Format and edits it as a day', () => {
    const writes: string[] = []
    render(
      <PropertyList
        rows={[
          {
            id: 'since',
            kind: 'date',
            label: 'Supplier since',
            value: '2021-03-04',
            onCommit: (next) => void writes.push(next),
          },
        ]}
      />,
    )
    expect(editButton('Supplier since').textContent).not.toBe('2021-03-04')
    fireEvent.click(editButton('Supplier since'))
    const input = document.querySelector<HTMLInputElement>('input[type="date"]')!
    expect(input.value).toBe('2021-03-04')
    fireEvent.change(input, { target: { value: '2022-01-02' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(writes).toEqual(['2022-01-02'])
  })
})

describe('PropertyList select and person rows', () => {
  test('a select row shows the option label and opens its list on click', async () => {
    render(
      <PropertyList
        rows={[
          {
            id: 'terms',
            kind: 'select',
            label: 'Payment terms',
            value: 'net30',
            options: [
              { value: 'net30', label: 'Net 30' },
              { value: 'net60', label: 'Net 60' },
            ],
            onCommit: () => {},
          },
        ]}
      />,
    )
    expect(editButton('Payment terms').textContent).toBe('Net 30')
    await act(async () => {
      fireEvent.click(editButton('Payment terms'))
    })
    expect(screen.getByRole('combobox', { name: 'Payment terms' })).not.toBeNull()
  })

  test('a person row shows the face and name of the person the id names', () => {
    render(
      <PropertyList
        rows={[
          {
            id: 'buyer',
            kind: 'person',
            label: 'Buyer',
            value: 'u2',
            people: [
              { id: 'u1', name: 'Ada Lovelace' },
              { id: 'u2', name: 'Grace Hopper' },
            ],
            onCommit: () => {},
          },
        ]}
      />,
    )
    const button = editButton('Buyer')
    expect(button.textContent).toContain('Grace Hopper')
    expect(button.querySelector('[role="img"]')).not.toBeNull()
  })

  test('an id the list does not know reads Not set', () => {
    render(
      <PropertyList
        rows={[
          {
            id: 'buyer',
            kind: 'person',
            label: 'Buyer',
            value: null,
            people: [{ id: 'u1', name: 'Ada Lovelace' }],
            onCommit: () => {},
          },
        ]}
      />,
    )
    expect(editButton('Buyer').textContent).toBe('Not set')
  })
})
