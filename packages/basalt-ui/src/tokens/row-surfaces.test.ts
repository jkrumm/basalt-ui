/**
 * `VX.surface.rowHover` / `rowSelected` (argo UPSTREAM Wave 25): a row surface that reads in BOTH
 * schemes. `panelHover` is a LIGHTER step than `panel` in light, so a hovered row on a panel was
 * invisible there. The law: a row surface is the panel mixed toward the ink, and it differs from
 * the panel by at least as much contrast as the `panelHover` step does.
 */
import { describe, expect, test } from 'bun:test'
import { buildPaletteCss, VX } from './index'
import { contrastRatio } from './hct'
import { DEFAULT_DERIVE_CONFIG, deriveTokens } from './derive'
import { STATUS_TEXT_CONTRAST_MIN, STATUS_TEXT_SURFACES } from './status-text'

const data = deriveTokens(DEFAULT_DERIVE_CONFIG)
const SIDES = ['light', 'dark'] as const

describe('row surfaces', () => {
  for (const side of SIDES) {
    test(`${side}: rowHover and rowSelected differ from panel at least as much as panelHover`, () => {
      const panel = data.surface.panel[side]
      const floor = contrastRatio(data.surface.panelHover[side], panel)
      expect(contrastRatio(data.surface.rowHover[side], panel)).toBeGreaterThanOrEqual(floor)
      expect(contrastRatio(data.surface.rowSelected[side], panel)).toBeGreaterThanOrEqual(floor)
    })

    test(`${side}: selected reads stronger than hover`, () => {
      const panel = data.surface.panel[side]
      expect(contrastRatio(data.surface.rowSelected[side], panel)).toBeGreaterThan(
        contrastRatio(data.surface.rowHover[side], panel),
      )
    })

    test(`${side}: ink on a row surface clears AA`, () => {
      for (const key of ['rowHover', 'rowSelected'] as const) {
        expect(contrastRatio(data.ink.ink[side], data.surface[key][side])).toBeGreaterThanOrEqual(
          STATUS_TEXT_CONTRAST_MIN,
        )
      }
    })
  }

  test('status text is not solved against the row surfaces (the default hexes stay byte-identical)', () => {
    expect(STATUS_TEXT_SURFACES.rowHover).toBe(false)
    expect(STATUS_TEXT_SURFACES.rowSelected).toBe(false)
  })

  test('emitted as --vx-surface-row-hover / --vx-surface-row-selected and typed on VX.surface', () => {
    const css = buildPaletteCss()
    expect(css).toContain('--vx-surface-row-hover:')
    expect(css).toContain('--vx-surface-row-selected:')
    expect(VX.surface.rowHover).toBe('var(--vx-surface-row-hover)')
    expect(VX.surface.rowSelected).toBe('var(--vx-surface-row-selected)')
  })
})
