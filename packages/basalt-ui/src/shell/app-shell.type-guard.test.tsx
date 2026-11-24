// The `AppShell` half of the nav type guard. Checked by `tsconfig.nav-guard.json` beside
// `nav.type-guard.test.ts`, which registers the router these fixtures resolve against; it lives
// here because `src/router/nav` may not import the shell. Each row is the compile-time promise the
// shipped rule makes: a badge key, a route target and the nav object itself are checked.
import { linkOptions } from '@tanstack/react-router'
import { expect, test } from 'bun:test'
import { defineNav } from '../router/nav/define-nav'
import { NAV } from '../router/nav/nav.type-guard.test'
import { navTarget } from '../router/nav-target'
import type { NavTargetOptions } from '../router/nav-target'
import { AppShell } from './app-shell'
import type { AppShellProps } from './contract'

const brand = { name: 'Basalt' }

// ── 1. badges are keyed by the nav's own item ids ────────────────────────────────────────────────

export const knownBadges = () => (
  <AppShell nav={NAV} brand={brand} badges={{ gal: { count: 2 }, 'table-detail': { dot: true } }} />
)
export const typoBadge = () => (
  <AppShell
    nav={NAV}
    brand={brand}
    badges={{
      // @ts-expect-error 'galery' names no item of NAV
      galery: { count: 2 },
    }}
  />
)

// ── 2. a hand-written nav object is not a `defineNav` result ──────────────────────────────────────

const HAND = {
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [{ id: 'gal', label: 'Gallery', link: { to: '/gallery' } }],
    },
  ],
}
// @ts-expect-error the brand only `defineNav` sets is missing
export const handWritten = () => <AppShell nav={HAND} brand={brand} />
// @ts-expect-error the props type refuses it too
export const handWrittenProps: AppShellProps = { nav: HAND, brand }

// ── 3. a `navTarget` is checked against the registered route tree ──────────────────────────────────

export const goodTarget = navTarget(linkOptions({ to: '/gallery' }))
// @ts-expect-error '/nope' is not a registered route path
export const badTarget = navTarget({ to: '/nope' })
// Without `Register` (an `any` tree) the only accepted value is the fix-it string.
// oxlint-disable-next-line typescript/no-explicit-any
export const unregisteredTarget: NavTargetOptions<{ to: '/gallery' }, any> =
  'basalt: declare Register { router }'
// @ts-expect-error un-registered: options are refused
// oxlint-disable-next-line typescript/no-explicit-any
export const unregisteredRejects: NavTargetOptions<{ to: '/gallery' }, any> = { to: '/gallery' }

// ── 4. the documented `mobile: true` item reaches the shell unchanged ────────────────────────────────

const PHONE = defineNav({
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [
        { id: 'gal', label: 'Gallery', link: linkOptions({ to: '/gallery' }), mobile: true },
        { id: 'cards', label: 'Cards', link: linkOptions({ to: '/cards' }), mobile: false },
      ],
    },
  ],
})
export const mobileTrue = () => (
  <AppShell nav={PHONE} brand={brand} badges={{ gal: { dot: true } }} />
)

test('the fixtures are plain values (the checks are tsc)', () => {
  expect(PHONE.sections[0].items[0].mobile).toBe(true)
  expect(goodTarget).toBeDefined()
})
