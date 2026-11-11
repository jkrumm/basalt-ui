/**
 * The block defaults and the fold-key grammar. Ported from the "sidebar block defaults" describe of
 * 2.x `src/shell/mobile-nav-model.test.ts` (5 tests); the slug golden is that file's line 651.
 */
import { describe, expect, test } from 'bun:test'
import {
  blockFoldKey,
  blockMobile,
  blockPlacement,
  blockRail,
  blockVisibleCount,
  sectionFoldKey,
  slugifyLabel,
} from './block-model'
import type { CoreCustomBlock, CoreListBlock, CoreProgressBlock } from './block-model'

const icon = () => null

describe('block defaults', () => {
  const listBlock: CoreListBlock = { kind: 'list', id: 'k', label: 'L', items: [] }
  const progressBlock: CoreProgressBlock = { kind: 'progress', id: 'p', label: 'P', value: 0.2 }
  const customBlock: CoreCustomBlock = { kind: 'custom', id: 'c' }

  test('placement: list/custom default to nav, progress to bottom', () => {
    expect(blockPlacement(listBlock)).toBe('nav')
    expect(blockPlacement(customBlock)).toBe('nav')
    expect(blockPlacement(progressBlock)).toBe('bottom')
    expect(blockPlacement({ ...listBlock, placement: 'bottom' })).toBe('bottom')
  })

  test('rail: a dot only for a list with BOTH a count and an icon, a ring for progress', () => {
    expect(blockRail(listBlock)).toBe('hidden')
    expect(blockRail({ ...listBlock, count: 3, icon })).toBe('dot')
    expect(blockRail({ ...listBlock, count: 3, icon, rail: 'hidden' })).toBe('hidden')
    expect(blockRail({ ...listBlock, count: 3 })).toBe('hidden')
    expect(blockRail({ ...listBlock, icon })).toBe('hidden')
    expect(blockRail({ ...listBlock, rail: 'dot' })).toBe('hidden')
    expect(blockRail(progressBlock)).toBe('ring')
    expect(blockRail({ ...progressBlock, rail: 'hidden' })).toBe('hidden')
    expect(blockRail(customBlock)).toBe('hidden')
    // v3: the custom block's mobile pair names it on the collapsed rail too.
    expect(blockRail({ ...customBlock, mobile: { label: 'Tree', icon } })).toBe('icon')
    expect(blockRail({ ...customBlock, mobile: { label: 'Tree', icon }, rail: 'hidden' })).toBe(
      'hidden',
    )
  })

  test('mobile: a list is reachable from More by default, progress and custom are not', () => {
    expect(blockMobile(listBlock)).toBe('more')
    expect(blockMobile({ ...listBlock, mobile: 'hidden' })).toBe('hidden')
    expect(blockMobile(progressBlock)).toBe('hidden')
    expect(blockMobile({ ...progressBlock, mobile: 'more' })).toBe('more')
    expect(blockMobile(customBlock)).toBe('hidden')
    expect(blockMobile({ ...customBlock, mobile: { label: 'Tree', icon } })).toBe('more')
  })

  test('visible count honours max, and a max past the count changes nothing', () => {
    expect(blockVisibleCount(6, 3)).toBe(3)
    expect(blockVisibleCount(6, undefined)).toBe(6)
    expect(blockVisibleCount(2, 9)).toBe(2)
  })

  /** The fold keys are a consumer-readable contract: a rename resets every user's rail. */
  test('the fold keys namespace to sidebar-block:<id> / sidebar-section:<section id>', () => {
    expect(blockFoldKey('awaiting')).toBe('sidebar-block:awaiting')
    expect(slugifyLabel('  Awaiting Action! ')).toBe('awaiting-action')
    expect(sectionFoldKey(slugifyLabel('Tools & More'))).toBe('sidebar-section:tools-more')
  })
})

/** 2.x keyed by `sidebar-section:<slugifyLabel(label)>`; the codemod sets `id` to that slug. */
const legacySectionKey = (label: string): string => `sidebar-section:${slugifyLabel(label)}`

describe('fold keys hold across the 2.x to v3 move', () => {
  test('golden: every 2.x label maps to the same stored key through its codemod id', () => {
    const labels = [
      'Training',
      'Awaiting action',
      'Tools & More',
      '  Awaiting Action! ',
      'Q3 / 2026 Reports',
      'Ünïcode Ok',
    ]
    for (const label of labels)
      expect(sectionFoldKey(slugifyLabel(label))).toBe(legacySectionKey(label))
    expect(labels.map(slugifyLabel)).toEqual([
      'training',
      'awaiting-action',
      'tools-more',
      'awaiting-action',
      'q3-2026-reports',
      'n-code-ok',
    ])
  })

  test('slugifyLabel is idempotent, so an id that already is a slug keeps its key', () => {
    for (const label of ['awaiting-action', 'tools-more', 'q3-2026-reports']) {
      expect(slugifyLabel(label)).toBe(label)
    }
  })
})
