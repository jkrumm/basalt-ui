import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

import { deniedCurrent, zoneAFillOnly, zoneANames, zoneAPremixed } from './zone-a'
import { renderZoneA, ZONE_A_PATH } from './gen-zone-a'

describe('zone-a', () => {
  it('equals the regenerated output (run gen-zone-a.ts --write on drift)', () => {
    expect(readFileSync(ZONE_A_PATH, 'utf8')).toBe(renderZoneA())
  })

  it('probe: destructive, ring and line are names, bg-current is a denied entry', () => {
    for (const name of [
      'destructive',
      'ring',
      'line',
      'brand-fill',
      'good-tint',
      'chart-5',
      'seq-1',
    ]) {
      expect(zoneANames as readonly string[]).toContain(name)
    }
    expect(deniedCurrent as readonly string[]).toContain('bg-current')
  })

  it('carries the pre-mixed and fill-only names the class rules read', () => {
    expect(zoneAPremixed as readonly string[]).toEqual(
      expect.arrayContaining(['hairline', 'hover', 'selected', 'scrim']),
    )
    expect(zoneAFillOnly as readonly string[]).toEqual(
      expect.arrayContaining(['brand-fill', 'dim-bar', 'chart-1', 'seq-5']),
    )
  })

  it('leaves fill, stroke and text current allowed', () => {
    for (const u of ['fill', 'stroke', 'text']) {
      expect(deniedCurrent as readonly string[]).not.toContain(`${u}-current`)
    }
  })
})
