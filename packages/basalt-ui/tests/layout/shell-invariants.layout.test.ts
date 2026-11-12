/**
 * `expectShellInvariants` against the real v3 shell in a browser: it passes on the shell-chrome
 * scenario (rail, settings and account rows) in both rail states at 1800x1200 and 390x844, and it
 * fails when one offender is seeded into the footer.
 *
 * The seeded offender rewrites the footer's bottom padding to 2 px, below the rail's horizontal
 * padding, which is the shutterflow defect the footer-inset rule was written for.
 *
 * v3 only: the 2.x oracle has no `AppShell`.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { expectShellInvariants } from '../../src/testing/shell-invariants'
import type { ShellInvariantsPage } from '../../src/testing/shell-invariants'
import type { ShellChromeSpec } from './fixture/v3/scenarios/shell-chrome'
import { providedSlots } from './fixture/v3/registry'
import { closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'
import { LAYOUT_TARGET } from './shell-slots'
import { acquireShellTarget } from './shell-target'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const runnable =
  ready &&
  LAYOUT_TARGET === 'v3' &&
  ['shell-rail', 'shell-rail-footer', 'shell-rail-row', 'shell-header'].every((name) =>
    providedSlots().has(name),
  )
const layout = runnable ? describe : describe.skip

const DESKTOP_1800: Viewport = { name: 'desktop 1800', width: 1800, height: 1200 }
const PHONE_390: Viewport = { name: 'phone 390', width: 390, height: 844 }

const SPEC: ShellChromeSpec = {
  sections: [
    {
      label: '',
      items: [
        { key: 'home', label: 'Home', mobile: 'tab' },
        { key: 'runs', label: 'Runs', mobile: 'tab' },
        { key: 'jobs', label: 'Jobs', mobile: 'tab' },
        { key: 'reports', label: 'Reports', mobile: 'more' },
      ],
    },
  ],
  sidebar: { account: true, settings: 1 },
}

layout('expectShellInvariants — real shell', () => {
  for (const viewport of [DESKTOP_1800, PHONE_390]) {
    test(`holds in both rail states at ${viewport.width}x${viewport.height}`, async () => {
      const p = await openFixture(SPEC, viewport)
      await expectShellInvariants(p.raw as ShellInvariantsPage, {
        states: ['expanded', 'collapsed'],
      })
    })
  }

  test('fails on a seeded 2 px footer inset', async () => {
    const p = await openFixture(SPEC, DESKTOP_1800)
    await p.raw.addStyleTag({
      content: '[data-slot="shell-rail-footer"]{padding-bottom:2px !important}',
    })
    let message = ''
    try {
      await expectShellInvariants(p.raw as ShellInvariantsPage, { states: ['expanded'] })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('bottom inset')
  })
})
