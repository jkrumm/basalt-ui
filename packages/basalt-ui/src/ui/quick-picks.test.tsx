import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { QuickPicks, quickPicksParts } from './quick-picks'

afterEach(cleanup)

const options = [
  { value: '2026-11-22', label: 'Today' },
  { value: '2026-11-23', label: 'Tomorrow' },
  { value: '2026-11-25', label: 'In 3 days' },
]

function Due(): ReactElement {
  const [due, setDue] = useState('')
  return (
    <>
      <QuickPicks
        aria-label="Due date shortcuts"
        options={options}
        value={due}
        onValueChange={setDue}
      />
      <input aria-label="Due" value={due} onChange={(e) => setDue(e.target.value)} />
    </>
  )
}

describe('quick-picks', () => {
  test('a pick writes its value into the field it feeds and shows picked', () => {
    const { getByRole } = render(<Due />)
    fireEvent.click(getByRole('radio', { name: 'Tomorrow' }))
    expect((getByRole('textbox', { name: 'Due' }) as HTMLInputElement).value).toBe('2026-11-23')
    expect(getByRole('radio', { name: 'Tomorrow' }).hasAttribute('data-checked')).toBe(true)
  })

  test('typing a value no pill holds clears the pick', () => {
    const { getByRole, getAllByRole } = render(<Due />)
    fireEvent.click(getByRole('radio', { name: 'Today' }))
    fireEvent.change(getByRole('textbox', { name: 'Due' }), { target: { value: '2027-01-01' } })
    expect(getAllByRole('radio').some((r) => r.hasAttribute('data-checked'))).toBe(false)
  })

  test('is one named radio group with one tab stop', () => {
    const { getByRole, getAllByRole } = render(<Due />)
    expect(getByRole('radiogroup', { name: 'Due date shortcuts' })).toBeDefined()
    expect(getAllByRole('radio').filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1)
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<Due />)
    for (const part of quickPicksParts) expect(html).toContain(`data-slot="${part}"`)
  })
})
