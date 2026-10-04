/**
 * Pins the sidebar's two vertical-inset rules against the shipped CSS text — same idiom as
 * `page-aside.module.css.test.ts`. The measured outcomes (footer bottom gap, first-row offset
 * expanded vs rail) live in `tests/layout/shell-chrome.layout.test.ts`; these are the source facts
 * a browser-less run can still hold.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'app-sidebar.module.css'),
  'utf8',
).replaceAll(/\/\*[\s\S]*?\*\//g, '')

/** The body of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replaceAll(/[.[\]=>:]/g, String.raw`\$&`)
  return css.match(new RegExp(String.raw`(?:^|\n)\s*${escaped}\s*\{([^}]+)\}`))?.[1] ?? ''
}

describe('app-sidebar.module.css — vertical insets', () => {
  it('the footer ends one side inset above the navbar bottom', () => {
    expect(rule('.footer')).toMatch(/padding-bottom:\s*var\(--vx-space-row-inset-x\);/)
  })

  it('the rail still zeroes every band margin, then restores the FIRST band alone', () => {
    expect(rule('.root[data-collapsed] .sectionBand')).toMatch(/margin-bottom:\s*0;/)
    expect(rule('.root[data-collapsed] .nav > div:first-child > .sectionBand')).toMatch(
      /margin-bottom:\s*var\(--vx-space-sidebar-section-label-gap\);/,
    )
  })

  it('the expanded band carries the same token, so the first row has one offset in both forms', () => {
    expect(rule('.sectionBand')).toMatch(
      /margin-bottom:\s*var\(--vx-space-sidebar-section-label-gap\);/,
    )
  })
})
