import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { StatGroup } from './stat-group'
import type { StatStripProps } from './stat-strip'

afterEach(cleanup)

const mount = (props: Partial<StatStripProps> = {}) =>
  render(
    <MantineProvider>
      <StatGroup
        variant="strip"
        label="Health"
        cells={[
          { key: 'a', caption: 'Resting HR', value: '52' },
          { key: 'b', caption: 'Load', value: '410', shotAbsent: ['error'] },
        ]}
        footer={[{ key: 'note', content: 'Note' }]}
        {...props}
      />
    </MantineProvider>,
  )

const anchor = (c: HTMLElement, name: string) =>
  c.querySelector(`[data-shot="${name}"]`)?.getAttribute('data-shot-absent') ?? null

describe('strip shot absence', () => {
  test('no declaration: no attribute on any derived anchor', () => {
    const { container } = mount()
    expect(anchor(container, 'strip-a')).toBeNull()
    expect(anchor(container, 'strip-footer-note')).toBeNull()
  })

  test('the group declaration lands on every cell anchor and footer anchor', () => {
    const { container } = mount({ shotAbsent: ['empty', 'loading'] })
    expect(anchor(container, 'strip-a')).toBe('empty loading')
    expect(anchor(container, 'strip-footer-note')).toBe('empty loading')
  })

  test('a cell prop is the exception and replaces the group declaration', () => {
    const { container } = mount({ shotAbsent: ['empty'] })
    expect(anchor(container, 'strip-b')).toBe('error')
  })

  test('a cell prop alone, without a group declaration', () => {
    const { container } = mount()
    expect(anchor(container, 'strip-b')).toBe('error')
  })
})
