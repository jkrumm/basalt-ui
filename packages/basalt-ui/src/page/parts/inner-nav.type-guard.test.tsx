/**
 * Compile-time proof of `InnerNav`'s guarantees, checked by `tsc --noEmit`. Every `@ts-expect-error`
 * is one "never": remove the line and the file stops compiling. The valid usage above each group
 * proves the guard fails for the stated reason and not because the props are wrong everywhere.
 */
import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { ControlHandle } from '../../core/ports'
import type { InnerNavMenuItem, PushField } from '../contract'
import { InnerNav } from './inner-nav'
import { pushField } from './inner-nav.test-support'

const state = pushField(['general', 'billing'] as const, 'general', 'section')

/** A replace-history field: same handle, `history: 'replace'`. */
const replaceField: ControlHandle<'general' | 'billing'> & { readonly history: 'replace' } = {
  ...state,
  history: 'replace',
}

const item = (id: string): InnerNavMenuItem => ({ id, label: id, onSelect: () => {} })

export const validPush: ReactElement = (
  <InnerNav
    label="Settings"
    state={state}
    groups={[{ id: 'a', label: 'A', items: [{ id: 'general', label: 'General' }] }]}
  />
)

export const replaceInInnerNav: ReactElement = (
  <InnerNav
    label="Settings"
    // @ts-expect-error a replace-history field cannot back an inner nav: Back would skip sections
    state={replaceField}
    groups={[]}
  />
)

const asPush: PushField<'general' | 'billing'> = state
export const typedPush: ReactElement = <InnerNav label="Settings" state={asPush} groups={[]} />

export const validMenu: ReactElement = (
  <InnerNav
    label="Settings"
    state={state}
    groups={[
      {
        id: 'a',
        label: 'A',
        items: [{ id: 'general', label: 'General', menu: [item('export'), item('reset')] }],
      },
    ]}
  />
)

export const oneItemMenu: ReactElement = (
  <InnerNav
    label="Settings"
    state={state}
    groups={[
      {
        id: 'a',
        label: 'A',
        // @ts-expect-error a menu holds two or more actions; one is a plain button
        items: [{ id: 'general', label: 'General', menu: [item('export')] }],
      },
    ]}
  />
)

export const withoutLabel: ReactElement = (
  // @ts-expect-error a nav is named by its label
  <InnerNav state={state} groups={[]} />
)

describe('inner nav type guard', () => {
  test('compiles (the assertions are the @ts-expect-error lines)', () => {
    expect(true).toBe(true)
  })
})
