import { afterEach, describe, expect, test } from 'bun:test'
import type { AnyRouter } from '@tanstack/react-router'
import { resetCommandStash } from '../commands/command-stash'
import { defineCommands } from '../commands/define-commands'
import { defineNav } from '../router-tanstack/nav'
import { buildSpotlightActions } from './spotlight-actions'

const router = { navigate: () => Promise.resolve() } as unknown as AnyRouter

function nav(): void {
  defineNav({
    groups: [
      {
        id: 'main',
        label: 'Main',
        items: [
          { id: 'home', label: 'Home', link: { to: '/' } },
          { id: 'about', label: 'About', link: { to: '/about' } },
        ],
      },
    ],
  } as never)
}

const navActions = (actions: ReturnType<typeof buildSpotlightActions>) =>
  actions.filter((a) => a.id?.startsWith('nav.'))

afterEach(resetCommandStash)

describe('buildSpotlightActions nav entries', () => {
  test('default label is the destination label', () => {
    nav()
    resetCommandStash()
    const labels = navActions(buildSpotlightActions(router, () => {})).map((a) => a.label)
    expect(labels).toEqual(['Home', 'About'])
  })

  test('navCommandLabel formats the generated labels', () => {
    nav()
    resetCommandStash()
    const labels = navActions(
      buildSpotlightActions(
        router,
        () => {},
        (item) => `Go to ${item.label}`,
      ),
    ).map((a) => a.label)
    expect(labels).toEqual(['Go to Home', 'Go to About'])
  })

  test('a registered nav.<id> command replaces the generated entry', () => {
    nav()
    defineCommands({ 'nav.home': { label: 'Jump home', run: () => {} } })
    const entries = navActions(buildSpotlightActions(router, () => {}))
    expect(entries.map((a) => [a.id, a.label])).toEqual([
      ['nav.home', 'Jump home'],
      ['nav.about', 'About'],
    ])
  })
})
