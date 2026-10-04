/**
 * Pins the header leading zone's `--basalt-shell-lead-inset` contract against the shipped CSS text —
 * same "assert directly against the CSS" idiom as `page-aside.module.css.test.ts`. The geometry
 * itself (toggle right of the traffic lights, unclipped, default path unmoved) is measured in a real
 * browser by `tests/layout/shell-chrome.layout.test.ts`; this file holds the parts that need no
 * browser: the exact expressions, so an unset property provably resolves to today's numbers.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'

const DIR = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(DIR, 'app-brand.module.css'), 'utf8').replaceAll(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of the first rule whose selector is exactly `selector`, whitespace-collapsed. */
function declarations(selector: string): Map<string, string> {
  const escaped = selector.replaceAll(/[.[\]=]/g, String.raw`\$&`)
  const body = css.match(new RegExp(String.raw`(?:^|\n)\s*${escaped}\s*\{([^}]+)\}`))?.[1] ?? ''
  const map = new Map<string, string>()
  for (const line of body.split(';')) {
    const at = line.indexOf(':')
    if (at === -1) continue
    map.set(
      line.slice(0, at).trim(),
      line
        .slice(at + 1)
        .replaceAll(/\s+/g, ' ')
        .trim(),
    )
  }
  return map
}

describe('app-brand.module.css — the --basalt-shell-lead-inset contract', () => {
  const zone = declarations('.zone')
  const rail = declarations('.zone[data-collapsed]')

  it('unset, the zone is exactly the navbar offset wide', () => {
    // max(offset, 0px + 28px): the rail (48) and the expanded width (256) both clear the toggle.
    expect(zone.get('--basalt-shell-zone-width')).toBe(
      'max( var(--app-shell-navbar-offset, 0rem), calc(var(--basalt-shell-lead-inset, 0px) + ' +
        'var(--basalt-shell-toggle-size)) )',
    )
    expect(zone.get('flex')).toBe('0 0 var(--basalt-shell-zone-width)')
    expect(zone.get('width')).toBe('var(--basalt-shell-zone-width)')
  })

  it('unset, the inline padding is the shell padding on both sides', () => {
    expect(zone.get('padding-inline')).toBe('var(--app-shell-padding, 0px)')
    expect(zone.get('padding-inline-start')).toBe(
      'calc(var(--app-shell-padding, 0px) + var(--basalt-shell-lead-inset, 0px))',
    )
  })

  it('the lead inset defaults to 0px at every read — the property is never given a non-zero default', () => {
    const reads = [...css.matchAll(/var\(--basalt-shell-lead-inset([^)]*)\)/g)]
    expect(reads.length).toBeGreaterThan(0)
    for (const read of reads) expect(read[1]).toBe(', 0px')
  })

  it('the rail keeps only the inset as padding, so the toggle sits right of the title-bar controls', () => {
    expect(rail.get('padding-inline')).toBe('var(--basalt-shell-lead-inset, 0px) 0')
  })

  it("the toggle floor is the collapse toggle's real size (app-brand.tsx size={28} = 1.75rem)", () => {
    const tsx = readFileSync(resolve(DIR, 'app-brand.tsx'), 'utf8')
    const px = Number(tsx.match(/size=\{(\d+)\}/)?.[1])
    expect(px).toBe(28)
    expect(zone.get('--basalt-shell-toggle-size')).toBe(
      `calc(${px / 16}rem * var(--mantine-scale, 1))`,
    )
  })
})
