/**
 * `check-theme-css` — `tsShadowSites` names a shadow site by the component entry above it. The
 * theme spells an entry `X: ext<typeof X>({` (and, before it, `X: X.extend({`); both must resolve.
 */
import { describe, expect, test } from 'bun:test'
import { tsShadowSites } from './check-theme-css'

const BODY = (open: string) => `components: {
  ${open}
    styles: {
      root: {
        boxShadow: 'var(--vx-shadow-card)',
      },
    },
  }),
}`

describe('tsShadowSites', () => {
  test.each([
    ['ext form', 'Card: ext<typeof Card>({'],
    ['ext form, compound component', 'RadioGroup: ext<typeof Radio.Group>({'],
    ['legacy .extend form', 'Card: Card.extend({'],
  ])('%s resolves the component and slot', (_, open) => {
    const name = open.split(':')[0]!
    expect(tsShadowSites('theme/index.ts', BODY(open))).toEqual([
      { file: 'theme/index.ts', site: `${name}.styles.root` },
    ])
  })

  test('a site under no component entry falls back to its slot', () => {
    const text = `const x = {\n  root: {\n    boxShadow: 'var(--vx-shadow-card)',\n  },\n}`
    expect(tsShadowSites('theme/index.ts', text)).toEqual([
      { file: 'theme/index.ts', site: 'root' },
    ])
  })
})
