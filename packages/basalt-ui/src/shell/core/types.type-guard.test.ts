/**
 * The core reads the frozen shell contract through its own structural shapes. These rows fail tsc
 * the moment a contract type stops fitting the core, which is when the frame could no longer hand
 * its props to the projector unchanged.
 */
import { expect, test } from 'bun:test'
import type { GlobalAction, NavBadges, NavConfig, SidebarBlock } from '../contract'
import type { CoreBlock } from './block-model'
import type { HeaderTierItem } from './header-tiers'
import type { BadgeMap, CoreNavConfig } from './types'

type Assert<T extends true> = T
type Fits<A, B> = [A] extends [B] ? true : false

export type ContractNavFits = Assert<Fits<NavConfig, CoreNavConfig>>
export type ContractBlockFits = Assert<Fits<SidebarBlock, CoreBlock>>
export type ContractBadgesFit = Assert<Fits<NavBadges<'a' | 'b'>, BadgeMap>>
export type GlobalActionIsTierItem = Assert<Fits<GlobalAction, HeaderTierItem>>

// @ts-expect-error a section without an id has no fold key
export const sectionNeedsId: CoreNavConfig = { sections: [{ label: 'S', items: [] }] }

test('the contract fits the core (checked by tsc)', () => {
  expect(true).toBe(true)
})
