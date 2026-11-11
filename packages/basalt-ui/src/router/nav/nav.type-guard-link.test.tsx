// Row 14 of the 2.x guard: the item's `link` spreads into `<Link>` with no cast. JSX, because
// `createElement(Link, { ...link })` rejects the VALID spread while accepting `{ to: '/nope' }`:
// only JSX instantiates `LinkComponent`'s generics the way a consumer's call site does. Checked by
// `tsconfig.nav-guard.json` together with `nav.type-guard.test.ts` (which owns the registered router).
import { Link } from '@tanstack/react-router'
import { expect, test } from 'bun:test'
import { NAV } from './nav.type-guard.test'

export const itemLink = () => <Link {...NAV.sections[0].items[1].link}>Gallery</Link>
// @ts-expect-error '/nope' is not a registered route path
export const badLink = () => <Link to="/nope">Nope</Link>

test('the link of an item is a plain options object', () => {
  expect(NAV.sections[0].items[1].link).toEqual({ to: '/gallery' })
})
