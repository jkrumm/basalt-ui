import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

import {
  deniedCurrent,
  zoneAFillOnly,
  zoneANames,
  zoneAPremixed,
  zoneATokenClasses,
} from './zone-a'
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

  it('carries the pre-mixed theme classes and fill-only names the class rules read', () => {
    // The theme's class names (`--color-accent: var(--basalt-hover)`), never the token names: `bg-hover` is no class.
    expect([...zoneAPremixed].toSorted()).toEqual([
      'accent',
      'border',
      'scrim',
      'scrim-wash',
      'selected',
    ])
    expect(zoneAFillOnly as readonly string[]).toEqual(
      expect.arrayContaining(['brand-fill', 'dim-bar', 'chart-1', 'seq-5']),
    )
  })

  it('maps a token the theme renames to the class that reads it', () => {
    expect(zoneATokenClasses).toMatchObject({
      hover: 'bg-accent',
      canvas: 'bg-background',
      hairline: 'border-border',
      ink: 'text-foreground',
      raised: 'bg-popover',
    })
    expect(Object.keys(zoneATokenClasses)).not.toContain('card')
  })

  it('leaves fill, stroke and text current allowed', () => {
    for (const u of ['fill', 'stroke', 'text']) {
      expect(deniedCurrent as readonly string[]).not.toContain(`${u}-current`)
    }
  })
})
