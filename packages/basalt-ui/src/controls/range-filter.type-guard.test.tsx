/**
 * `RangeFilterProps` is generic over the FIELD's `custom` flag — the compile-time half, plus the one
 * runtime consequence of leaving `customPicker` out.
 *
 * Why a file of its own (the `actions.type-guard.test.ts` convention): pinning `C` to its default
 * `boolean` made `RangeFilter field={...}` reject a `field.range({ … })` that never declared
 * `custom: true`. The handle's setter is contravariant, so a `RangeValue<P>` setter cannot stand in
 * for a `RangeValue<P | 'custom'>` one — two consumers cast at the call site instead, which is
 * exactly the diagnostic the cast was hiding.
 */
import { describe, expect, spyOn, test } from 'bun:test'
import type { ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { FieldHandle, RangeField } from '../state'
import { createLocalStore, field } from '../state'
import { RangeFilter } from './range-filter'
import type { RangeCustomPickerProps } from './range-filter'

// Two stores, not two range fields in one: every range defaults its `from`/`to` param names, and
// the store core rejects the collision at definition (see `assertNoParamCollision`).
const store = createLocalStore({
  key: 'tg-range',
  fields: {
    presetsOnly: field.range({ presets: ['7d', '30d'], fallback: '30d' }),
    view: field.enum(['chart', 'table'], 'chart'),
  },
})

const customStore = createLocalStore({
  key: 'tg-range-custom',
  fields: { withCustom: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }) },
})

function Picker({ onChange }: RangeCustomPickerProps): ReactNode {
  return (
    <button
      type="button"
      onClick={() => {
        onChange({ from: '2026-03-01', to: '2026-03-14' })
      }}
    >
      pick march
    </button>
  )
}

/** A control that took a range handle from ITS OWN props — `C` widened, which must still bind. */
function Wrapper({ handle }: { handle: FieldHandle<RangeField<'7d' | '30d'>> }): ReactNode {
  return <RangeFilter field={handle} customPicker={Picker} />
}

// ── Valid — must type-check with no error ─────────────────────────────────────

function Accepted(): ReactNode {
  return (
    <>
      {/* The regression: no `custom`, therefore `RangeField<P, false>` — and no cast. */}
      <RangeFilter field={store.field.presetsOnly} />
      <RangeFilter field={store.field.presetsOnly} label="Window" />
      <RangeFilter field={customStore.field.withCustom} customPicker={Picker} />
      <Wrapper handle={customStore.field.withCustom} />
    </>
  )
}

// ── Invalid — each MUST be a tsc error, one directive per bad line ────────────

function Rejected(): ReactNode {
  return (
    <>
      {/* @ts-expect-error an enum handle is not a range handle, whatever `C` is */}
      <RangeFilter field={store.field.view} />
      {/* @ts-expect-error `value`/`onChange` is not the binding a basalt control takes (C2) */}
      <RangeFilter value={{ preset: '7d' }} onChange={() => {}} />
    </>
  )
}

/** The first argument of every captured warn call. */
function lines(warn: { mock: { calls: unknown[][] } }): string[] {
  return warn.mock.calls.map((call) => String(call[0]))
}

describe('RangeFilterProps (type-guard)', () => {
  test('both fixtures exist — tsc, not bun, is the assertion for the cases above', () => {
    expect(typeof Accepted).toBe('function')
    expect(typeof Rejected).toBe('function')
  })

  test('a custom-capable field with no picker warns once in dev — the affordance is unreachable', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render(
        <MantineProvider>
          <RangeFilter field={customStore.field.withCustom} label="Unreachable" />
        </MantineProvider>,
      )
      expect(screen.getByRole('button', { name: '30d' })).toBeDefined()
      expect(
        lines(warn).filter((line) => line.includes("RangeFilter('Unreachable')")),
      ).toHaveLength(1)
      expect(lines(warn)[0]).toContain('customPicker')
    } finally {
      warn.mockRestore()
    }
  })

  test('a preset-only field is silent — presets only is a configuration, not a mistake', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render(
        <MantineProvider>
          <RangeFilter field={store.field.presetsOnly} label="Silent" />
        </MantineProvider>,
      )
      expect(lines(warn).filter((line) => line.includes("RangeFilter('Silent')"))).toHaveLength(0)
    } finally {
      warn.mockRestore()
    }
  })
})
