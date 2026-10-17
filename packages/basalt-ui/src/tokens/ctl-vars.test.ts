import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { CTL_HEIGHT_VARS, denseCtlCss } from './ctl-vars'

test('styles.css carries the dense tier generated from CTL_HEIGHT_VARS (scripts/gen-dense-css.ts)', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
  expect(css).toContain(denseCtlCss())
  for (const name of CTL_HEIGHT_VARS) expect(denseCtlCss()).toContain(name)
})
