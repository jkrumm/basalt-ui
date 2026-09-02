/**
 * Unit tests for checkSource — the pure (text, relPath, cfg) → Finding[] core.
 *
 * Covers all 26 guard kinds. Co-located with the guard, excluded from tsc
 * (tsconfig exclude: src/**\/*.test.ts), run via `bun test`.
 *
 * The walker/reporter half is covered by the integration test in
 * src/cli/check-theme.test.ts (temp-dir + exit-code contract).
 */
import { describe, expect, it } from 'bun:test'
import { pxRem } from '../tokens'
import { SPACE_SCALE } from '../tokens/palette'
import {
  checkSource,
  DEFAULT_GUARD_CONFIG,
  findAllowAnnotations,
  GENERATED_HEADER_LINE,
  guardKindRemedy,
  guardWaiverHint,
  GUARD_RULES,
  neutralizeAllowAnnotation,
  NEUTRALIZED_ALLOW_TOKEN,
  PLUGIN_RULE_IDS,
  TOKENS_ONLY_DISABLED_KINDS,
  unmatchedExemptPatterns,
} from './index'
import type { Finding, GuardConfig, GuardKind } from './types'

const PATH = 'src/Dashboard.tsx'
const CHART_PATH = 'src/charts/kinds/Foo.tsx'

function kinds(findings: Finding[]): GuardKind[] {
  return findings.map((f) => f.kind)
}

function find(text: string, relPath = PATH) {
  return checkSource(text, relPath, DEFAULT_GUARD_CONFIG)
}

// ── 1. raw-hex ────────────────────────────────────────────────────────────────

describe('raw-hex', () => {
  it('flags a 6-digit hex literal', () => {
    const f = find(`const c = '#a3b4c5'`)
    expect(kinds(f)).toContain('raw-hex')
    expect(f.find((x) => x.kind === 'raw-hex')?.token).toBe('#a3b4c5')
  })

  it('flags a 3-digit hex literal', () => {
    const f = find(`const c = '#abc'`)
    expect(kinds(f)).toContain('raw-hex')
  })

  it('reports correct line number', () => {
    const f = find(`line one\nconst c = '#ff0000'\nline three`)
    const hit = f.find((x) => x.kind === 'raw-hex')
    expect(hit?.line).toBe(2)
  })

  it('does NOT flag a line with a theme-allow comment', () => {
    const f = find(`const c = '#ff0000' // theme-allow: legacy`)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('does NOT flag a pure line comment mentioning a hex', () => {
    const f = find(`// use #ff0000 from the palette`)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  /**
   * Round 9, rollhook: `&#123;` / `&#125;` — the escaped braces an Astro template writes to show a
   * literal `${…}` in prose — were read as the hex colors `#123` / `#125`, and 4 findings blocked a
   * release on a page with no color in it at all. The hole was in the KIND, not in the extension:
   * the same string produced the same two findings in `.html`, `.tsx`, `.css` and `.vue`.
   */
  describe('HTML numeric character references', () => {
    const ENTITIES = `<p>image: $&#123;IMAGE_TAG&#125;</p>`

    for (const rel of [
      'index.html',
      'src/App.tsx',
      'src/a.css',
      'src/Hero.vue',
      'src/pages/index.astro',
    ]) {
      it(`does NOT read &#123;/&#125; as a hex color in ${rel}`, () => {
        expect(kinds(find(ENTITIES, rel))).not.toContain('raw-hex')
      })
    }

    // The exemption is the ENTITY, never the file type — a template that hardcodes a color is
    // exactly what making `.astro`/`.vue` scannable was for.
    it('still flags a real hex in an .astro file', () => {
      const f = find(`<div style="color: #ff0000">x</div>`, 'src/pages/index.astro')
      expect(kinds(f)).toContain('raw-hex')
      expect(f.find((x) => x.kind === 'raw-hex')?.token).toBe('#ff0000')
    })

    it('still flags a real hex in a .vue file', () => {
      const f = find(`<style>\n  .hero { color: #ff0000; }\n</style>`, 'src/Hero.vue')
      expect(kinds(f)).toContain('raw-hex')
      expect(f.find((x) => x.kind === 'raw-hex')?.token).toBe('#ff0000')
    })

    it('flags a hex after a bare & — an entity needs its terminating semicolon', () => {
      expect(kinds(find(`<p>a&#fff b</p>`, 'index.html'))).toContain('raw-hex')
    })

    it('flags a plain #123 with no entity around it', () => {
      expect(kinds(find(`const c = '#123'`))).toContain('raw-hex')
    })

    // The neighbouring raw-text kinds were checked for the same blind spot and do NOT share it: a
    // character reference contains no `(`, so `raw-color-fn`'s `rgba?|hsla?\(` anchor cannot occur
    // inside one, and every other raw-text kind anchors on a property name, `var(`, or a JSX `=`.
    it('leaves the sibling color kinds unchanged — nothing else fires inside an entity', () => {
      const src = `<p>&amp; &mdash; &nbsp; &#8212; &hellip; &#x1F600; &copy;</p>`
      expect(find(src, 'index.html')).toHaveLength(0)
    })
  })
})

// ── 2. raw-color-fn ──────────────────────────────────────────────────────────

describe('raw-color-fn', () => {
  it('flags rgba()', () => {
    const f = find(`const c = rgba(255, 0, 0, 0.5)`)
    expect(kinds(f)).toContain('raw-color-fn')
    expect(f.find((x) => x.kind === 'raw-color-fn')?.token).toBe('rgba(')
  })

  it('flags rgb()', () => {
    const f = find(`const c = rgb(10, 20, 30)`)
    expect(kinds(f)).toContain('raw-color-fn')
  })

  it('flags hsl()', () => {
    const f = find(`fill: hsl(200, 50%, 50%)`)
    expect(kinds(f)).toContain('raw-color-fn')
  })

  it('flags hsla()', () => {
    const f = find(`fill: hsla(200, 50%, 50%, 0.5)`)
    expect(kinds(f)).toContain('raw-color-fn')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`const c = rgba(0,0,0,0.5) // theme-allow`)
    expect(kinds(f)).not.toContain('raw-color-fn')
  })

  it('does NOT flag rgba() mentioned inside a real block comment', () => {
    const f = find('/*\n * use rgba() for opacity\n */')
    expect(kinds(f)).not.toContain('raw-color-fn')
  })
})

// ── 3. localstorage-theme ────────────────────────────────────────────────────

describe('localstorage-theme', () => {
  it('flags localStorage.getItem("theme")', () => {
    const f = find(`const t = localStorage.getItem('theme')`)
    expect(kinds(f)).toContain('localstorage-theme')
  })

  it('flags with double quotes', () => {
    const f = find(`const t = localStorage.getItem("theme")`)
    expect(kinds(f)).toContain('localstorage-theme')
  })

  it('flags with whitespace around getItem call', () => {
    const f = find(`localStorage . getItem ( 'theme' )`)
    expect(kinds(f)).toContain('localstorage-theme')
  })

  it('does NOT flag localStorage.getItem("other-key")', () => {
    const f = find(`localStorage.getItem('colorMode')`)
    expect(kinds(f)).not.toContain('localstorage-theme')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`localStorage.getItem('theme') // theme-allow: legacy`)
    expect(kinds(f)).not.toContain('localstorage-theme')
  })
})

// ── 4. off-identity-accent ───────────────────────────────────────────────────

describe('off-identity-accent', () => {
  it('flags a forbidden color prop (teal)', () => {
    const f = find(`<Badge color="teal" />`)
    expect(kinds(f)).toContain('off-identity-accent')
    expect(f.find((x) => x.kind === 'off-identity-accent')?.token).toBe('teal')
  })

  it('flags c="violet"', () => {
    const f = find(`<Button c="violet" />`)
    expect(kinds(f)).toContain('off-identity-accent')
  })

  it('flags bg="grape"', () => {
    const f = find(`<Box bg="grape" />`)
    expect(kinds(f)).toContain('off-identity-accent')
  })

  it('flags backgroundColor="indigo"', () => {
    const f = find(`<Box backgroundColor="indigo" />`)
    expect(kinds(f)).toContain('off-identity-accent')
  })

  it('does NOT flag color="blue" (allowed)', () => {
    const f = find(`<Badge color="blue" />`)
    expect(kinds(f)).not.toContain('off-identity-accent')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Badge color="teal" /> // theme-allow: design exception`)
    expect(kinds(f)).not.toContain('off-identity-accent')
  })
})

// ── 4b. mantine-shade-index ──────────────────────────────────────────────────

describe('mantine-shade-index', () => {
  it('flags a shade-pinned text color (c="yellow.7")', () => {
    const f = find(`<Text c="yellow.7">stale</Text>`)
    expect(kinds(f)).toContain('mantine-shade-index')
  })

  it('flags bg="blue.4" and color="red.6"', () => {
    expect(kinds(find(`<Box bg="blue.4" />`))).toContain('mantine-shade-index')
    expect(kinds(find(`<ThemeIcon color="red.6" />`))).toContain('mantine-shade-index')
  })

  it('flags the var() form for a non-surface hue', () => {
    const f = find(`const a = { color: 'var(--mantine-color-yellow-7)' }`)
    expect(kinds(f)).toContain('mantine-shade-index')
  })

  it('flags the var() form in a .css file too — unlike the prop-only kinds', () => {
    const f = find(`.a { color: var(--mantine-color-red-6); }`, 'src/app.css')
    expect(kinds(f)).toContain('mantine-shade-index')
  })

  // The two kinds partition the space: gray/dark var() steps are surface color and belong to
  // off-system-surface-var, so a single violation must never report under both.
  it('leaves gray/dark var() steps to off-system-surface-var', () => {
    const f = find(`const a = { background: 'var(--mantine-color-gray-3)' }`)
    expect(kinds(f)).toContain('off-system-surface-var')
    expect(kinds(f)).not.toContain('mantine-shade-index')
  })

  it('does NOT flag a bare status hue — it resolves per scheme, which is the point', () => {
    expect(kinds(find(`<Text c="red">down</Text>`))).not.toContain('mantine-shade-index')
    expect(kinds(find(`<ThemeIcon color="green" />`))).not.toContain('mantine-shade-index')
  })

  it('does NOT flag c="dimmed" or a token ref', () => {
    expect(kinds(find(`<Text c="dimmed">age</Text>`))).not.toContain('mantine-shade-index')
    expect(kinds(find(`<Text c={VX.status.warn}>age</Text>`))).not.toContain('mantine-shade-index')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Text c="yellow.7" /> // theme-allow: design exception`)
    expect(kinds(f)).not.toContain('mantine-shade-index')
  })

  it('is disabled by the mantineShadeIndex knob', () => {
    const f = checkSource(`<Text c="yellow.7" />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      mantineShadeIndex: false,
    })
    expect(kinds(f)).not.toContain('mantine-shade-index')
  })

  // The grace-minor doctrine (package CLAUDE.md): a kind that rejects previously-passing code
  // lands as `warn` for one minor, then its GRACE_PERIOD_KINDS entry is deleted and it becomes an
  // error. This one ran its grace across FOUR minors — introduced 1.7.0, then deferred by 1.8.0
  // (shipped the same day as 1.7.0), 1.9.0 (carried the chart-layer batch the same consumer was
  // waiting on) and 1.10.0 (shipped without the promotion at all). Promoted in 1.11.0, verified
  // against the only consumer first: argo's `check-theme` reports zero violations of any kind, so
  // the promotion breaks nothing that was passing.
  it('is an error now that its grace period has ended', () => {
    const f = find(`<Text c="yellow.7" />`)
    expect(f.find((x) => x.kind === 'mantine-shade-index')?.severity).toBe('error')
  })
})

// ── 5. raw-spacing ───────────────────────────────────────────────────────────

describe('raw-spacing', () => {
  // Interpolated from the real scale, never typed as literals: the previous versions of these tests
  // hardcoded 16 and 12 and so PASSED against a guard whose step list had gone stale — they encoded
  // the drift instead of catching it.
  it('flags a prop value equal to a scale step', () => {
    expect(kinds(find(`<Box p={${SPACE_SCALE.md}} />`))).toContain('raw-spacing')
    expect(kinds(find(`<Stack gap={${SPACE_SCALE.sm}} />`))).toContain('raw-spacing')
  })

  it('does NOT flag p={8} (sub-scale micro-spacing, no token to prefer)', () => {
    const f = find(`<Box p={8} />`)
    expect(kinds(f)).not.toContain('raw-spacing')
  })

  it('does NOT flag p="md" (string token)', () => {
    const f = find(`<Box p="md" />`)
    expect(kinds(f)).not.toContain('raw-spacing')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Box p={${SPACE_SCALE.md}} /> // theme-allow`)
    expect(kinds(f)).not.toContain('raw-spacing')
  })
})

// ── 6. raw-radius ────────────────────────────────────────────────────────────

describe('raw-radius', () => {
  it('flags radius={8}', () => {
    const f = find(`<Card radius={8} />`)
    expect(kinds(f)).toContain('raw-radius')
  })

  it('flags radius="4"', () => {
    const f = find(`<Card radius="4" />`)
    expect(kinds(f)).toContain('raw-radius')
  })

  it('does NOT flag radius="md"', () => {
    const f = find(`<Card radius="md" />`)
    expect(kinds(f)).not.toContain('raw-radius')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Card radius={8} /> // theme-allow`)
    expect(kinds(f)).not.toContain('raw-radius')
  })
})

// ── 7. raw-surface ───────────────────────────────────────────────────────────

describe('raw-surface', () => {
  it('flags an inline border literal', () => {
    const f = find(`<div style={{ border: '1px solid #ccc' }} />`)
    expect(kinds(f)).toContain('raw-surface')
  })

  it('flags a numeric borderRadius', () => {
    const f = find(`<div style={{ borderRadius: 8 }} />`)
    expect(kinds(f)).toContain('raw-surface')
  })

  it('flags a boxShadow literal', () => {
    const f = find(`<div style={{ boxShadow: '0 1px 3px black' }} />`)
    expect(kinds(f)).toContain('raw-surface')
  })

  it('does NOT flag a var(--…) border token', () => {
    const f = find(`<Box style={{ border: '1px solid var(--vx-surface-border)' }} />`)
    expect(kinds(f)).not.toContain('raw-surface')
  })

  it('does NOT flag a var(--…) boxShadow token', () => {
    const f = find(`<div style={{ boxShadow: 'var(--mantine-shadow-sm)' }} />`)
    expect(kinds(f)).not.toContain('raw-surface')
  })

  it('does NOT flag a ${…}-composed border (token-driven, e.g. VX.divider)', () => {
    const f = find('const s = { borderLeft: `2px solid ${VX.divider}` }')
    expect(kinds(f)).not.toContain('raw-surface')
  })

  it('does NOT flag a ${…}-composed boxShadow (VX.shadowCard + a token ring)', () => {
    const f = find(
      'const s = { boxShadow: `${VX.shadowCard}, 0 0 0 1px ${alpha(VX.status.bad, 0.25)}` }',
    )
    expect(kinds(f)).not.toContain('raw-surface')
  })

  it('does NOT flag a border reset keyword (none/transparent)', () => {
    expect(kinds(find(`<button style={{ border: 'none' }} />`))).not.toContain('raw-surface')
    expect(kinds(find(`<div style={{ border: 'transparent' }} />`))).not.toContain('raw-surface')
  })

  it('STILL flags a genuinely raw ${…}-free literal border/shadow', () => {
    // A template literal escapes only because its color is separately caught by raw-hex/raw-color-fn;
    // a plain quoted literal has no such backstop, so it must still fire.
    expect(kinds(find(`<div style={{ border: '2px solid red' }} />`))).toContain('raw-surface')
    expect(kinds(find(`<div style={{ boxShadow: '0 2px 4px rgba(0,0,0,.1)' }} />`))).toContain(
      'raw-surface',
    )
  })

  it('does NOT flag when rawSurface is false', () => {
    const f = checkSource(`<div style={{ borderRadius: 8 }} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      rawSurface: false,
    })
    expect(kinds(f)).not.toContain('raw-surface')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<div style={{ borderRadius: 8 }} /> // theme-allow`)
    expect(kinds(f)).not.toContain('raw-surface')
  })
})

// ── 8. off-system-surface-var ─────────────────────────────────────────────────

describe('off-system-surface-var', () => {
  it('flags a raw Mantine gray ramp step', () => {
    const f = find(`<Box style={{ color: 'var(--mantine-color-gray-3)' }} />`)
    expect(kinds(f)).toContain('off-system-surface-var')
  })

  it('flags a raw Mantine dark ramp step', () => {
    const f = find(`<Box bg="var(--mantine-color-dark-6)" />`)
    expect(kinds(f)).toContain('off-system-surface-var')
  })

  it('does NOT flag a --vx-surface-* token', () => {
    const f = find(`<Box bg="var(--vx-surface-panel)" />`)
    expect(kinds(f)).not.toContain('off-system-surface-var')
  })

  it('does NOT flag a named Mantine var (not a ramp step)', () => {
    const f = find(`<Box bg="var(--mantine-color-default-border)" />`)
    expect(kinds(f)).not.toContain('off-system-surface-var')
  })

  it('does NOT flag when offSystemSurfaceVar is false', () => {
    const f = checkSource(`<Box bg="var(--mantine-color-gray-3)" />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      offSystemSurfaceVar: false,
    })
    expect(kinds(f)).not.toContain('off-system-surface-var')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Box bg="var(--mantine-color-gray-3)" /> // theme-allow`)
    expect(kinds(f)).not.toContain('off-system-surface-var')
  })
})

// ── 9. raw-html-layout ───────────────────────────────────────────────────────

describe('raw-html-layout', () => {
  it('flags a raw <div> with inline display:flex', () => {
    const f = find(`<div style={{ display: 'flex', gap: 8 }} />`)
    expect(kinds(f)).toContain('raw-html-layout')
  })

  it('flags a raw <section> with inline padding', () => {
    const f = find(`<section style={{ padding: 16 }}>x</section>`)
    expect(kinds(f)).toContain('raw-html-layout')
  })

  it('does NOT flag a bare <div> without style', () => {
    const f = find(`<div ref={r} className="x" />`)
    expect(kinds(f)).not.toContain('raw-html-layout')
  })

  it('does NOT flag an <img> (not a layout element)', () => {
    const f = find(`<img style={{ width: 40 }} src="a.png" />`)
    expect(kinds(f)).not.toContain('raw-html-layout')
  })

  it('does NOT flag when rawHtmlLayout is false', () => {
    const f = checkSource(`<div style={{ display: 'flex' }} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      rawHtmlLayout: false,
      inlineDisplay: false,
    })
    expect(kinds(f)).not.toContain('raw-html-layout')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<div style={{ display: 'flex' }} /> // theme-allow`)
    expect(kinds(f)).not.toContain('raw-html-layout')
  })

  it('does NOT flag a raw <div> with inline display:flex in a chart file — the Flex/Grid/Group remedy is @mantine/*, banned in the Mantine-free chart layer', () => {
    const f = find(`<div style={{ display: 'flex', gap: 8 }} />`, CHART_PATH)
    expect(kinds(f)).not.toContain('raw-html-layout')
  })

  it('still flags the same literal in a non-chart path (the check is not globally weakened)', () => {
    const f = find(`<div style={{ display: 'flex', gap: 8 }} />`, PATH)
    expect(kinds(f)).toContain('raw-html-layout')
  })
})

// ── 10. inline-spacing ───────────────────────────────────────────────────────

describe('inline-spacing', () => {
  it('flags padding: 16', () => {
    const f = find(`<Box style={{ padding: 16 }} />`)
    expect(kinds(f)).toContain('inline-spacing')
  })

  it('flags marginTop: "12px"', () => {
    const f = find(`<Box style={{ marginTop: '12px' }} />`)
    expect(kinds(f)).toContain('inline-spacing')
  })

  it('does NOT flag padding: 0', () => {
    const f = find(`<Box style={{ padding: 0 }} />`)
    expect(kinds(f)).not.toContain('inline-spacing')
  })

  it('does NOT flag a var(--…) gap token', () => {
    const f = find(`<Box style={{ gap: 'var(--mantine-spacing-md)' }} />`)
    expect(kinds(f)).not.toContain('inline-spacing')
  })

  it('does NOT flag when inlineSpacing is false', () => {
    const f = checkSource(`<Box style={{ padding: 16 }} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      inlineSpacing: false,
    })
    expect(kinds(f)).not.toContain('inline-spacing')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Box style={{ padding: 16 }} /> // theme-allow`)
    expect(kinds(f)).not.toContain('inline-spacing')
  })
})

// ── 10b. Finding.text ─────────────────────────────────────────────────────────
//
// `token` stays the regex match (e.g. the unit-less numeric part of a spacing declaration);
// `text` is the full trimmed source line, so a human reading the report sees `padding: 0.75rem;`
// rather than the confusing partial match `padding: 0.75`.

describe('Finding.text', () => {
  it('reports text as the full trimmed source line while token stays the truncated match', () => {
    const f = checkSource(
      '.foo {\n  padding: 0.75rem;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    const hit = f.find((x) => x.kind === 'inline-spacing')
    expect(hit?.token).toBe('padding: 0.75')
    expect(hit?.text).toBe('padding: 0.75rem;')
  })

  it('reports the whole declaration including the unit for a CSS padding-left finding', () => {
    const f = checkSource('padding-left: 1.25rem;', 'src/Card.module.css', DEFAULT_GUARD_CONFIG)
    const hit = f.find((x) => x.kind === 'inline-spacing')
    expect(hit?.token).toBe('padding-left: 1.25')
    expect(hit?.text).toBe('padding-left: 1.25rem;')
  })

  it('truncates a line over 100 characters with a trailing …', () => {
    const filler = 'x'.repeat(200)
    const f = checkSource(
      `padding: 16px; /* ${filler} */`,
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    const hit = f.find((x) => x.kind === 'inline-spacing')
    expect(hit?.text.length).toBe(101)
    expect(hit?.text.endsWith('…')).toBe(true)
  })

  it('trims a leading-indented line', () => {
    const f = checkSource('    padding: 16px;', 'src/Card.module.css', DEFAULT_GUARD_CONFIG)
    const hit = f.find((x) => x.kind === 'inline-spacing')
    expect(hit?.text).toBe('padding: 16px;')
  })
})

// ── 11. inline-display ───────────────────────────────────────────────────────

describe('inline-display', () => {
  it('flags display: "flex"', () => {
    const f = find(`<Box style={{ display: 'flex' }} />`)
    expect(kinds(f)).toContain('inline-display')
  })

  it('flags display: "grid"', () => {
    const f = find(`<Box style={{ display: "grid" }} />`)
    expect(kinds(f)).toContain('inline-display')
  })

  it('flags display: "inline-flex"', () => {
    const f = find(`<Box style={{ display: 'inline-flex' }} />`)
    expect(kinds(f)).toContain('inline-display')
  })

  it('does NOT flag display: "block"', () => {
    const f = find(`<Box style={{ display: 'block' }} />`)
    expect(kinds(f)).not.toContain('inline-display')
  })

  it('does NOT flag when inlineDisplay is false', () => {
    const f = checkSource(`<Box style={{ display: 'flex' }} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      inlineDisplay: false,
    })
    expect(kinds(f)).not.toContain('inline-display')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<Box style={{ display: 'flex' }} /> // theme-allow`)
    expect(kinds(f)).not.toContain('inline-display')
  })

  it('does NOT flag display: "flex" in a chart file — the Flex/Grid/Group remedy is @mantine/*, banned in the Mantine-free chart layer', () => {
    const f = find(`<Box style={{ display: 'flex' }} />`, CHART_PATH)
    expect(kinds(f)).not.toContain('inline-display')
  })

  it('still flags the same literal in a non-chart path (the check is not globally weakened)', () => {
    const f = find(`<Box style={{ display: 'flex' }} />`, PATH)
    expect(kinds(f)).toContain('inline-display')
  })
})

// ── 12. raw-visx-axis ────────────────────────────────────────────────────────

describe('raw-visx-axis', () => {
  it('flags <AxisLeft> in a chart file', () => {
    const f = find(`<AxisLeft scale={s} numTicks={4} />`, CHART_PATH)
    expect(kinds(f)).toContain('raw-visx-axis')
    expect(f.find((x) => x.kind === 'raw-visx-axis')?.token).toBe('<AxisLeft')
  })

  it('flags <AxisBottom> in a chart file', () => {
    const f = find(`<AxisBottom scale={x} />`, CHART_PATH)
    expect(kinds(f)).toContain('raw-visx-axis')
  })

  it('flags <AxisRight> in a chart file', () => {
    const f = find(`<AxisRight scale={y} />`, CHART_PATH)
    expect(kinds(f)).toContain('raw-visx-axis')
  })

  it('does NOT flag <AxisLeft> in a NON-chart path', () => {
    const f = find(`<AxisLeft scale={s} />`, PATH)
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })

  it('does NOT flag <AxisLeftNumeric> in a chart file (not a raw axis)', () => {
    const f = find(`<AxisLeftNumeric scale={s} />`, CHART_PATH)
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })

  it('does NOT flag <AxisLeft> in Axes.tsx (the wrapper primitive)', () => {
    const f = find(
      `export const AxisLeftNumeric = (p) => <AxisLeft {...p} />`,
      'src/charts/primitives/Axes.tsx',
    )
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })

  it('does NOT flag when rawVisxAxis is false', () => {
    const f = checkSource(`<AxisLeft scale={s} />`, CHART_PATH, {
      ...DEFAULT_GUARD_CONFIG,
      rawVisxAxis: false,
    })
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })

  it('does NOT flag a theme-allow line in a chart file', () => {
    const f = find(`<AxisLeft scale={s} /> // theme-allow: bespoke`, CHART_PATH)
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })
})

// ── 13. raw-motion-value ─────────────────────────────────────────────────────

describe('raw-motion-value', () => {
  it('flags a hardcoded duration in transition={{}}', () => {
    const f = find(`<motion.div transition={{ duration: 0.3 }} />`)
    expect(kinds(f)).toContain('raw-motion-value')
  })

  it('flags a hardcoded spring stiffness in transition={{}}', () => {
    const f = find(`<motion.div transition={{ type: 'spring', stiffness: 400 }} />`)
    expect(kinds(f)).toContain('raw-motion-value')
  })

  it('flags a hardcoded ease bezier array in transition={{}}', () => {
    const f = find(`<motion.div transition={{ ease: [0.4, 0, 0.2, 1] }} />`)
    expect(kinds(f)).toContain('raw-motion-value')
  })

  it('does NOT flag a transition referencing the shared token', () => {
    const f = find(`<motion.div transition={MOTION_SPRING} />`)
    expect(kinds(f)).not.toContain('raw-motion-value')
  })

  it('does NOT flag a named easing string (not a magic number)', () => {
    const f = find(`<motion.div transition={{ ease: 'easeInOut' }} />`)
    expect(kinds(f)).not.toContain('raw-motion-value')
  })

  it('does NOT flag when rawMotionValue is false', () => {
    const f = checkSource(`<motion.div transition={{ duration: 0.3 }} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      rawMotionValue: false,
    })
    expect(kinds(f)).not.toContain('raw-motion-value')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<motion.div transition={{ duration: 0.3 }} /> // theme-allow: bespoke`)
    expect(kinds(f)).not.toContain('raw-motion-value')
  })
})

// ── 15. chart-missing-aria-label ─────────────────────────────────────────────

describe('chart-missing-aria-label', () => {
  it('flags a chart kind tag without ariaLabel', () => {
    const f = find(`<ZonedLine data={points} height={240} chartId="x" />`)
    expect(kinds(f)).toContain('chart-missing-aria-label')
  })

  it('does NOT flag a tag carrying ariaLabel', () => {
    const f = find(`<ZonedLine ariaLabel="HRV trend" data={points} height={240} />`)
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
  })

  it('sees ariaLabel PAST an arrow function in an earlier prop (=> must not end the tag)', () => {
    const f = find(`<ZonedLine data={points} getX={(d) => d.date} ariaLabel="HRV trend" />`)
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
  })

  it('sees ariaLabel past an explicit JSX generic argument', () => {
    const text = [
      '<MultiLine<ChartPoint>',
      '  data={points}',
      '  getX={(d) => d.date}',
      '  ariaLabel="Body weight trend"',
      '/>',
    ].join('\n')
    const f = find(text)
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
  })

  it('still flags a generic + arrow-function tag genuinely missing ariaLabel', () => {
    const f = find(`<MultiLine<ChartPoint> data={points} getX={(d) => d.date} />`)
    expect(kinds(f)).toContain('chart-missing-aria-label')
  })

  it('does NOT flag raw-radius when rawRadius is false (framework-internal repos)', () => {
    const f = checkSource(`<Paper radius={6} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      rawRadius: false,
    })
    expect(kinds(f)).not.toContain('raw-radius')
  })

  it('does NOT flag when chartMissingAriaLabel is false', () => {
    const f = checkSource(`<ZonedLine data={points} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      chartMissingAriaLabel: false,
    })
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
  })

  // ── reported line: the tag's OPENING line, not the end of the match ─────────
  //
  // The scan used to compute its line from the END of the matched tag, so on a multi-line-
  // formatted chart element the reported line was the closing `/>` rather than the `<Bars` line
  // that is actually missing the prop. Invisible while the report only printed `token`; visible
  // the moment `Finding.text` started quoting the reported source line back.

  it('reports the OPENING tag line (and quotes it in text) for a multi-line-formatted chart element', () => {
    const text = ['<Bars', '  data={points}', '  height={240}', '/>'].join('\n')
    const f = find(text)
    const hit = f.find((x) => x.kind === 'chart-missing-aria-label')
    expect(hit?.line).toBe(1)
    expect(hit?.text).toBe('<Bars')
  })

  it('reports the same line as before for a single-line chart element (no regression)', () => {
    const f = find(`<ZonedLine data={points} height={240} chartId="x" />`)
    const hit = f.find((x) => x.kind === 'chart-missing-aria-label')
    expect(hit?.line).toBe(1)
  })

  it('a theme-allow comment on the CLOSING line of a multi-line tag still suppresses the finding (back-compat)', () => {
    const text = ['<Bars', '  data={points}', '  height={240}', '/> // theme-allow'].join('\n')
    const f = find(text)
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
  })

  it('a theme-allow comment on the OPENING line of a multi-line tag also suppresses the finding', () => {
    const text = ['<Bars // theme-allow', '  data={points}', '  height={240}', '/>'].join('\n')
    const f = find(text)
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
  })

  // ── tag provenance ─────────────────────────────────────────────────────────
  //
  // The rule keys on a tag NAME, so a consumer's OWN component sharing a shipped kind's name
  // collected an unactionable `ariaLabel` demand (reported against 1.23.0: a hand-composed local
  // `MirroredBars`, 235 lines, nothing to do with the kind). The gate is a one-directional
  // narrowing — skip only what this file DEFINES and does not import from basalt-ui.

  it('does NOT flag a tag this file DEFINES itself (a local component sharing a kind name)', () => {
    const text = [
      'function MirroredBars({ data }: Props) {',
      '  return <svg />',
      '}',
      'export function Panel() {',
      '  return <MirroredBars data={points} />',
      '}',
    ].join('\n')
    expect(kinds(find(text))).not.toContain('chart-missing-aria-label')
  })

  it('skips a locally defined kind name however it is declared (const/memo, not just function)', () => {
    const text = ['const BandStrip = memo(Inner)', '<BandStrip data={rows} />'].join('\n')
    expect(kinds(find(text))).not.toContain('chart-missing-aria-label')
  })

  it('STILL flags when the same file also imports that name from basalt-ui (a real shadow)', () => {
    const text = [
      "import { MirroredBars } from 'basalt-ui/charts'",
      'function Panel() {',
      '  return <MirroredBars data={points} />',
      '}',
    ].join('\n')
    expect(kinds(find(text))).toContain('chart-missing-aria-label')
  })

  it('STILL flags a tag imported from a consumer BARREL that re-exports the kind', () => {
    const text = ["import { MultiLine } from '../charts'", '<MultiLine data={points} />'].join('\n')
    expect(kinds(find(text))).toContain('chart-missing-aria-label')
  })

  it('STILL flags a file with no imports and no local definition (coverage is not import-gated)', () => {
    expect(kinds(find('<Donut data={slices} />'))).toContain('chart-missing-aria-label')
  })

  it('honours an aliased basalt import, since the alias is the tag the JSX writes', () => {
    const text = [
      "import { Bars as BasaltBars } from 'basalt-ui/charts'",
      'const Bars = () => null',
      '<Bars data={points} />',
    ].join('\n')
    // `Bars` is defined locally here and only `BasaltBars` came from basalt — the local one is skipped.
    expect(kinds(find(text))).not.toContain('chart-missing-aria-label')
  })
})

// ── 16. card-with-border ─────────────────────────────────────────────────────

describe('card-with-border', () => {
  it('flags withBorder on a Card', () => {
    const f = find(`<Card padding="md" withBorder h="100%">{children}</Card>`)
    expect(kinds(f)).toContain('card-with-border')
  })

  it('flags withBorder on a Paper', () => {
    const f = find(`<Paper withBorder p="sm" />`)
    expect(kinds(f)).toContain('card-with-border')
  })

  it('flags withBorder in a multi-line-formatted tag, reporting the prop line', () => {
    const f = find(`<Card\n  padding="md"\n  withBorder\n  h="100%"\n>`)
    const finding = f.find((v) => v.kind === 'card-with-border')
    expect(finding?.line).toBe(3)
  })

  it('does NOT flag a Card with no withBorder', () => {
    const f = find(`<Card padding="md" h="100%">{children}</Card>`)
    expect(kinds(f)).not.toContain('card-with-border')
  })

  it('does NOT flag an explicit withBorder={false} opt-out', () => {
    const f = find(`<Paper withBorder={false} p="sm" />`)
    expect(kinds(f)).not.toContain('card-with-border')
  })

  it('does NOT flag Card.Section withBorder (a section divider, not card depth)', () => {
    const f = find(`<Card.Section withBorder inheritPadding py="xs">{header}</Card.Section>`)
    expect(kinds(f)).not.toContain('card-with-border')
  })

  it('does NOT flag withBorder on a non-card surface (Table keeps its own borders)', () => {
    const f = find(`<Table withBorder striped />`)
    expect(kinds(f)).not.toContain('card-with-border')
  })

  it('does NOT flag a component whose name merely starts with Card', () => {
    const f = find(`<CardHeader withBorder />`)
    expect(kinds(f)).not.toContain('card-with-border')
  })

  it('does NOT flag when cardWithBorder is false', () => {
    const f = checkSource(`<Card withBorder />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      cardWithBorder: false,
    })
    expect(kinds(f)).not.toContain('card-with-border')
  })
})

// ── 17. raw-form-control ─────────────────────────────────────────────────────

describe('raw-form-control', () => {
  it('flags a raw <input>', () => {
    const f = find(`<input type="text" value={v} onChange={onChange} />`)
    expect(kinds(f)).toContain('raw-form-control')
  })

  it('flags a raw <select>', () => {
    const f = find(`<select value={v}><option value="a">A</option></select>`)
    expect(kinds(f)).toContain('raw-form-control')
  })

  it('flags a raw <textarea>', () => {
    const f = find(`<textarea value={v} onChange={onChange} />`)
    expect(kinds(f)).toContain('raw-form-control')
  })

  it('does NOT flag a Mantine <TextInput>', () => {
    const f = find(`<TextInput label="Name" value={v} onChange={onChange} />`)
    expect(kinds(f)).not.toContain('raw-form-control')
  })

  it('does NOT flag a Mantine <Select>', () => {
    const f = find(`<Select data={options} value={v} />`)
    expect(kinds(f)).not.toContain('raw-form-control')
  })

  it('does NOT flag a component whose name merely starts with the tag name (inputRef)', () => {
    const f = find(`<inputRef.current.focus() />`)
    expect(kinds(f)).not.toContain('raw-form-control')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<input type="text" /> // theme-allow: legacy widget`)
    expect(kinds(f)).not.toContain('raw-form-control')
  })

  it('does NOT flag when rawFormControl is false', () => {
    const f = checkSource(`<input type="text" />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      rawFormControl: false,
    })
    expect(kinds(f)).not.toContain('raw-form-control')
  })
})

// ── 18. sub-16-input-font ────────────────────────────────────────────────────

describe('sub-16-input-font', () => {
  it('flags a sub-16 fontSize inline style on a raw <input>', () => {
    const f = find(`<input style={{ fontSize: 13, border: 'none' }} />`)
    expect(kinds(f)).toContain('sub-16-input-font')
  })

  it('flags a sub-16 fontSize inline style on a raw <textarea>', () => {
    const f = find(`<textarea style={{ fontSize: 12 }} />`)
    expect(kinds(f)).toContain('sub-16-input-font')
  })

  it('flags a quoted "12px" fontSize value', () => {
    const f = find(`<input style={{ fontSize: '12px' }} />`)
    expect(kinds(f)).toContain('sub-16-input-font')
  })

  it('flags a Mantine styles={{ input: { fontSize } }} per-part override', () => {
    const f = find(`<TextInput styles={{ input: { fontSize: 12 } }} />`)
    expect(kinds(f)).toContain('sub-16-input-font')
  })

  it('does NOT flag a fontSize of 16 or above on a raw input (already at/above the floor)', () => {
    const f = find(`<input style={{ fontSize: 16 }} />`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a fontSize below 16 on a <Text> (not a form control)', () => {
    const f = find(`<Text style={{ fontSize: 12 }}>caption</Text>`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a fontSize below 16 on a <span> (not a form control)', () => {
    const f = find(`<span style={{ fontSize: 11 }}>micro-label</span>`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a fontSize below 16 on a <Code> chart label (not a form control)', () => {
    const f = find(`<Code style={{ fontSize: 10 }}>{value}</Code>`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a rem-unit fontSize (ambiguous relative to a px floor, deliberately not matched)', () => {
    const f = find(`<input style={{ fontSize: '0.8rem' }} />`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a raw <input> with no style at all', () => {
    const f = find(`<input type="text" value={v} />`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a Mantine styles={{ root: {...} }} override (targets the wrapper, not the input)', () => {
    const f = find(`<TextInput styles={{ root: { fontSize: 12 } }} />`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`<input style={{ fontSize: 12 }} /> // theme-allow: legacy widget`)
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })

  it('does NOT flag when sub16InputFont is false', () => {
    const f = checkSource(`<input style={{ fontSize: 12 }} />`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      sub16InputFont: false,
    })
    expect(kinds(f)).not.toContain('sub-16-input-font')
  })
})

// ── 19. raw-font-family ──────────────────────────────────────────────────────

describe('raw-font-family', () => {
  it('flags a quoted fontFamily object property', () => {
    const f = find(`const s = { fontFamily: 'Inter, sans-serif' }`)
    expect(kinds(f)).toContain('raw-font-family')
  })

  it('flags a quoted fontFamily JSX prop', () => {
    const f = find(`<Text style={{ fontFamily: "Arial" }}>hi</Text>`)
    expect(kinds(f)).toContain('raw-font-family')
  })

  it('flags a bare kebab-case font-family CSS declaration', () => {
    const f = find(`font-family: Inter;`)
    expect(kinds(f)).toContain('raw-font-family')
  })

  it('does NOT flag a fontFamily bound to a var(--basalt-font-…) reference', () => {
    const f = find(`fontFamily: 'var(--basalt-font-sans, ui-sans-serif, system-ui, sans-serif)',`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag a kebab-case font-family bound to var(…)', () => {
    const f = find(`font-family: var(--basalt-font-mono);`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag an unquoted fontFamily identifier reference (a token ref, not a literal)', () => {
    const f = find(`fontFamily: LABEL_FONT_FAMILY,`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag a theme-allow line', () => {
    const f = find(`fontFamily: 'Inter, sans-serif', // theme-allow: legacy widget`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('flags a quoted kebab-case font-family CSS value (the (a) bypass)', () => {
    const f = find(`font-family: 'Inter', sans-serif;`)
    expect(kinds(f)).toContain('raw-font-family')
  })

  // A var() REFERENCE is not a literal, whichever custom property it names. The escape used to be
  // restricted to `--basalt-font-*` / `--mantine-font-family-*`, which reported a framework-free
  // consumer's `font-family: var(--font-sans)` as "a hardcoded fontFamily literal" and pointed the
  // fix at the React-only `createBasaltTheme`. The single-entry-point invariant is doctrine for
  // basalt's own theme layer; this regex cannot tell it apart from a consumer's own indirection.
  it('does NOT flag a fontFamily bound to a var(...) reference outside basalt’s own prefixes', () => {
    const f = find(`fontFamily: 'var(--some-other-var)'`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag a kebab-case font-family bound to a consumer var(...) reference', () => {
    const f = find(`font-family: var(--font-sans);`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag a kebab-case font-family bound to var(--mantine-font-family-…)', () => {
    const f = find(`fontFamily: 'var(--mantine-font-family-monospace)',`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag the CSS-wide keyword inherit (camelCase, quoted)', () => {
    const f = find(`fontFamily: 'inherit'`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag the CSS-wide keyword initial (kebab-case, bare)', () => {
    const f = find(`font-family: initial;`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag the CSS-wide keyword unset', () => {
    const f = find(`font-family: unset;`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })

  it('does NOT flag the CSS-wide keyword revert', () => {
    const f = find(`font-family: revert;`)
    expect(kinds(f)).not.toContain('raw-font-family')
  })
})

// ── theme-allow skip ─────────────────────────────────────────────────────────

describe('theme-allow skip', () => {
  it('skips the entire line when it contains the allow comment', () => {
    const text = `
const a = '#ff0000' // theme-allow
const b = '#00ff00'
`.trim()
    const f = find(text)
    // only the second line should fire
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
    expect(f.find((x) => x.kind === 'raw-hex')?.line).toBe(2)
  })

  it('supports a custom allowComment value', () => {
    const f = checkSource(`const c = '#ff0000' // ok-to-use-raw`, PATH, {
      ...DEFAULT_GUARD_CONFIG,
      allowComment: 'ok-to-use-raw',
    })
    expect(kinds(f)).not.toContain('raw-hex')
  })
})

// ── pure-comment skip ─────────────────────────────────────────────────────────

describe('pure-comment skip', () => {
  it('skips a // line comment', () => {
    const f = find(`// const c = '#ff0000'`)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('skips a JSDoc body line that is genuinely inside a block comment', () => {
    const f = find('/**\n * Use rgba() for opacity, not raw hex\n */')
    expect(kinds(f)).not.toContain('raw-color-fn')
  })

  it('skips a /* start-of-block line', () => {
    const f = find(`/* const c = '#aabbcc' */`)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('still flags a code line that follows a comment', () => {
    const text = `// this is a comment\nconst c = '#ff0000'`
    const f = find(text)
    expect(kinds(f)).toContain('raw-hex')
  })
})

// ── stripComments pre-pass: real block/line-comment awareness ───────────────────
//
// checkSource used to decide "is this a comment?" per line, from that line's OWN leading prefix
// (`//` / `*` / `/*`). A block-comment CONTINUATION line that didn't happen to start with `*` (the
// common "wrapped prose" style, e.g. styles.css) slipped straight through as code — a real
// false-positive, not a hypothetical one (see the 3 real sites this fixed, asserted in
// index.test.ts / reproduced below). These cases prove the replacement — an actual comment-
// stripping pre-pass — neither under- nor over-strips.

describe('stripComments pre-pass', () => {
  it('does NOT flag a hex on a block-comment CONTINUATION line with no leading *', () => {
    // This is exactly the styles.css shape: a /* ... */ block whose middle lines are wrapped
    // prose, not `* `-prefixed. The old per-line prefix heuristic missed this entirely.
    const text = ['/* line one', '   #e5e5e5 in the middle, no leading star', 'line three */'].join(
      '\n',
    )
    const f = find(text)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('flags a real hex that follows a same-line /* */ comment', () => {
    const f = find(`/* note */ const c = '#ff0000'`)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('flags a hex inside a single-quoted string with a trailing // comment', () => {
    const f = find(`const c = '#ff0000' // trailing note`)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
    expect(f.find((x) => x.kind === 'raw-hex')?.token).toBe('#ff0000')
  })

  it('does not mangle a URL hash-fragment inside a quoted string via // handling', () => {
    // The `//` in `https://` sits INSIDE a single-quoted string, so it must not be treated as a
    // line-comment opener. The guard's raw-hex regex has no URL awareness (never did — that's
    // unrelated to this fix), so it still matches the `#aabbcc` fragment literally: the real-code
    // semantics here are "1 finding", proving the string content survived the strip untouched
    // rather than being blanked out by an over-eager `//` rule.
    const f = find(`const u = 'https://example.com/#aabbcc'`)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('preserves the exact original line number across a preceding multi-line block comment', () => {
    const text = ['/*', 'line2', 'line3', 'line4', 'end */', '', "const c = '#ff0000'"].join('\n')
    const f = find(text)
    const hit = f.find((x) => x.kind === 'raw-hex')
    expect(hit?.line).toBe(7)
  })

  it('still honors the theme-allow escape on a code line', () => {
    const f = find(`const c = '#ff0000' // theme-allow: legacy`)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('does not crash on an unterminated block comment at EOF, and strips everything after it', () => {
    const text = `const before = '#ff0000'\n/* unterminated\nconst c = '#00ff00'`
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
    expect(f.find((x) => x.kind === 'raw-hex')?.token).toBe('#ff0000')
  })

  it('still finds a hex inside a backtick template literal containing ${}', () => {
    const f = find('const s = `value ${x} is #ff0000`')
    expect(kinds(f)).toContain('raw-hex')
  })

  it('CSS-shaped input: flags only the real declaration, not the comment mention', () => {
    const text = '/* comment with #e5e5e5 */\n.a { color: #ff0000; }'
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
    expect(f.find((x) => x.kind === 'raw-hex')?.token).toBe('#ff0000')
  })

  // ── regex-literal disambiguation (BUG 1: a `/*`- or `//`-shaped sequence INSIDE a regex body
  // must never be misread as opening a comment — the char-class case ran away to EOF and silently
  // deleted guard coverage for the rest of the file) ──────────────────────────────────────────────

  it('does not treat a `/*` inside a regex character class as a block-comment opener (BUG 1 repro)', () => {
    const text = "const RE = /[/*]/\nconst c = '#ff0000'"
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('does not treat two `/` inside a regex character class as a line-comment opener', () => {
    const text = "const RE = /[//]/\nconst c = '#ff0000'"
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('treats a `/` between identifiers as division, not a regex open', () => {
    const text = "const a = x / y\nconst c = '#ff0000'"
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('treats a `/` as division and still finds a REAL // comment later on the same line', () => {
    const text = "const a = x / y // #aabbcc\nconst c = '#ff0000'"
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('consumes a regex literal with an escaped slash without closing early', () => {
    const text = "const RE = /a\\/b/\nconst c = '#ff0000'"
    const f = find(text)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('still recognizes a real block comment right after a regex literal (regex handling did not break comment handling)', () => {
    const text = 'const RE = /abc/\n/* #ff0000 */'
    const f = find(text)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  // ── CSS vs TS syntax split (BUG 2: an unquoted `//` in CSS, e.g. inside `url(https://…)`,
  // is real CSS text, not a comment opener — CSS has no `//` comment syntax at all) ───────────────

  it('does not treat an unquoted "//" inside a CSS url() as a comment opener (BUG 2 repro)', () => {
    const f = checkSource(
      '.a { background: url(https://x.com/a.png); color: #ff0000; }',
      'src/styles.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('still strips a real /* */ block comment in a .css file alongside an unquoted url()', () => {
    const f = checkSource(
      '.a { background: url(https://x.com/a.png); /* #aabbcc */ color: #ff0000; }',
      'src/styles.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
    expect(f.find((x) => x.kind === 'raw-hex')?.token).toBe('#ff0000')
  })

  it('resolves a .module.css path to CSS syntax too (suffix match, not a naive split)', () => {
    const f = checkSource(
      '.a { background: url(https://x.com/a.png); color: #ff0000; }',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  it('a .ts file still strips a real // line comment (the CSS/TS syntax split did not disable TS)', () => {
    const f = checkSource('// #ff0000\nconst ok = 1', 'src/x.ts', DEFAULT_GUARD_CONFIG)
    expect(kinds(f)).not.toContain('raw-hex')
  })
})

// ── isChartFile gates raw-visx-axis ──────────────────────────────────────────

describe('isChartFile path gate', () => {
  it('fires raw-visx-axis in src/charts/kinds/k.tsx', () => {
    const f = checkSource(`<AxisLeft scale={s} />`, 'src/charts/kinds/k.tsx', DEFAULT_GUARD_CONFIG)
    expect(kinds(f)).toContain('raw-visx-axis')
  })

  it('does NOT fire raw-visx-axis in src/page.tsx', () => {
    const f = checkSource(`<AxisLeft scale={s} />`, 'src/page.tsx', DEFAULT_GUARD_CONFIG)
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })
})

// ── CSS applicability — the CLI walker now scans .css, so checkSource's per-kind gating over
// CSS-shaped input matters for real: color-meaningful kinds must still fire, JSX/tag-shaped kinds
// must not false-positive on genuine CSS syntax ──────────────────────────────────────────────────

describe('CSS applicability', () => {
  it('flags a raw hex in a real CSS declaration (proves .css is genuinely scanned)', () => {
    const f = checkSource(
      '.input {\n  color: #ff0000;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).toContain('raw-hex')
  })

  it('does NOT false-positive inline-display/raw-html-layout/raw-surface on genuine CSS shapes', () => {
    const f = checkSource(
      '.foo {\n  display: flex;\n  padding: 8px;\n  border-radius: 8px;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('inline-display')
    expect(kinds(f)).not.toContain('raw-html-layout')
    expect(kinds(f)).not.toContain('raw-surface')
  })

  it('still flags off-system-surface-var on a raw Mantine ramp step inside CSS', () => {
    const f = checkSource(
      '.foo {\n  background: var(--mantine-color-gray-3);\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).toContain('off-system-surface-var')
  })

  it('still flags raw-font-family on a kebab-case CSS font-family declaration', () => {
    const f = checkSource(
      '.foo {\n  font-family: system-ui;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).toContain('raw-font-family')
  })

  it('still flags inline-spacing on a genuine CSS padding/margin/gap declaration (the pattern is CSS-shaped, not JSX-only, despite the name)', () => {
    const f = checkSource(
      '.foo {\n  padding: 18px;\n  margin: 13px;\n  gap: 26px;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f).filter((k) => k === 'inline-spacing')).toHaveLength(3)
  })

  // ── The CSS-only sub-scale escape ───────────────────────────────────────────
  //
  // basalt-tokens.md blesses 2-8px micro-spacing raw, but that permission only ever held for JSX
  // PROPS: `pl={4}` is not a `prop: value` pair and never matched the pattern. In CSS every
  // declaration is `prop: value`, so a consumer's 4px cluster gap was flagged with nothing legal to
  // do about it — no token exists below the scale floor, and `exemptRules` matches whole path
  // segments so it cannot express `*.module.css`.

  const cssSpacing = (decl: string): GuardKind[] =>
    kinds(
      checkSource(`.foo {\n  ${decl};\n}\n`, 'src/Card.module.css', DEFAULT_GUARD_CONFIG),
    ).filter((k) => k === 'inline-spacing')

  it('does NOT flag sub-scale micro-spacing in CSS — there is no token to prefer below the floor', () => {
    for (const decl of ['gap: 2px', 'padding: 4px', 'margin-bottom: 6px', 'padding: 8px']) {
      expect(cssSpacing(decl)).toEqual([])
    }
  })

  it('judges a multi-value shorthand as a whole', () => {
    expect(cssSpacing('padding: 4px 8px')).toEqual([])
    // 16px has a scale stop; one non-micro component makes the whole declaration a finding.
    expect(cssSpacing('padding: 4px 16px')).toEqual(['inline-spacing'])
  })

  it('drops var() components before judging — a mixed value is already tokenized where it counts', () => {
    expect(cssSpacing('padding: 4px var(--vx-space-stack-xs)')).toEqual([])
  })

  it('does not extend the escape to other units — the doctrine is stated in px', () => {
    expect(cssSpacing('padding: 1.5rem')).toEqual(['inline-spacing'])
    expect(cssSpacing('padding: 2em')).toEqual(['inline-spacing'])
  })

  it('does NOT read a unitless fraction — that is a ratio, not a length', () => {
    // visx band padding. Ten of these in one consumer's chart files the day the leading-decimal fix
    // shipped: `padding` here is dimensionless 0–1, and "use p/m/gap with xs..xl" cannot be done to
    // it. Admitting `.75rem` and admitting `0.3` are the same regex change; the unit tells them
    // apart. Scoping inline-spacing out of chart files would also have cleared it, and would have
    // dropped real coverage inside charts/ while leaving the false positive live everywhere else.
    const scale = (src: string): GuardKind[] =>
      kinds(checkSource(src, 'src/charts/kinds/Bars.tsx', DEFAULT_GUARD_CONFIG)).filter(
        (k) => k === 'inline-spacing',
      )
    expect(
      scale('const s = scalePoint<string>({ domain: d, range: [0, w], padding: 0.3 })'),
    ).toEqual([])
    expect(scale('const s = scaleBand({ padding: .2 })')).toEqual([])
    // A unitless INTEGER is still 4px by React's convention, and still a finding.
    expect(scale('<Box style={{ padding: 4 }} />')).toEqual(['inline-spacing'])
    // A fraction WITH a unit is a real length and still flags — above the sub-scale ceiling, since
    // 0.3rem is 4.8px and would be excused by the micro-spacing escape for that reason instead.
    expect(cssSpacing('padding: 0.7rem')).toEqual(['inline-spacing'])
  })

  it('reads a CSS number without its integer part, and one carrying an explicit +', () => {
    // `.75rem` IS `0.75rem` and `+12px` IS `12px`. Requiring a leading digit skipped both — the
    // same silent skip the `0.` guard was fixed for, one spelling over.
    expect(cssSpacing('padding: .75rem')).toEqual(['inline-spacing'])
    expect(cssSpacing('padding: +12px')).toEqual(['inline-spacing'])
    // …and the sub-scale escape resolves them the same way: .5rem is 8px, below the floor.
    expect(cssSpacing('padding: .5rem')).toEqual([])
  })

  it('does NOT read a custom property whose NAME ends in a spacing word', () => {
    // A `\b` boundary sits inside a hyphenated identifier, so these matched as declarations. The
    // first is real generated output from the token layer; the second is the shape a consumer
    // writes. A custom property is a definition, not a rendered spacing decision.
    expect(cssSpacing('--vx-space-article-header-padding-bottom: 20px')).toEqual([])
    expect(cssSpacing('--card-padding-inline: 20px')).toEqual([])
    expect(cssSpacing('--card-gap: 20px')).toEqual([])
    // The declaration itself still flags — the fix narrows the boundary, it does not disarm it.
    expect(cssSpacing('padding-bottom: 20px')).toEqual(['inline-spacing'])
    expect(cssSpacing('padding-inline: 20px')).toEqual(['inline-spacing'])
  })

  it('stays case-sensitive — neither dialect spells a property `Padding-Top`', () => {
    // Pins the decision documented above BOX_SIDE_KEBAB: unifying the two spellings with an `i`
    // flag would be the short way and would also match casings that are not properties at all.
    expect(cssSpacing('Padding-Top: 18px')).toEqual([])
    expect(cssSpacing('PADDING: 18px')).toEqual([])
  })

  it('keeps the default spacing steps in lockstep with the real scale', () => {
    // The guard's copy of the xs..xl ladder drifted once already (it still read 10/12/16/20/32
    // after the level-0 retune, so `p={16}` was flagged in favour of a `p="md"` worth 18, and the
    // genuine `p={18}` went unflagged). The copy exists to keep the headless core one file; this
    // asserts it stays honest.
    expect(DEFAULT_GUARD_CONFIG.spacingSteps).toEqual(Object.values(SPACE_SCALE))
  })

  it('resolves rem against the same root the token layer converts against', () => {
    // The guard keeps its own copy of the 16px root to stay dependency-free. The spacing-steps copy
    // beside it drifted in production once; this pins the relationship rather than the number, so a
    // token layer that ever moved off a 16px root would fail here instead of silently disagreeing.
    // 10px is the ceiling; 12px is the first value above it. Expressed through `pxRem` so the
    // literals here follow the token layer's conversion rather than restating it.
    expect(cssSpacing(`padding: ${pxRem(10)}`)).toEqual([])
    expect(cssSpacing(`padding: ${pxRem(12)}`)).toEqual(['inline-spacing'])
    // The px spellings of the same two values must land identically.
    expect(cssSpacing('padding: 10px')).toEqual([])
    expect(cssSpacing('padding: 12px')).toEqual(['inline-spacing'])
  })

  it('keeps the ceiling below the smallest scale stop, so it can never strand a real token', () => {
    // The relationship, not the number: if a density retune moves SPACE_SCALE.xs, this still holds.
    expect(cssSpacing(`gap: ${SPACE_SCALE.xs}px`)).toEqual(['inline-spacing'])
    expect(cssSpacing(`gap: ${SPACE_SCALE.xs - 1}px`)).toEqual([])
  })

  it('leaves TSX untouched — an inline style object still has a prop form to prefer', () => {
    // `pl={4}` is a prop and never matched; `style={{ padding: 4 }}` did, and still should.
    expect(
      kinds(checkSource('<Box style={{ padding: 4 }} />', PATH, DEFAULT_GUARD_CONFIG)),
    ).toContain('inline-spacing')
    expect(kinds(checkSource('<Box pl={4} />', PATH, DEFAULT_GUARD_CONFIG))).not.toContain(
      'inline-spacing',
    )
  })

  it('does NOT false-positive raw-form-control on a CSS element selector (input, select, textarea)', () => {
    const f = checkSource(
      'input, select, textarea {\n  color: red;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('raw-form-control')
  })

  it('does NOT false-positive raw-spacing/raw-radius/off-identity-accent/raw-motion-value on CSS property syntax', () => {
    const f = checkSource(
      '.foo {\n  border-radius: 6px;\n  transition: all 0.3s ease;\n  color: teal;\n  gap: 16px;\n}\n',
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('raw-radius')
    expect(kinds(f)).not.toContain('raw-motion-value')
    expect(kinds(f)).not.toContain('off-identity-accent')
  })

  it('does NOT false-positive card-with-border/chart-missing-aria-label/raw-visx-axis on CSS class selectors that echo JSX names', () => {
    const f = checkSource(
      '.Card {\n  border: 1px solid red;\n}\n.ChartLegend {\n  display: flex;\n}\n.AxisLeft {\n  color: red;\n}\n',
      'src/charts/kinds/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('card-with-border')
    expect(kinds(f)).not.toContain('chart-missing-aria-label')
    expect(kinds(f)).not.toContain('raw-visx-axis')
  })

  it('does NOT false-positive localstorage-theme on CSS text', () => {
    const f = checkSource(
      "/* localStorage.getItem('theme') example */\n.foo { color: red; }\n",
      'src/Card.module.css',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('localstorage-theme')
  })

  // ── Kebab longhands and logical properties ──────────────────────────────────
  //
  // The alternation was camelCase-only, so a CSS module got the scan for `padding` and not for
  // `padding-top` beside it. Nothing decided that; it fell out of a pattern written for TSX inline
  // styles. Logical properties are included because that is what modern CSS in this repo writes.

  it('flags kebab longhands at scale values', () => {
    expect(cssSpacing(`padding-top: ${SPACE_SCALE.md}px`)).toEqual(['inline-spacing'])
    expect(cssSpacing(`margin-bottom: ${SPACE_SCALE.lg}px`)).toEqual(['inline-spacing'])
    expect(cssSpacing(`row-gap: ${SPACE_SCALE.lg}px`)).toEqual(['inline-spacing'])
    expect(cssSpacing(`column-gap: ${SPACE_SCALE.xl}px`)).toEqual(['inline-spacing'])
  })

  it('flags logical properties, including the -start/-end forms', () => {
    for (const prop of [
      'padding-block',
      'padding-inline',
      'margin-block',
      'margin-inline',
      'padding-inline-start',
      'margin-block-end',
    ]) {
      expect(cssSpacing(`${prop}: ${SPACE_SCALE.xl}px`)).toEqual(['inline-spacing'])
    }
  })

  it('extends the sub-scale escape to the longhands too — same rule, both spellings', () => {
    expect(cssSpacing('padding-top: 4px')).toEqual([])
    expect(cssSpacing('margin-inline: 8px')).toEqual([])
  })

  it('flags the camelCase logical properties in a TSX inline style', () => {
    expect(
      kinds(checkSource('<Box style={{ paddingInlineStart: 18 }} />', PATH, DEFAULT_GUARD_CONFIG)),
    ).toContain('inline-spacing')
  })

  // ── The `0.` blind spot ─────────────────────────────────────────────────────
  //
  // The zero-guard was `(?!0\b)`, and `\b` sits between `0` and `.` — so every value starting `0.`
  // matched the guard meant for a bare zero and dropped out of the scan entirely.

  it('sees values starting `0.` at all', () => {
    // 12px — a real spacing value that was previously invisible, not merely tolerated.
    expect(cssSpacing('padding: 0.75rem')).toEqual(['inline-spacing'])
  })

  it('still excuses a genuine zero', () => {
    expect(cssSpacing('padding: 0')).toEqual([])
    expect(cssSpacing('padding: 0px')).toEqual([])
  })

  it('resolves rem against the 16px root, so both spellings of one value agree', () => {
    // 0.25rem IS 4px. Accepting one spelling and flagging the other is the same arbitrariness the
    // kebab gap produced.
    expect(cssSpacing('padding: 0.25rem')).toEqual([])
    expect(cssSpacing('padding: 4px')).toEqual([])
    // The ceiling lands in the same place either way: 0.625rem = 10px, 0.75rem = 12px.
    expect(cssSpacing('padding: 0.625rem')).toEqual([])
    expect(cssSpacing('padding: 0.75rem')).toEqual(['inline-spacing'])
  })

  it('leaves units it cannot resolve without layout context alone', () => {
    for (const value of ['2em', '5%', '3ch', '2vw']) {
      expect(cssSpacing(`padding: ${value}`)).toEqual(['inline-spacing'])
    }
  })

  it('keeps the mixed-value and var() rules unchanged under the wider pattern', () => {
    expect(cssSpacing('padding: 4px 16px')).toEqual(['inline-spacing'])
    expect(cssSpacing('padding-inline: 4px var(--vx-space-stack-xs)')).toEqual([])
  })
})

// ── exemptRules — per-rule, per-path guard exemptions ────────────────────────

describe('exemptRules', () => {
  const TEXT = `<div style={{ display: 'flex' }} />`

  it('drops a finding of an exempted kind at a matching path', () => {
    const f = checkSource(TEXT, 'src/agent/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'inline-display': ['agent'] },
    })
    expect(kinds(f)).not.toContain('inline-display')
  })

  it('still fires at a non-matching path (path-scoped, not global)', () => {
    const f = checkSource(TEXT, 'src/dashboard/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'inline-display': ['agent'] },
    })
    expect(kinds(f)).toContain('inline-display')
  })

  it('a trailing-slash pattern matches identically to the bare segment', () => {
    const f = checkSource(TEXT, 'src/agent/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'inline-display': ['agent/'] },
    })
    expect(kinds(f)).not.toContain('inline-display')
  })

  it('does NOT match a substring of a segment (not a whole-segment match)', () => {
    const f = checkSource(TEXT, 'src/agent/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'inline-display': ['age'] },
    })
    expect(kinds(f)).toContain('inline-display')
  })

  // ── Relative paths and globs ────────────────────────────────────────────────
  //
  // Only the bare-segment shape existed, and it is the one nobody guesses. rollhook wrote the
  // obvious, correct `"public/site.webmanifest"`, matched nothing, got no diagnostic, and kept
  // reporting — while `exemptRules` had just become the ONLY waiver route for a whole file class.

  const HEX_MANIFEST = '{ "theme_color": "#27272a" }'
  const exemptedAt = (relPath: string, patterns: string[]): GuardKind[] =>
    kinds(
      checkSource(HEX_MANIFEST, relPath, {
        ...DEFAULT_GUARD_CONFIG,
        exemptRules: { 'raw-hex': patterns },
      }),
    )

  it('matches a real relative path to one file', () => {
    expect(exemptedAt('public/site.webmanifest', ['public/site.webmanifest'])).not.toContain(
      'raw-hex',
    )
  })

  it('matches a relative directory prefix', () => {
    expect(exemptedAt('public/icons/theme.json', ['public/icons'])).not.toContain('raw-hex')
  })

  it("normalizes a leading './' and a trailing '/'", () => {
    expect(exemptedAt('public/site.webmanifest', ['./public/'])).not.toContain('raw-hex')
  })

  it('matches a glob, with `*` stopping at a slash', () => {
    expect(exemptedAt('public/site.webmanifest', ['public/*.webmanifest'])).not.toContain('raw-hex')
    expect(exemptedAt('public/nested/site.webmanifest', ['public/*.webmanifest'])).toContain(
      'raw-hex',
    )
  })

  it('matches a `**` glob across slashes', () => {
    expect(exemptedAt('src/a/b/theme.json', ['src/**/theme.json'])).not.toContain('raw-hex')
  })

  it('matches a slash-free glob against the BASENAME, like a bare segment does', () => {
    const f = checkSource(`.a { padding: 18px }`, 'src/features/Card.module.css', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'inline-spacing': ['*.module.css'] },
    })
    expect(kinds(f)).not.toContain('inline-spacing')
  })

  it('still fires at a path the path/glob does not match', () => {
    expect(exemptedAt('public/other.webmanifest', ['public/site.webmanifest'])).toContain('raw-hex')
  })

  // The other half of the fix. An exemption is a CLAIM, and a claim that resolves to nothing reads
  // as coverage in a config review while enforcing exactly as much as an empty object.
  describe('unmatchedExemptPatterns', () => {
    const scanned = ['src/App.tsx', 'public/site.webmanifest']

    it('reports a pattern that matches no scanned file', () => {
      const cfg = { ...DEFAULT_GUARD_CONFIG, exemptRules: { 'raw-hex': ['public/manifest.json'] } }
      expect(unmatchedExemptPatterns(cfg, scanned)).toEqual([
        { kind: 'raw-hex', pattern: 'public/manifest.json', reason: 'no-match' },
      ])
    })

    it('says nothing about a pattern that DOES match', () => {
      const cfg = {
        ...DEFAULT_GUARD_CONFIG,
        exemptRules: { 'raw-hex': ['public/site.webmanifest'] },
      }
      expect(unmatchedExemptPatterns(cfg, scanned)).toEqual([])
    })

    it("reports a typo'd KIND — an exemption for a rule that does not exist", () => {
      const cfg = {
        ...DEFAULT_GUARD_CONFIG,
        exemptRules: { 'raw-hexx': ['src'] } as unknown as GuardConfig['exemptRules'],
      }
      expect(unmatchedExemptPatterns(cfg, scanned)).toEqual([
        { kind: 'raw-hexx', pattern: 'src', reason: 'unknown-kind' },
      ])
    })

    it('reports the exact shape rollhook wrote before the path matcher existed', () => {
      const cfg = { ...DEFAULT_GUARD_CONFIG, exemptRules: { 'raw-hex': ['site.webmanifest'] } }
      expect(unmatchedExemptPatterns(cfg, ['public/site.webmanifest'])).toEqual([])
      expect(unmatchedExemptPatterns(cfg, ['src/App.tsx'])).toHaveLength(1)
    })

    it('is silent on an empty config', () => {
      expect(unmatchedExemptPatterns(DEFAULT_GUARD_CONFIG, scanned)).toEqual([])
    })
  })

  it('does NOT suppress a different kind on the same line/path', () => {
    const f = checkSource(`const c = '#ff0000'; ${TEXT}`, 'src/agent/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'inline-display': ['agent'] },
    })
    expect(kinds(f)).not.toContain('inline-display')
    expect(kinds(f)).toContain('raw-hex')
  })

  it('exempts raw-html-layout, an INLINE-handled kind — proves the post-filter covers those too', () => {
    const f = checkSource(TEXT, 'src/agent/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'raw-html-layout': ['agent'] },
    })
    expect(kinds(f)).not.toContain('raw-html-layout')
    // inline-display isn't exempted here, so it still fires from the same text.
    expect(kinds(f)).toContain('inline-display')
  })

  it('default (no exemptRules) behavior is unchanged', () => {
    const f = find(TEXT, 'src/agent/x.tsx')
    expect(kinds(f)).toContain('inline-display')
    expect(kinds(f)).toContain('raw-html-layout')
  })

  // ── EXEMPT_RULE_ALIASES: a grace-minor WIDENING inherits its parent's exemption ───────────────
  // A kind that exists only to widen an established one is the same rule to a consumer, so an
  // exemption already written for the parent has to cover it — otherwise the widening arrives as
  // noise in exactly the paths someone decided the rule does not apply to.

  const HIDDEN =
    "const s = { display: 'flex', padding: 18 }\nexport const D = () => <div style={s} />"
  const SHADOW = 'const s = { boxShadow: `0 0 0 2px ${VX.accent}` }'
  const CSS_SURFACE = '.card { border-radius: 12px; }'

  it("hidden-inline-style inherits raw-html-layout's exemption", () => {
    expect(kinds(find(HIDDEN, 'src/agent/x.tsx'))).toContain('hidden-inline-style')
    const f = checkSource(HIDDEN, 'src/agent/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'raw-html-layout': ['agent'] },
    })
    expect(kinds(f)).not.toContain('hidden-inline-style')
  })

  it("surface-shadow-override and css-raw-surface inherit raw-surface's exemption", () => {
    expect(kinds(find(SHADOW, 'src/agent/x.tsx'))).toContain('surface-shadow-override')
    expect(kinds(find(CSS_SURFACE, 'src/agent/x.css'))).toContain('css-raw-surface')
    const cfg = { ...DEFAULT_GUARD_CONFIG, exemptRules: { 'raw-surface': ['agent'] } }
    expect(kinds(checkSource(SHADOW, 'src/agent/x.tsx', cfg))).not.toContain(
      'surface-shadow-override',
    )
    expect(kinds(checkSource(CSS_SURFACE, 'src/agent/x.css', cfg))).not.toContain('css-raw-surface')
  })

  it('the inheritance is one-way — exempting the CHILD leaves the parent enforced', () => {
    const f = checkSource(HIDDEN, 'src/agent/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'hidden-inline-style': ['agent'] },
    })
    expect(kinds(f)).not.toContain('hidden-inline-style')
    expect(
      kinds(
        checkSource(TEXT, 'src/agent/x.tsx', {
          ...DEFAULT_GUARD_CONFIG,
          exemptRules: { 'hidden-inline-style': ['agent'] },
        }),
      ),
    ).toContain('raw-html-layout')
  })

  it('an alias does not exempt a path the parent exemption never named', () => {
    const f = checkSource(SHADOW, 'src/charts/x.tsx', {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'raw-surface': ['agent'] },
    })
    expect(kinds(f)).toContain('surface-shadow-override')
  })
})

// ── 20. severity ─────────────────────────────────────────────────────────────

describe('severity', () => {
  it('stamps every finding, defaulting to error', () => {
    const f = find(`<Box style={{ color: '#ff0000' }} />`)
    expect(f.length).toBeGreaterThan(0)
    expect(f.every((v) => v.severity === 'error')).toBe(true)
  })

  it('honours a per-kind consumer override without suppressing the finding', () => {
    // Turning a kind down must still REPORT it — severity is not an off switch. The per-kind
    // booleans and `exemptRules` are the off switches, and they stay separate on purpose.
    const cfg = { ...DEFAULT_GUARD_CONFIG, severity: { 'raw-hex': 'warn' as const } }
    const f = checkSource(`<Box style={{ color: '#ff0000' }} />`, PATH, cfg)
    const hex = f.filter((v) => v.kind === 'raw-hex')
    expect(hex).toHaveLength(1)
    expect(hex[0]?.severity).toBe('warn')
  })

  it('scopes the override to the named kind only', () => {
    const cfg = { ...DEFAULT_GUARD_CONFIG, severity: { 'raw-hex': 'warn' as const } }
    const f = checkSource(`<Box p={${SPACE_SCALE.md}} style={{ color: '#ff0000' }} />`, PATH, cfg)
    expect(f.find((v) => v.kind === 'raw-hex')?.severity).toBe('warn')
    expect(f.find((v) => v.kind === 'raw-spacing')?.severity).toBe('error')
  })

  // The grace ledger. These five kinds landed warn-only in the round-4 guard minor and sat there
  // for five minors with nothing tracking the promise (D4) — GRACE_PERIOD_KINDS is now empty and
  // the C16 version gate in grace.test.ts is what stops a future entry sitting unpromoted again.
  it.each([
    'theme-allow-unscoped',
    'surface-shadow-override',
    'css-raw-surface',
    'inline-font-size',
    'hidden-inline-style',
  ])('%s is promoted past its grace minor (error)', (kind) => {
    const cases: Record<string, [string, string]> = {
      'theme-allow-unscoped': ['const x = 1 // theme-allow', PATH],
      'surface-shadow-override': ['const s = { boxShadow: `0 0 0 2px ${VX.accent}` }', PATH],
      'css-raw-surface': ['.a { border-radius: 6px; }', 'src/a.module.css'],
      'inline-font-size': [`<div style={{ fontSize: 11 }} />`, PATH],
      'hidden-inline-style': [
        `const rowStyle = { display: 'flex', gap: 12 }\nexport const C = () => <div style={rowStyle} />`,
        PATH,
      ],
    }
    const [src, path] = cases[kind] as [string, string]
    const hit = find(src, path).find((v) => v.kind === kind)
    expect(hit?.severity).toBe('error')
  })

  it('ships every OTHER kind past its grace period', () => {
    // Not a constraint, a LEDGER: when a new kind lands warn-only, this expectation changes in the
    // same commit, and changing it back is the promotion. A grace entry that outlives its minor
    // shows up here as an unexplained diff.
    const cfg = DEFAULT_GUARD_CONFIG
    const everyKind = checkSource(
      `<Box p={${SPACE_SCALE.md}} radius={4} style={{ color: '#ff0000', gap: 3 }} />`,
      PATH,
      cfg,
    )
    expect(everyKind.length).toBeGreaterThan(0)
    expect(everyKind.every((v) => v.severity === 'error')).toBe(true)
  })
})

// ── 21. theme-allow placement ────────────────────────────────────────────────

describe('theme-allow placement', () => {
  it('honours a standalone comment on the PRECEDING line (the JSX-legal form)', () => {
    const f = find(
      `export const C = () => (
  {/* theme-allow raw-hex — brand asset, fixed by the vendor */}
  <Box style={{ color: '#ff0000' }} />
)`,
    )
    expect(kinds(f)).not.toContain('raw-hex')
  })

  // A TRAILING comment stays scoped to its own line: `const a = '#f00' // theme-allow` must not
  // silently waive the next line as well.
  it('does NOT let a trailing comment waive the line below it', () => {
    const f = find(`const a = '#ff0000' // theme-allow raw-hex — vendor brand\nconst b = '#00ff00'`)
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
  })

  // rb's defect: the shipped oxfmt reflows a long declaration and lands the comment on a different
  // line than the value, so a same-line-only escape silently stops working. Verified against real
  // oxfmt output — the hex ends up ABOVE the comment, which is why preceding-line support alone
  // does not fix it and the walk goes backwards over the declaration.
  it('reaches back over an oxfmt-reflowed CSS declaration', () => {
    const f = find(
      `.root {
  background-color: var(
    --mantine-color-body,
    #232326
  ); /* theme-allow raw-hex — Mantine body fallback for the pre-paint value */
}`,
      'src/styles.css',
    )
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('stops the backward walk at the previous declaration', () => {
    const f = find(
      `.root {
  color: #112233;
  background: var(
    #232326
  ); /* theme-allow raw-hex — fallback */
}`,
      'src/styles.css',
    )
    expect(f.filter((x) => x.kind === 'raw-hex')).toHaveLength(1)
    expect(f.find((x) => x.kind === 'raw-hex')?.line).toBe(2)
  })
})

// ── 22. theme-allow rule scoping + accountability ────────────────────────────

describe('theme-allow scoping', () => {
  it('a scoped annotation waives only the kind it names', () => {
    const f = find(
      `<Box p={${SPACE_SCALE.md}} style={{ color: '#ff0000' }} /> // theme-allow raw-hex — vendor brand`,
    )
    expect(kinds(f)).not.toContain('raw-hex')
    expect(kinds(f)).toContain('raw-spacing')
  })

  it('a bare annotation still waives everything (back-compat) but is reported', () => {
    const f = find(`<Box p={${SPACE_SCALE.md}} style={{ color: '#ff0000' }} /> // theme-allow`)
    expect(kinds(f)).not.toContain('raw-hex')
    expect(kinds(f)).not.toContain('raw-spacing')
    expect(kinds(f)).toContain('theme-allow-unscoped')
  })

  it('reports a reason-less scoped annotation too', () => {
    const f = find(`<Box style={{ color: '#ff0000' }} /> // theme-allow raw-hex`)
    expect(kinds(f)).toContain('theme-allow-unscoped')
  })

  it('accepts the accountable form silently', () => {
    const f = find(
      `<Box style={{ color: '#ff0000' }} /> // theme-allow raw-hex — vendor brand asset`,
    )
    expect(f).toHaveLength(0)
  })

  it('accepts a basalt/-prefixed plugin rule id as accountable', () => {
    const f = find(`const x = 1 // theme-allow basalt/hand-rolled-plot — multi-pane, not one plot`)
    expect(f).toHaveLength(0)
  })

  // A prose reason is introduced with a separator — the shape every annotation in the wild
  // already has (`theme-allow: …`, `theme-allow — …`). That is what keeps prose out of the rule-id
  // slot without having to guess whether an unknown word is a reason or a typo.
  it('reads a separated reason as a reason, not as rule ids', () => {
    for (const annotation of ['theme-allow: legacy vendor asset', 'theme-allow — legacy vendor']) {
      const f = find(`<Box style={{ color: '#ff0000' }} /> // ${annotation}`)
      expect(kinds(f)).not.toContain('raw-hex')
    }
  })

  // ── fail closed: a waiver that names a rule id must never widen into a blanket one ────────────

  it('waives NOTHING when the named rule id is a typo', () => {
    const f = find(
      `<Box p={${SPACE_SCALE.md}} style={{ color: '#ff0000' }} /> // theme-allow raw-hexx — vendor brand`,
    )
    // The old parse consumed no id, fell through to the empty-`rules` branch, and read the whole
    // thing as the LEGACY BLANKET form: one mistyped character silenced every kind on the line.
    expect(kinds(f)).toContain('raw-hex')
    expect(kinds(f)).toContain('raw-spacing')
  })

  it('names the unknown id rather than reporting it as "no rule id"', () => {
    const f = find(`const c = '#ff0000' // theme-allow raw-hexx — vendor brand`)
    const unscoped = f.find((v) => v.kind === 'theme-allow-unscoped')
    expect(unscoped?.token).toContain("unknown rule id 'raw-hexx'")
  })

  it('a typo is never more permissive than the same annotation spelled correctly', () => {
    const correct = find(`const c = '#ff0000' // theme-allow raw-hex — vendor brand`)
    const typo = find(`const c = '#ff0000' // theme-allow raw-hexx — vendor brand`)
    expect(typo.length).toBeGreaterThanOrEqual(correct.length)
  })

  it('still waives the ids it got right in a mixed list', () => {
    const f = find(
      `<Box p={${SPACE_SCALE.md}} style={{ color: '#ff0000' }} /> // theme-allow raw-hex, raw-spacingg — mixed`,
    )
    expect(kinds(f)).not.toContain('raw-hex')
    expect(kinds(f)).toContain('raw-spacing')
  })

  it('says "not waived", not "waives nothing", when an id in the list DID resolve', () => {
    const f = find(`const c = '#ff0000' // theme-allow raw-hex, raw-spacingg — mixed`)
    const unscoped = f.find((v) => v.kind === 'theme-allow-unscoped')
    expect(unscoped?.token).toBe("theme-allow (unknown rule id 'raw-spacingg' — not waived)")
    // The claim has to match what the same run actually did: raw-hex IS waived here.
    expect(kinds(f)).not.toContain('raw-hex')
  })

  // ── prose after a resolved id is prose, not a typo ────────────────────────────────────────────
  //
  // The id slot closes at the first space no comma opened. `theme-allow raw-surface sub-scale …`
  // is one em-dash away from annotations this package itself ships (see ChartLegend), and reading
  // `sub-scale` as an attempted id made a scoped, reasoned waiver report as unscoped.

  it('reads an unknown word after a resolved id as the reason', () => {
    const f = find(
      'const s = { borderRadius: 3 } // theme-allow raw-surface sub-scale legend corner',
    )
    expect(f).toHaveLength(0)
  })

  it('still fails closed on a typo in the FIRST id slot, separator or not', () => {
    for (const annotation of [
      'theme-allow raw-hexx — vendor',
      'theme-allow raw-hexx vendor asset',
    ]) {
      expect(kinds(find(`const c = '#ff0000' // ${annotation}`))).toContain('raw-hex')
    }
  })

  // Documented break, not a regression: a reason with NO separator introducing it sits in the id
  // slot, names no rule, and therefore waives nothing. Kept as a test so the behaviour is pinned
  // rather than rediscovered — MIGRATING.md carries the consumer-facing half.
  it('does not waive a reason written with no separator introducing it', () => {
    const f = find(`const c = '#ff0000' // theme-allow legacy vendor asset`)
    expect(f.find((v) => v.kind === 'raw-hex')?.severity).toBe('error')
    expect(f.find((v) => v.kind === 'theme-allow-unscoped')?.token).toContain(
      "unknown rule id 'legacy' — waives nothing",
    )
  })

  // `in` walks the prototype chain, so `'constructor' in GUARD_RULES` was true and a reason
  // starting with that word scoped the waiver to a rule that does not exist.
  it('does not resolve an Object.prototype key as a rule id', () => {
    const f = find(`const c = '#ff0000' // theme-allow constructor — inherited key, not a rule`)
    expect(kinds(f)).toContain('raw-hex')
  })

  it('accepts an id belonging to a plugin rule that does not honour theme-allow', () => {
    // Not a guard kind and not theme-allow-aware — but a REAL id, so it parses as accountable
    // rather than being read as a typo (or, before, as a blanket waiver).
    const f = find(`const x = 1 // theme-allow ai-sdk-major — intentional producer/consumer skew`)
    expect(f).toHaveLength(0)
  })

  it('ships theme-allow-unscoped as an error (promoted, C16)', () => {
    const f = find(`const x = 1 // theme-allow`)
    expect(f.every((v) => v.severity === 'error')).toBe(true)
  })

  // The annotation itself lives in a comment; a `theme-allow` in real code must not waive anything.
  it('ignores the token when it is not inside a comment', () => {
    const f = find(`const label = 'theme-allow'\nconst c = '#ff0000'`)
    expect(kinds(f)).toContain('raw-hex')
  })
})

// ── 22b. theme-allow — the prefix rule and the two scopes, exhaustively ──────
//
// Three holes in one contract across two rounds, so this is a matrix rather than a case.

describe('theme-allow — annotation vs prose (the prefix rule)', () => {
  const HEX = `const c = '#ff0000'`

  /** `comment` on its own line directly above a raw hex — the placement that waives the line below. */
  function above(comment: string): GuardKind[] {
    return kinds(find(`${comment}\n${HEX}`))
  }

  // ── ACCEPTED — every shape a consumer actually writes ──────────────────────

  it.each([
    '// theme-allow raw-hex — vendor brand',
    '//theme-allow raw-hex — no space after the marker',
    '  // theme-allow raw-hex — indented',
    '/* theme-allow raw-hex — a block comment */',
    '{/* theme-allow raw-hex — a JSX expression comment */}',
    '/**\n * theme-allow raw-hex — a docblock gutter line\n */',
    '// theme-allow',
  ])('%s is an annotation and waives the line below', (comment) => {
    expect([comment, above(comment).includes('raw-hex')]).toEqual([comment, false])
  })

  it('a trailing annotation waives its own line', () => {
    expect(kinds(find(`${HEX} // theme-allow raw-hex — vendor brand`))).not.toContain('raw-hex')
  })

  // The reason wrapping to a second line — or a docblock's own `*/` — used to absorb the whole
  // waiver, so the natural multi-line shape silently waived nothing. argo hit it three times in one
  // upgrade, each time on a comment that looked correct.
  it('a wrapped reason still reaches the code line under it', () => {
    const f = find(
      `// theme-allow raw-hex — the vendor brand hex, kept in sync with
// the marketing site's own palette
${HEX}`,
    )
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('a blank line ends the block — the waiver does not jump it', () => {
    expect(
      kinds(
        find(`// theme-allow raw-hex — about something else

${HEX}`),
      ),
    ).toContain('raw-hex')
  })

  it('a trailing annotation does NOT walk forward — it stays on its own line', () => {
    expect(kinds(find(`const ok = 1 // theme-allow raw-hex — about this line\n${HEX}`))).toContain(
      'raw-hex',
    )
  })

  // ── REJECTED — prose that MENTIONS the token ──────────────────────────────

  // The linewatch defect, and the one that made this a false NEGATIVE: a file documenting its own
  // waivers disarmed itself. Every shape here is lifted from real consumer or basalt source.
  it.each([
    '// see the `theme-allow` contract for how exceptions are written',
    '/* Since 1.20.0 a `theme-allow` that names a rule declares the file */',
    '/**\n * A `theme-allow` with a reason declares the whole FILE wherever it is written.\n */',
    '// each chart carries a theme-allow saying why',
    '// documented at theme-allow raw-hex — this sentence is prose, not a waiver',
  ])('%s is prose and waives nothing', (comment) => {
    expect([comment, above(comment).includes('raw-hex')]).toEqual([comment, true])
  })

  // A kind name written in prose used to consume no id, fall through to `rules: []`, and read as
  // the blanket form — so a sentence about the reporting rule switched every rule off.
  it('a comment starting with the longer word `theme-allow-unscoped` is not an annotation', () => {
    expect(above('// theme-allow-unscoped is what reports a bare waiver')).toContain('raw-hex')
  })

  it('the token inside a string literal is code, not an annotation', () => {
    expect(kinds(find(`const doc = 'theme-allow raw-hex — x'\n${HEX}`))).toContain('raw-hex')
  })

  // Prose is not an annotation for REPORTING either — otherwise every sentence documenting the
  // escape hatch becomes a theme-allow-unscoped finding (this package's own guard/types.ts).
  it('prose mentioning the token is not reported as an unscoped waiver', () => {
    expect(above('// see the `theme-allow` contract')).not.toContain('theme-allow-unscoped')
  })
})

describe('theme-allow-file — whole-file scope', () => {
  const SRC = [`const a = '#ff0000'`, `const b = '#00ff00'`, `const c = '#0000ff'`].join('\n')

  it('waives every line in the file, not just the one below it', () => {
    const f = find(`// theme-allow-file raw-hex — the vendor brand sheet\n${SRC}`)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('reaches BACKWARDS too — a declaration at the bottom covers the top', () => {
    const f = find(`${SRC}\n// theme-allow-file raw-hex — the vendor brand sheet`)
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('waives only the kinds it names', () => {
    const f = find(
      `// theme-allow-file raw-hex — vendor brand\n${SRC}\n<Box style={{ display: 'flex' }} />`,
    )
    expect(kinds(f)).not.toContain('raw-hex')
    expect(kinds(f)).toContain('inline-display')
  })

  // File scope is the widest waiver in the contract, so it is the one that has to name what it
  // waives. A bare `theme-allow-file` is `exemptRules` without the config review.
  it('a BARE theme-allow-file waives nothing, and is reported as unscoped', () => {
    const f = find(`// theme-allow-file — everything in here is bespoke\n${SRC}`)
    expect(kinds(f)).toContain('raw-hex')
    expect(kinds(f)).toContain('theme-allow-unscoped')
  })

  it("a theme-allow-file naming a typo'd id waives nothing", () => {
    const f = find(`// theme-allow-file raw-hexx — vendor brand\n${SRC}`)
    expect(kinds(f)).toContain('raw-hex')
    expect(kinds(f)).toContain('theme-allow-unscoped')
  })

  it('an id-and-reason theme-allow-file is accountable — no unscoped finding', () => {
    const f = find(`// theme-allow-file raw-hex — the vendor brand sheet\n${SRC}`)
    expect(kinds(f)).not.toContain('theme-allow-unscoped')
  })

  // The complement, and the half 1.20.0 did not deliver: naming a rule AND giving a reason used to
  // promote a waiver to the whole file in the oxlint plugin, so whole-file was the only expressible
  // scope. The guard's plain `theme-allow` has always been line-scoped, and stays that way.
  it('a plain theme-allow with an id and a reason stays line-scoped', () => {
    const f = find(`// theme-allow raw-hex — vendor brand\n${SRC}`)
    expect(kinds(f).filter((k) => k === 'raw-hex')).toHaveLength(2)
  })
})

/** A two-hex manifest with `extra` (an annotation member, or nothing) inserted at the top. */
const MANIFEST = (extra: string) =>
  `{\n${extra}  "theme_color": "#27272a",\n  "background_color": "#27272a"\n}\n`

describe('theme-allow in JSON — the "basalt:theme-allow" member', () => {
  it('a webmanifest hex reports with no annotation — the 1.20.0 baseline', () => {
    const f = checkSource(MANIFEST(''), 'public/site.webmanifest', DEFAULT_GUARD_CONFIG)
    expect(kinds(f).filter((k) => k === 'raw-hex')).toHaveLength(2)
  })

  // JSON has no comments, so from 1.20.0 the whole file class was permanently unwaivable and the
  // printed remedy prescribed a comment the file cannot carry. Both consumers that hit it fell back
  // to a blanket `exemptRules` entry — the shape the release was spent retiring.
  it('a "basalt:theme-allow-file" member declares the file', () => {
    const f = checkSource(
      MANIFEST('  "basalt:theme-allow-file": "raw-hex — a manifest cannot read a CSS variable",\n'),
      'public/site.webmanifest',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('a "basalt:theme-allow" member is line-scoped — its own line and the one below', () => {
    const f = checkSource(
      MANIFEST('  "basalt:theme-allow": "raw-hex — the theme color only",\n'),
      'public/site.webmanifest',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f).filter((k) => k === 'raw-hex')).toHaveLength(1)
  })

  it('the member must name its ids — a bare one waives nothing', () => {
    const f = checkSource(
      MANIFEST('  "basalt:theme-allow-file": "everything in here is bespoke",\n'),
      'public/site.webmanifest',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).toContain('raw-hex')
  })

  it('works in a plain .json too, not only a manifest', () => {
    const f = checkSource(
      MANIFEST('  "basalt:theme-allow-file": "raw-hex — vendor brand data",\n'),
      'src/brand.json',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('raw-hex')
  })

  // The member is JSON-only: in TS that string is a value, and a value that could switch off a rule
  // is the hole `stripComments` exists to close.
  it('the same string in a TS file is code, not an annotation', () => {
    const f = find(`const cfg = { "basalt:theme-allow-file": "raw-hex — x" }\nconst c = '#ff0000'`)
    expect(kinds(f)).toContain('raw-hex')
  })
})

// ── 23. surface-shadow-override ──────────────────────────────────────────────

describe('surface-shadow-override', () => {
  it('flags a token-composed shadow that REPLACES card depth', () => {
    const f = find('const s = { boxShadow: `0 0 0 2px ${VX.accent}` }')
    expect(kinds(f)).toContain('surface-shadow-override')
  })

  it('does NOT flag one that composes WITH card depth', () => {
    const f = find('const s = { boxShadow: `${VX.shadowCard}, 0 0 0 2px ${VX.accent}` }')
    expect(kinds(f)).not.toContain('surface-shadow-override')
  })

  it('does NOT flag a var(--vx-shadow-…) reference', () => {
    const f = find(`const s = { boxShadow: 'var(--vx-shadow-card)' }`)
    expect(kinds(f)).not.toContain('surface-shadow-override')
  })

  it('still reports a fully literal shadow as raw-surface, not the new kind', () => {
    const f = find(`const s = { boxShadow: '0 1px 3px black' }`)
    expect(kinds(f)).toContain('raw-surface')
    expect(kinds(f)).not.toContain('surface-shadow-override')
  })

  it('is an error now that its grace minor has ended (promoted, C16)', () => {
    const f = find('const s = { boxShadow: `0 0 0 2px ${VX.accent}` }')
    expect(f.find((v) => v.kind === 'surface-shadow-override')?.severity).toBe('error')
  })
})

// ── 24. css-raw-surface ──────────────────────────────────────────────────────

describe('css-raw-surface', () => {
  it('flags a kebab-case border-radius literal in CSS', () => {
    const f = find('.a { border-radius: 4px; }', 'src/a.module.css')
    expect(kinds(f)).toContain('css-raw-surface')
  })

  it('does NOT flag a var(--vx-radius-…) reference', () => {
    const f = find('.a { border-radius: var(--vx-radius-card); }', 'src/a.module.css')
    expect(kinds(f)).not.toContain('css-raw-surface')
  })

  it('does NOT flag a sub-scale micro-corner below the 4px floor', () => {
    const f = find('.a { border-radius: 2px; }', 'src/a.module.css')
    expect(kinds(f)).not.toContain('css-raw-surface')
  })

  it('does NOT flag the circle/pill shape values', () => {
    const f = find('.a { border-radius: 50%; }\n.b { border-radius: 9999px; }', 'src/a.module.css')
    expect(kinds(f)).not.toContain('css-raw-surface')
  })

  it('flags a literal box-shadow in CSS', () => {
    const f = find('.a { box-shadow: 0 1px 3px rgba(0,0,0,0.2); }', 'src/a.module.css')
    expect(kinds(f)).toContain('css-raw-surface')
  })

  it('never fires in TSX (the camelCase dialect is raw-surface’s)', () => {
    const f = find(`<div style={{ borderRadius: 8 }} />`)
    expect(kinds(f)).not.toContain('css-raw-surface')
    expect(kinds(f)).toContain('raw-surface')
  })
})

// ── 25. inline-font-size ─────────────────────────────────────────────────────

describe('inline-font-size', () => {
  it('flags a unitless inline fontSize (the check-theme-only CI gap)', () => {
    const f = find(`<div style={{ padding: '6px 8px', fontSize: 11 }} />`)
    expect(kinds(f)).toContain('inline-font-size')
  })

  it('flags a px font-size in CSS', () => {
    const f = find('.a { font-size: 13px; }', 'src/a.module.css')
    expect(kinds(f)).toContain('inline-font-size')
  })

  it('does NOT flag a token reference', () => {
    const f = find(`<div style={{ fontSize: VX.text.sm }} />`)
    expect(kinds(f)).not.toContain('inline-font-size')
  })

  it('does NOT flag a relative unit', () => {
    const f = find('.a { font-size: 0.8rem; }', 'src/a.module.css')
    expect(kinds(f)).not.toContain('inline-font-size')
  })
})

// ── 26. in-body-page-title (the text lane of law C8) ─────────────────────────

describe('in-body-page-title', () => {
  it('flags <Title order={1}> in the body', () => {
    expect(kinds(find(`<Title order={1}>Analytics</Title>`))).toContain('in-body-page-title')
  })

  it('flags order={2} too', () => {
    expect(kinds(find(`<Title order={2}>Analytics</Title>`))).toContain('in-body-page-title')
  })

  // The formatted default — the reason this kind is a bounded TAG scan and not a line regex.
  it('flags a Title formatted across lines', () => {
    const f = find(`<Title\n  order={1}\n  mb="sm"\n>\n  Analytics\n</Title>`)
    expect(kinds(f)).toContain('in-body-page-title')
  })

  it('does NOT flag order={3} — a section heading', () => {
    expect(kinds(find(`<Title order={3}>Sessions</Title>`))).not.toContain('in-body-page-title')
  })

  it('does NOT flag a Title with no order', () => {
    expect(kinds(find(`<Title>Sessions</Title>`))).not.toContain('in-body-page-title')
  })

  it('does NOT flag anything under a content/ path segment', () => {
    const f = find(`<Title order={1}>Doc</Title>`, 'src/content/Guide.tsx')
    expect(kinds(f)).not.toContain('in-body-page-title')
  })

  // File-scoped and coarser than the plugin's node-level ancestry, on purpose: a document heading
  // told to become a breadcrumb is the WRONG advice, so the text lane errs silent.
  it('does NOT flag a file that renders Prose', () => {
    const f = find(`<Prose>\n  <Title order={1}>Doc</Title>\n</Prose>`)
    expect(kinds(f)).not.toContain('in-body-page-title')
  })

  it('honours a theme-allow', () => {
    const f = find(
      `// theme-allow in-body-page-title — a shell-less print view\n<Title order={1}>P</Title>`,
    )
    expect(kinds(f)).not.toContain('in-body-page-title')
  })

  // Promoted at 1.27.0 — its GRACE_PERIOD_KINDS entry is gone, and so is the plugin rule of the
  // same id from PLUGIN_RULE_GRACE. One law, two lanes, one promotion.
  it('lands error now that the grace entry is gone (C16)', () => {
    const f = find(`<Title order={1}>Analytics</Title>`)
    expect(f.find((x) => x.kind === 'in-body-page-title')?.severity).toBe('error')
  })
})

// ── 27. raw-selection-control (the text lane of law C1) ──────────────────────

describe('raw-selection-control', () => {
  it.each(['SegmentedControl', 'Select', 'MultiSelect', 'NativeSelect', 'TagsInput', 'Chip.Group'])(
    'flags a raw <%s>',
    (tag) => {
      expect(kinds(find(`<${tag} data={[]} />`))).toContain('raw-selection-control')
    },
  )

  it('reports the tag it found, not the whole line', () => {
    const f = find(`<Select data={[]} />`)
    expect(f.find((x) => x.kind === 'raw-selection-control')?.token).toBe('<Select')
  })

  it.each(['SettingsRow', 'Modal', 'Drawer', 'Menu.Dropdown'])(
    'does NOT flag one inside a %s window',
    (host) => {
      const f = find(`<${host}>\n  <Select data={[]} />\n</${host}>`)
      expect(kinds(f)).not.toContain('raw-selection-control')
    },
  )

  // The window is 12 lines; past it the approximation would start swallowing the NEXT row's control.
  it('DOES flag one 20 lines below the host tag — the window is bounded', () => {
    const f = find(`<Modal>\n${'  <Text>x</Text>\n'.repeat(20)}  <Select data={[]} />\n</Modal>`)
    expect(kinds(f)).toContain('raw-selection-control')
  })

  it('does NOT flag anything in a file importing @mantine/form', () => {
    const f = find(`import { useForm } from '@mantine/form'\n<Select data={[]} />`)
    expect(kinds(f)).not.toContain('raw-selection-control')
  })

  it('does NOT flag the file that DEFINES a basalt control', () => {
    const f = find(`export function ViewTabs() {\n  return <SegmentedControl data={[]} />\n}`)
    expect(kinds(f)).not.toContain('raw-selection-control')
  })

  // The owner exemption's SECOND half, the plugin's predicate mirrored: `PanelRow` is an ordinary
  // name for a consumer's own layout helper, and matching it bare let one local declaration switch
  // this kind off for the whole file. A file that IMPORTS basalt is consuming it, not defining it.
  it('DOES flag a consumer file that declares its own PanelRow and imports basalt-ui', () => {
    const f = find(
      `import { Section } from 'basalt-ui'\n` +
        `function PanelRow({ children }) {\n  return <div>{children}</div>\n}\n` +
        `<Section title="x">\n  <Select value={v} onChange={set} data={[]} />\n</Section>`,
    )
    expect(kinds(f)).toContain('raw-selection-control')
  })

  // The basalt SUBTREE homes, mirrored from the plugin's `BASALT_HOST_TAGS` so one law does not
  // read differently in the two lanes: the children of a FilterSet / PageAside / PanelRow ARE the
  // home. Before this the AST lane treated all three as homes and this one knew none of them.
  it.each(['FilterSet', 'PageAside', 'PanelRow'])(
    'does NOT flag one inside a %s window — the children ARE the home',
    (host) => {
      const f = find(`<${host} label="Scale">\n  <Select data={[]} />\n</${host}>`)
      expect(kinds(f)).not.toContain('raw-selection-control')
    },
  )

  it('does NOT flag a bound basalt control', () => {
    expect(kinds(find(`<SelectFilter field={f} label="Channel" />`))).not.toContain(
      'raw-selection-control',
    )
  })

  it('honours a theme-allow', () => {
    const f = find(
      `{/* theme-allow raw-selection-control — a one-off admin picker */}\n<Select data={[]} />`,
    )
    expect(kinds(f)).not.toContain('raw-selection-control')
  })

  // The CROSS-FILE exemption — the same basename convention the plugin's `control-outside-home`
  // applies, so both lanes agree on the same file (one law, two lanes, one exemption). argo carried
  // 9 of these: a control in a modal/form module whose `<Modal>` is rendered by the parent, which is
  // outside the 12-line host window because the host tag is not in the file at all.
  it.each([
    'src/edit-session-modal.tsx',
    'src/filters-drawer.tsx',
    'src/column-popover.tsx',
    'src/detail-panel.tsx',
    'src/booking-form.tsx',
  ])('does NOT flag %s — the overlay filename convention', (relPath) => {
    expect(kinds(find(`<Select data={[]} />`, relPath))).not.toContain('raw-selection-control')
  })

  it('still flags a page module beside them', () => {
    expect(kinds(find(`<Select data={[]} />`, 'src/bookings-page.tsx'))).toContain(
      'raw-selection-control',
    )
  })

  // The SECOND dialect, added with the plugin's: a repo mandating `PascalCase.tsx` for component
  // files can never write `foo-panel.tsx`, so the kebab form alone exempted nothing there.
  it.each(['src/EditSessionModal.tsx', 'src/FiltersDrawer.tsx', 'src/CbbiPanel.tsx'])(
    'does NOT flag %s — the PascalCase dialect of the same convention',
    (relPath) => {
      expect(kinds(find(`<Select data={[]} />`, relPath))).not.toContain('raw-selection-control')
    },
  )

  // Basename only, and it needs the leading subject IN BOTH DIALECTS: a `modal/` DIRECTORY holds
  // the page pieces around the modals too, a bare `modal.tsx`/`Panel.tsx` is a page module in every
  // consumer that has one, and neither dialect is case-insensitive.
  it.each(['src/modal/session.tsx', 'src/modal.tsx', 'src/Panel.tsx', 'src/foopanel.tsx'])(
    'is a subject-prefixed BASENAME convention, not %s',
    (relPath) => {
      expect(kinds(find(`<Select data={[]} />`, relPath))).toContain('raw-selection-control')
    },
  )

  // Still warn at 1.27.0 — this kind and its AST twin `basalt/control-outside-home` are the C1 pair
  // re-dated to `promote: '1.30.0'` while the other wave-6 entries promoted.
  it('lands warn while the grace entry stands (C16)', () => {
    const f = find(`<Select data={[]} />`)
    expect(f.find((x) => x.kind === 'raw-selection-control')?.severity).toBe('warn')
  })
})

// ── 26. hidden-inline-style ──────────────────────────────────────────────────

describe('hidden-inline-style', () => {
  it('flags a multi-line-formatted raw div the line scan cannot see', () => {
    const f = find(
      `export const C = () => (
  <div
    className="x"
    style={{
      display: 'flex',
      padding: 12,
    }}
  />
)`,
    )
    expect(kinds(f)).toContain('hidden-inline-style')
  })

  it('flags a hoisted style const passed by identifier', () => {
    const f = find(
      `const wrapperStyle = { position: 'relative', width: '100%' }
export const C = () => <div className="x" style={wrapperStyle} />`,
    )
    expect(kinds(f)).toContain('hidden-inline-style')
  })

  it('does NOT double-report what raw-html-layout already owns', () => {
    const f = find(`<div style={{ display: 'flex', padding: 12 }} />`)
    expect(kinds(f)).toContain('raw-html-layout')
    expect(kinds(f)).not.toContain('hidden-inline-style')
  })

  it('does NOT flag a hoisted const with no layout/surface property', () => {
    const f = find(
      `const labelStyle = { fontWeight: 500 }
export const C = () => <div style={labelStyle} />`,
    )
    expect(kinds(f)).not.toContain('hidden-inline-style')
  })

  it('is an error now that its grace minor has ended (promoted, C16)', () => {
    const f = find(
      `const wrapperStyle = { position: 'relative', width: '100%' }
export const C = () => <div style={wrapperStyle} />`,
    )
    expect(f.find((v) => v.kind === 'hidden-inline-style')?.severity).toBe('error')
  })
})

// ── 27. raw-color-fn on computed colors ──────────────────────────────────────

describe('raw-color-fn — computed values', () => {
  it('does NOT flag a color function whose first channel is interpolated', () => {
    const f = find('const swatch = `rgb(${px[0]}, ${px[1]}, ${px[2]})`')
    expect(kinds(f)).not.toContain('raw-color-fn')
  })

  it('still flags a literal color with only a variable alpha', () => {
    const f = find('const s = `rgba(0, 0, 0, ${opacity})`')
    expect(kinds(f)).toContain('raw-color-fn')
  })
})

// ── 28. generated-file marker ────────────────────────────────────────────────

describe('@generated basalt-ui marker', () => {
  const HEADER = `${GENERATED_HEADER_LINE}\n/* basalt-ui 1.20.0 — \`basalt-ui tokens:css --only core\` */\n`
  const BODY = ':root {\n  --vx-fill-gray: #717176;\n  --vx-axis: rgba(255, 255, 255, 0.6);\n}\n'
  const EMITTED = `${HEADER}${BODY}`

  it('skips a file basalt itself emitted', () => {
    expect(find(EMITTED, 'src/styles/basalt-tokens.css')).toHaveLength(0)
  })

  // ── the forgery half: the marker was a whole-file bypass anyone could hand-write ──────────────

  it('ignores the marker entirely outside a .css file', () => {
    const forged = `${HEADER}export const C = () => <div style={{ color: '#ff0000', padding: 18 }} />\n`
    expect(kinds(find(forged, 'src/a.tsx'))).toContain('raw-hex')
    expect(kinds(find(forged, 'src/a.tsx'))).toContain('inline-spacing')
  })

  it('does not exempt hand-written CSS wearing the header', () => {
    const forged = `${HEADER}.btn { color: #ff0000; }\n`
    expect(kinds(find(forged, 'src/a.css'))).toContain('raw-hex')
  })

  it('does not exempt a generated sheet with an ordinary rule smuggled onto the end', () => {
    const smuggled = `${EMITTED}.btn { color: #ff0000; }\n`
    expect(kinds(find(smuggled, 'src/tokens.css'))).toContain('raw-hex')
  })

  it('requires the provenance line, not just the marker', () => {
    const bare = `${GENERATED_HEADER_LINE}\n${BODY}`
    expect(kinds(find(bare, 'src/tokens.css'))).toContain('raw-hex')
    const loose = `/* @generated basalt-ui */\n${BODY}`
    expect(kinds(find(loose, 'src/tokens.css'))).toContain('raw-hex')
  })

  // ── the header WINDOW: exactly the two lines the emitter writes, and no more ──────────────────

  it('honours the header only on lines 1-2', () => {
    const onLineOne = `${HEADER}${BODY}`
    expect(find(onLineOne, 'src/tokens.css')).toHaveLength(0)
    // One blank line ahead of it is already outside the window — the boundary is exact, not "the
    // first few lines", which is what let a marker be pasted in above unrelated content.
    const shifted = `\n${HEADER}${BODY}`
    expect(kinds(find(shifted, 'src/tokens.css'))).toContain('raw-hex')
    const buried = `${'\n'.repeat(8)}${HEADER}${BODY}`
    expect(kinds(find(buried, 'src/tokens.css'))).toContain('raw-hex')
  })

  // ── the second forgery round: the line-shape allowlist itself was forgeable ───────────────────
  //
  // Both of the first two were demonstrated against the real `checkSource`, and both were valid,
  // browser-effective CSS bought a WHOLE-FILE exemption. Every case below must report — a passing
  // `toHaveLength(0)` here would mean the hole is open again.

  const forgeries: ReadonlyArray<readonly [string, string]> = [
    // A `;` inside a custom-property value smuggled two ordinary declarations onto a line the
    // allowlist read as "a basalt custom property".
    [
      'a semicolon inside a custom-property value',
      `${HEADER}:root {\n  --vx-pad: 0; box-shadow: 0 0 0 1px #ff0000; border-radius: 11px;\n}\n`,
    ],
    // The comment branch was `\/\*.*` — it never required the comment to CLOSE, so anything after
    // `*/` rode along.
    ['a comment that never closes', `${HEADER}/* x */ .btn { color: #ff0000; }\n`],
    // A comment reopened mid-line: closing and reopening keeps the line comment-SHAPED at both
    // ends while the middle is a live declaration.
    ['a comment reopened mid-line', `${HEADER}:root {\n  /* a */ color: #ff0000 /* b */\n}\n`],
    // The first line of a multi-line declaration ends in `,`, which is also how a selector list
    // continues — the depth check is what tells them apart.
    [
      'a multi-line declaration whose first line ends in a comma',
      `${HEADER}.btn {\n  box-shadow: 0 0 0 1px #ff0000,\n    0 0 2px #00ff00;\n}\n`,
    ],
    // The at-rule branch permitted `;`, so a declaration could ride behind `@…;`.
    ['a declaration behind an at-rule', `${HEADER}@media all; color: #ff0000;\n`],
    // No trailing `;` anywhere, so nothing to split on.
    ['a whole rule on one line with no semicolon', `${HEADER}.btn { color: #ff0000 }\n`],
    [
      'a rule reopened after a closing brace',
      `${HEADER}:root {\n  --vx-a: #fff;\n} .btn { color: #ff0000; }\n`,
    ],
    ['a nested block', `${HEADER}:root {\n  .btn {\n    color: #ff0000;\n  }\n}\n`],
  ]

  for (const [what, source] of forgeries) {
    it(`reports ${what}`, () => {
      expect(find(source, 'src/tokens.css').length).toBeGreaterThan(0)
    })
  }

  it('never skips a line carrying theme-allow, so a hidden waiver still reports', () => {
    // Without this the annotation would waive the line below AND its own unscoped report, because
    // a bare `/* theme-allow */` is comment-SHAPED and would otherwise be a skippable line.
    const smuggled = `${HEADER}/* theme-allow */\n.btn { color: #ff0000; }\n`
    expect(kinds(find(smuggled, 'src/tokens.css'))).toContain('theme-allow-unscoped')
  })

  it('exempts LINES, not the file — a smuggled rule reports without burying it in token values', () => {
    const smuggled = `${EMITTED}.btn { color: #ff0000; }\n`
    const f = find(smuggled, 'src/tokens.css')
    expect(f.map((x) => x.line)).toEqual([7])
    expect(kinds(f)).toEqual(['raw-hex'])
  })
})

// ── 29. markup files ─────────────────────────────────────────────────────────

describe('markup files (index.html / *.webmanifest)', () => {
  it('flags raw hex in index.html', () => {
    const f = find(`<meta name="theme-color" content="#EDEFF2" />`, 'index.html')
    expect(kinds(f)).toContain('raw-hex')
  })

  it('flags raw hex in a webmanifest', () => {
    const f = find(`{ "theme_color": "#242424" }`, 'public/site.webmanifest')
    expect(kinds(f)).toContain('raw-hex')
  })

  it('does not apply the JSX/CSS-in-JS kinds there', () => {
    const f = find(`<div style="padding: 18px"><input /></div>`, 'index.html')
    expect(kinds(f)).not.toContain('raw-form-control')
    expect(kinds(f)).not.toContain('inline-spacing')
  })

  it('honours a theme-allow inside an HTML comment', () => {
    const f = find(
      `<!-- theme-allow raw-hex — favicon mask color -->\n<meta content="#EDEFF2" />`,
      'index.html',
    )
    expect(kinds(f)).not.toContain('raw-hex')
  })
})

// ── 29b. single-file components (.astro / .vue) ───────────────────────────────

/**
 * Round 9: `.astro` and `.vue` became scannable and fell through to the `ts` dialect, so `<!-- … -->`
 * was never stripped — a `theme-allow` written in an HTML comment waived nothing there, and a color
 * inside a commented-out block still reported. They resolve as `sfc` now: BOTH comment dialects,
 * and the full 27-kind set (not `MARKUP_KINDS` — an `.astro` template is JSX-shaped and a `.vue`
 * `<script setup>` is real TS).
 */
describe('single-file components (.astro / .vue)', () => {
  const ASTRO = 'src/pages/index.astro'
  const VUE = 'src/Hero.vue'

  for (const rel of [ASTRO, VUE]) {
    it(`strips an HTML comment in ${rel}`, () => {
      expect(kinds(find(`<!-- <div style="color: #ff0000" /> -->`, rel))).not.toContain('raw-hex')
    })

    it(`honours a theme-allow inside an HTML comment in ${rel}`, () => {
      const f = find(
        `<!-- theme-allow raw-hex — brand asset -->\n<div style="color: #ff0000" />`,
        rel,
      )
      expect(kinds(f)).not.toContain('raw-hex')
    })

    it(`honours a theme-allow-file inside an HTML comment in ${rel}`, () => {
      const f = find(
        `<!-- theme-allow-file raw-hex — brand asset -->\n<b style="color: #ff0000" />`,
        rel,
      )
      expect(kinds(f)).not.toContain('raw-hex')
    })

    it(`honours a multi-line HTML comment annotation in ${rel}`, () => {
      const f = find(
        `<!--\n  theme-allow raw-hex — brand asset\n-->\n<b style="color: #ff0000" />`,
        rel,
      )
      expect(kinds(f)).not.toContain('raw-hex')
    })

    it(`still strips the JS dialect in ${rel} — an SFC carries both`, () => {
      expect(kinds(find(`// const c = '#ff0000'`, rel))).not.toContain('raw-hex')
      expect(kinds(find(`/* const c = '#ff0000' */`, rel))).not.toContain('raw-hex')
    })

    it(`honours a theme-allow in the script fence of ${rel}`, () => {
      const f = find(`// theme-allow raw-hex — brand asset\nconst c = '#ff0000'`, rel)
      expect(kinds(f)).not.toContain('raw-hex')
    })

    it(`keeps the non-markup kinds — an SFC is not MARKUP_KINDS-restricted in ${rel}`, () => {
      expect(kinds(find(`const s = { border: '1px solid #ccc' }`, rel))).toContain('raw-surface')
      expect(kinds(find(`<div style={{ padding: 18 }} />`, rel))).toContain('inline-spacing')
    })
  }

  it('does not let an HTML comment open a runaway JS block comment', () => {
    const f = find(`<!-- a /* unclosed -->\n<div style="color: #ff0000" />`, ASTRO)
    expect(kinds(f)).toContain('raw-hex')
  })

  /**
   * Asserted LIMITS, so "unsupported" and "silently broken" don't read the same. Both are
   * false-negative-only — the direction a release-blocking false positive says to take.
   */
  describe('known limits', () => {
    it('does not fire the kebab-CSS surface kinds inside a <style> fence', () => {
      const src = `<style>\n  .card { border-radius: 8px; }\n</style>`
      expect(kinds(find(src, ASTRO))).not.toContain('css-raw-surface')
      // The same text in a real .css file still reports — the limit is the SFC dialect, not the rule.
      expect(kinds(find(src.replace(/<\/?style>/g, ''), 'src/a.css'))).toContain('css-raw-surface')
    })

    it('over-strips a `<!--` that lives inside a script string', () => {
      expect(
        kinds(find(`const s = '<!--'\nconst c = '#ff0000'\nconst e = '-->'`, ASTRO)),
      ).not.toContain('raw-hex')
    })

    it('over-strips after an unquoted `https://` in template prose', () => {
      expect(
        kinds(find(`<p>see https://x.test <b style="color: #ff0000" /></p>`, ASTRO)),
      ).not.toContain('raw-hex')
    })
  })
})

// ── 30. tokens-only profile ──────────────────────────────────────────────────

describe("profile: 'tokens-only'", () => {
  const TOKENS_ONLY = { ...DEFAULT_GUARD_CONFIG, profile: 'tokens-only' as const }

  it('drops the kinds whose remedy is a Mantine component', () => {
    const src = `<input /> // a Mantine-free consumer has no TextInput to reach for`
    expect(kinds(checkSource(src, PATH, DEFAULT_GUARD_CONFIG))).toContain('raw-form-control')
    expect(kinds(checkSource(src, PATH, TOKENS_ONLY))).not.toContain('raw-form-control')
  })

  it('keeps the color kinds — the token layer IS what they consume', () => {
    const f = checkSource(`.a { color: #ff0000; }`, 'src/a.css', TOKENS_ONLY)
    expect(kinds(f)).toContain('raw-hex')
  })

  /**
   * Every kind, classified by hand: is its remedy a Mantine component, a Mantine prop, or the React
   * theme factory? The exhaustive literal IS the test — the previous spot check of four kinds is
   * how `hidden-inline-style` shipped ENABLED under the profile, telling a Mantine-free app to
   * import Box/Flex in a message copied word for word from `raw-html-layout`, which is disabled.
   * A new kind fails the first assertion until it is classified here.
   */
  const MANTINE_COUPLED: Record<GuardKind, boolean> = {
    'raw-hex': false,
    'raw-color-fn': false,
    'localstorage-theme': true,
    'off-identity-accent': true,
    'mantine-shade-index': true,
    'raw-spacing': true,
    'raw-radius': true,
    'raw-surface': false,
    'card-with-border': true,
    'off-system-surface-var': true,
    'raw-html-layout': true,
    'inline-spacing': true,
    'inline-display': true,
    'raw-visx-axis': true,
    'raw-motion-value': true,
    'chart-missing-aria-label': true,
    'raw-form-control': true,
    'sub-16-input-font': true,
    'raw-font-family': false,
    'theme-allow-unscoped': false,
    'surface-shadow-override': false,
    'css-raw-surface': false,
    'inline-font-size': false,
    'hidden-inline-style': true,
    // The two wave-6 control kinds: `<Title>` is a Mantine component, and the remedy for either is
    // a Mantine-rendered home (PageBar / WidgetHeader) or a basalt control over @mantine/core.
    'in-body-page-title': true,
    'raw-selection-control': true,
  }

  it('classifies every kind in the registry — the table is exhaustive', () => {
    expect(Object.keys(MANTINE_COUPLED).toSorted()).toEqual(Object.keys(GUARD_RULES).toSorted())
    expect(Object.keys(MANTINE_COUPLED)).toHaveLength(26)
  })

  it('the disabled set is exactly the Mantine-coupled half — a complete partition', () => {
    for (const [kind, coupled] of Object.entries(MANTINE_COUPLED) as [GuardKind, boolean][]) {
      expect([kind, TOKENS_ONLY_DISABLED_KINDS.has(kind)]).toEqual([kind, coupled])
    }
    expect(TOKENS_ONLY_DISABLED_KINDS.size).toBe(
      Object.values(MANTINE_COUPLED).filter(Boolean).length,
    )
  })

  it('no surviving kind tells a Mantine-free app to reach for a Mantine component', () => {
    const MANTINE_REMEDY =
      /@mantine\/|\b(?:Box|Flex|Grid|Stack|Group|TextInput|NumberInput|Select|Textarea)\b/
    for (const kind of Object.keys(GUARD_RULES) as GuardKind[]) {
      if (TOKENS_ONLY_DISABLED_KINDS.has(kind)) continue
      expect([kind, MANTINE_REMEDY.test(GUARD_RULES[kind].message)]).toEqual([kind, false])
    }
  })

  it("hidden-inline-style is off — its remedy is raw-html-layout's, word for word", () => {
    const src =
      "const s = { display: 'flex', padding: 18 }\nexport const D = () => <div style={s} />"
    expect(kinds(checkSource(src, PATH, DEFAULT_GUARD_CONFIG))).toContain('hidden-inline-style')
    expect(kinds(checkSource(src, PATH, TOKENS_ONLY))).not.toContain('hidden-inline-style')
  })
})

// ── 31. remedy + waiver hint — what a report actually PRINTS ─────────────────

describe('guardKindRemedy', () => {
  // `check-theme`'s `Fix:` epilogue read a hand-duplicated subset of these, and the subset was
  // missing every kind added at 1.20.0. All five of those ship `warn` under grace, so the findings
  // whose whole argument is "this looks correct and is not" arrived with no argument — only "add a
  // `theme-allow`", which reads as advice to waive. Sourcing it from the registry retires the
  // duplicate instead of extending it, and this test is what stops a new kind shipping without one.
  it('gives every kind a remedy, prefixed with the kind id', () => {
    for (const kind of Object.keys(GUARD_RULES) as GuardKind[]) {
      const remedy = guardKindRemedy(kind)
      expect([kind, remedy.startsWith(`${kind}: `)]).toEqual([kind, true])
      expect([kind, remedy.length > kind.length + 20]).toEqual([kind, true])
    }
  })

  it('covers the five 1.20.0 kinds that the duplicated table did not', () => {
    for (const kind of [
      'surface-shadow-override',
      'css-raw-surface',
      'inline-font-size',
      'hidden-inline-style',
      'theme-allow-unscoped',
    ] as GuardKind[]) {
      expect([kind, guardKindRemedy(kind)]).toEqual([kind, `${kind}: ${GUARD_RULES[kind].message}`])
    }
  })

  // argo: the kind fires on a fixed dock replacing card depth, where the right answer is the
  // overlay tier — and `SHADOW_KEEPS_CARD_DEPTH` accepts any `--vx-shadow-*`, so the message was
  // narrower than the check and pointed away from the correct token.
  it('surface-shadow-override names the overlay tier, not only the card one', () => {
    expect(guardKindRemedy('surface-shadow-override')).toContain('--vx-shadow-overlay')
  })
})

describe('guardWaiverHint', () => {
  // The `Fix:` closer prescribed a `theme-allow` COMMENT for every file class, including the one
  // 1.20.0 had just started scanning and which cannot hold a comment at all.
  it('never prescribes a comment to a file that cannot carry one', () => {
    for (const relPath of ['public/site.webmanifest', 'src/brand.json']) {
      expect([relPath, /theme-allow[^-]/.test(guardWaiverHint(relPath))]).toEqual([relPath, false])
      expect([relPath, guardWaiverHint(relPath)]).toEqual([
        relPath,
        expect.stringContaining('basalt:theme-allow-file'),
      ])
    }
  })

  // rollhook's sharper point: a manifest hex can never be RIGHT, because a manifest cannot
  // reference a CSS variable — so the value is a hand-copy that drifts. Both consumers that hit it
  // found a dead colour. The remedy is to stop hand-writing the file.
  it('points a manifest at basaltAppPlugin first, and the annotation second', () => {
    const hint = guardWaiverHint('public/site.webmanifest')
    expect(hint).toContain('basaltAppPlugin')
    expect(hint.indexOf('basaltAppPlugin')).toBeLessThan(hint.indexOf('basalt:theme-allow-file'))
  })

  it('prescribes the comment form everywhere a comment exists', () => {
    for (const relPath of ['src/App.tsx', 'src/app.css', 'index.html']) {
      expect([relPath, guardWaiverHint(relPath)]).toEqual([
        relPath,
        expect.stringContaining('theme-allow <rule-id>'),
      ])
    }
  })

  it('names both scopes, so the narrow one is the one a reader reaches for first', () => {
    const hint = guardWaiverHint('src/App.tsx')
    expect(hint.indexOf('theme-allow <rule-id>')).toBeLessThan(hint.indexOf('theme-allow-file'))
  })

  // Every hint has to name a mechanism that EXISTS — the defect it replaces was a hint that did
  // not. These two assert the guard actually honours what each hint prescribes.
  it('the JSON hint names a member the guard honours', () => {
    const f = checkSource(
      '{\n  "basalt:theme-allow-file": "raw-hex — a manifest cannot read a CSS variable",\n  "theme_color": "#27272a"\n}\n',
      'public/site.webmanifest',
      DEFAULT_GUARD_CONFIG,
    )
    expect(kinds(f)).not.toContain('raw-hex')
  })

  it('the comment hint names a form the guard honours', () => {
    expect(kinds(find(`// theme-allow raw-hex — vendor brand\nconst c = '#ff0000'`))).not.toContain(
      'raw-hex',
    )
    expect(
      kinds(find(`// theme-allow-file raw-hex — vendor brand\nconst c = '#ff0000'`)),
    ).not.toContain('raw-hex')
  })
})

// ── 32. inline-spacing — a property bag that never reaches CSS ───────────────

describe('inline-spacing — the style-object test', () => {
  const inlineSpacing = (src: string): GuardKind[] =>
    kinds(find(src)).filter((k) => k === 'inline-spacing')

  // argo: `const FIT_BOUNDS_OPTIONS = { padding: 48, duration: 0 }` is a maplibre `fitBounds`
  // viewport inset measured in MAP pixels. There is no Mantine token that could express it, and
  // "use p/m/gap with xs..xl" is not a thing that can be done to it. The class recurs in any
  // consumer wrapping a map or a canvas library — basalt's own shell carries one (a floating-ui
  // `shift: { padding: 8 }`), which is how it stayed invisible.
  it('does NOT flag a unitless number in a plain options bag', () => {
    expect(inlineSpacing('const FIT_BOUNDS_OPTIONS = { padding: 48, duration: 0 }')).toEqual([])
  })

  it('does NOT flag a unitless number in a call argument', () => {
    expect(inlineSpacing('map.fitBounds(bounds, { padding: 48 })')).toEqual([])
  })

  it('does NOT flag a nested non-style bag (floating-ui middleware)', () => {
    expect(inlineSpacing('const M = { flip: false, shift: { padding: 8 } }')).toEqual([])
  })

  // Everything the kind was built for still reports.
  it.each([
    '<Box style={{ padding: 16 }} />',
    '<Box\n  style={{\n    padding: 16,\n  }}\n/>',
    '<Input styles={{ input: { paddingLeft: 12 } }} />',
    'const wrapperStyle = { padding: 16 }',
    'const s: CSSProperties = { marginTop: 12 }',
  ])('still flags %s', (src) => {
    expect([src, inlineSpacing(src)]).toEqual([src, ['inline-spacing']])
  })

  // The hoisted form the name alone does not give away — resolved from the `style={…}` use site,
  // the same seam `hidden-inline-style` already walks.
  it('flags a hoisted object the file hands to a style prop', () => {
    expect(
      inlineSpacing('const s = { padding: 16 }\nexport const D = () => <div style={s} />'),
    ).toEqual(['inline-spacing'])
  })

  // A UNIT is evidence the number is CSS wherever it was written, so it never consults the context.
  it.each([`const OPTS = { padding: '16px' }`, `const OPTS = { marginTop: '1.5rem' }`])(
    '%s carries a unit and is flagged regardless of context',
    (src) => {
      expect([src, inlineSpacing(src)]).toEqual([src, ['inline-spacing']])
    },
  )

  it('CSS is untouched by the test — there is no object context to consult', () => {
    const f = checkSource('.a { padding: 18px }', 'src/Card.module.css', DEFAULT_GUARD_CONFIG)
    expect(kinds(f)).toContain('inline-spacing')
  })
})

// ── theme-allow shape grid ───────────────────────────────────────────────────────────────────────

/**
 * The whole shape space of an annotation, pinned cell by cell.
 *
 * FIVE holes have been found in this one contract in four rounds — two false positives, one false
 * negative, and twice the guard and the oxlint plugin disagreeing about what an annotation IS. Each
 * was found by a consumer writing a shape nobody had thought to test, and round 6's answer (a
 * thirteen-shape list of "every shape a consumer actually writes") missed the next three anyway,
 * because a list of observed shapes cannot cover the ones not yet observed.
 *
 * So this is a GRID over the four things that actually vary, not a list of anecdotes:
 *
 * | axis | values |
 * |-|-|
 * | comment style | `//` · `/* *\/` · `/** *\/` · `{/* *\/}` · `{/** *\/}` · `<!-- -->` · JSON member |
 * | token position | opener line · gutter line · trailing after code |
 * | where the closer falls | the token's line · its own line · N lines below · n/a |
 * | what follows | code · blank then code · comment then code · code on the closer's line |
 *
 * `configs/oxlint-plugin.test.ts` pins the same grid, under the same row names, for the subset the
 * plugin can judge (TS/JSX — it never sees CSS, HTML or JSON). The two halves must agree on every
 * shared cell; add a row to one and it goes in the other in the same commit.
 *
 * The unsupported cells are asserted too. "Unsupported" and "silently broken" read identically to a
 * consumer, and the whole point of the grid is to make them different things.
 */
/** Wraps JSX children in a component, so a `{/* … *\/}` child is legal source. */
const jsxShape = (body: string): string =>
  `export const C = () => (\n  <div>\n${body}\n  </div>\n)\n`

/** Does the file waive its `raw-hex`? — the one question every grid row asks. */
const shapeWaives = (relPath: string, src: string): boolean =>
  checkSource(src, relPath, DEFAULT_GUARD_CONFIG).filter((f) => f.kind === 'raw-hex').length === 0

describe('theme-allow shape grid', () => {
  const REASON = 'deliberate legacy value'
  const A = `theme-allow raw-hex — ${REASON}`
  const AF = `theme-allow-file raw-hex — ${REASON}`
  /** The statement the guard reports `raw-hex` on. */
  const T = `const a = '#f00'`
  /** The JSX child the guard reports `raw-hex` on. */
  const JT = `<span style={{ color: '#f00' }} />`
  const J = jsxShape
  const waives = shapeWaives

  // ── SUPPORTED — every cell of the grid that waives ────────────────────────
  it.each([
    // `//` — no closer to place.
    ['// own line', PATH, `// ${A}\n${T}\n`],
    ['// indented', PATH, `function f() {\n  // ${A}\n  ${T}\n}\n`],
    ['// no space after the marker', PATH, `//${A}\n${T}\n`],
    ['// trailing', PATH, `${T} // ${A}\n`],
    ['// reason wrapped onto a second // comment', PATH, `// ${A},\n// continued here\n${T}\n`],
    // `/* */` and `/** */` at statement level, closer in each of its three places.
    ['/* */ own line', PATH, `/* ${A} */\n${T}\n`],
    ['/* */ trailing', PATH, `${T} /* ${A} */\n`],
    ['/** */ own line (docblock opener)', PATH, `/** ${A} */\n${T}\n`],
    ['/* opener + token, closer on its own line', PATH, `/* ${A}\n*/\n${T}\n`],
    ['/* gutter token, closer on the token line', PATH, `/*\n ${A} */\n${T}\n`],
    ['/* gutter token, closer on its own line', PATH, `/*\n ${A}\n*/\n${T}\n`],
    ['/** star gutter, closer on the token line', PATH, `/**\n * ${A} */\n${T}\n`],
    ['/** star gutter, closer on its own line', PATH, `/**\n * ${A}\n */\n${T}\n`],
    // Prose between the token and the closer — any amount of it.
    ['/** token then 1 prose line', PATH, `/**\n * ${A}\n * more\n */\n${T}\n`],
    ['/** token then 12 prose lines', PATH, `/**\n * ${A}\n${' * p\n'.repeat(12)} */\n${T}\n`],
    [
      '/** prose first, token on a later gutter line',
      PATH,
      `/**\n * some prose\n * ${A}\n */\n${T}\n`,
    ],
    // JSX expression containers — the family every disagreement so far has come from.
    ['{/* */} own line', PATH, J(`    {/* ${A} */}\n    ${JT}`)],
    ['{/* */} trailing on the target line', PATH, J(`    ${JT} {/* ${A} */}`)],
    ['{/* opener + token, closer on its own line', PATH, J(`    {/* ${A}\n    */}\n    ${JT}`)],
    ['{/* gutter token, closer on the token line', PATH, J(`    {/*\n      ${A} */}\n    ${JT}`)],
    [
      '{/* gutter token, closer on its own line',
      PATH,
      J(`    {/*\n      ${A}\n    */}\n    ${JT}`),
    ],
    ['{/** star gutter, closer on the token line', PATH, J(`    {/**\n     * ${A} */}\n    ${JT}`)],
    [
      '{/** star gutter, closer on its own line',
      PATH,
      J(`    {/**\n     * ${A}\n     */}\n    ${JT}`),
    ],
    [
      '{/** token then 6 prose lines',
      PATH,
      J(`    {/**\n     * ${A}\n${'     * p\n'.repeat(6)}     */}\n    ${JT}`),
    ],
    ['{/* target on the closer line', PATH, J(`    {/*\n      ${A}\n    */}${JT}`)],
    ['{/* closer alone, tab indented', PATH, J(`\t{/*\n\t  ${A}\n\t*/}\n\t${JT}`)],
    [
      '{/* closer alone, space between */ and }',
      PATH,
      J(`    {/*\n      ${A}\n    */ }\n    ${JT}`),
    ],
    [
      '{/* closer alone, two annotations in one block',
      PATH,
      J(`    {/*\n      ${A}\n      theme-allow raw-color-fn — ${REASON}\n    */}\n    ${JT}`),
    ],
    // A further comment between the annotation and the code is walked through; a blank line is not.
    ['/** */ then an unrelated // note', PATH, `/** ${A} */\n// an unrelated note\n${T}\n`],
    [
      '{/* */} then an unrelated {/* */}',
      PATH,
      J(`    {/* ${A} */}\n    {/* unrelated */}\n    ${JT}`),
    ],
    // The file-declaration form, which is position-independent — pinned in two placements anyway,
    // because "position-independent" is a claim the parser has to keep making.
    [
      'theme-allow-file, {/* closer on its own line',
      PATH,
      J(`    {/*\n      ${AF}\n    */}\n    ${JT}`),
    ],
    ['theme-allow-file, /** star gutter', PATH, `/**\n * ${AF}\n */\n${T}\n`],
    // Dialects the plugin never sees — CSS continuation lines, HTML, and the JSON member form.
    ['css trailing', 'src/a.css', `a { color: #f00; /* ${A} */ }\n`],
    [
      'css reflowed onto continuation lines',
      'src/a.css',
      `a {\n  color: var(\n    --x,\n    #f00\n  ); /* ${A} */\n}\n`,
    ],
    ['html comment own line', 'index.html', `<!-- ${A} -->\n<b style="color: #f00"></b>\n`],
    ['html trailing comment', 'index.html', `<b style="color: #f00"></b> <!-- ${A} -->\n`],
    [
      'JSON member form',
      'public/site.webmanifest',
      `{\n  "basalt:theme-allow-file": "raw-hex — ${REASON}",\n  "theme_color": "#f00"\n}\n`,
    ],
  ])('%s waives', (_name, relPath, src) => {
    expect(waives(relPath as string, src as string)).toBe(true)
  })

  // ── UNSUPPORTED — asserted, so a hole can never pass for a design decision ──
  it.each([
    // A blank line is the separation people use for "this comment is not about the next statement".
    ['blank line after a // annotation', PATH, `// ${A}\n\n${T}\n`],
    ['blank line after a {/* */} annotation', PATH, J(`    {/* ${A} */}\n\n    ${JT}`)],
    [
      'blank line after a {/* closer on its own line',
      PATH,
      J(`    {/*\n      ${A}\n    */}\n\n    ${JT}`),
    ],
    // Prose that MENTIONS the token is not an annotation — the one false NEGATIVE in the set, and
    // the reason the token has to START its comment.
    ['mid-sentence in a line comment', PATH, `// we normally write a ${A} here\n${T}\n`],
    [
      'mid-sentence in a docblock gutter',
      PATH,
      `/**\n * Each value is escaped with a ${A} annotation.\n */\n${T}\n`,
    ],
    [
      'mid-sentence in a JSX expression comment',
      PATH,
      J(`    {/* the shape here is a ${A} comment */}\n    ${JT}`),
    ],
    ['inside a string literal', PATH, `const doc = 'theme-allow raw-hex'\n${T}\n`],
    // An annotation reaches the first line below its comment — not an arbitrary line further down.
    // A multi-line opening tag therefore needs the annotation beside the attribute, not above the
    // tag. Both halves agree, and both report rather than silently waiving the wrong node.
    [
      'above a multi-line opening tag',
      PATH,
      J(`    {/* ${A} */}\n    <span\n      style={{ color: '#f00' }}\n    />`),
    ],
  ])('%s does NOT waive', (_name, relPath, src) => {
    expect(waives(relPath as string, src as string)).toBe(false)
  })

  // The narrowness of the `*/}` exception: a `}` that is REAL code keeps its trailing
  // classification, so the annotation does not reach the statement below it.
  it('a trailing annotation on a real closing brace stays on its own line', () => {
    const src = `function f() {\n  const a = 1\n} // ${A}\nconst b = '#0f0'\n`
    expect(
      checkSource(src, PATH, DEFAULT_GUARD_CONFIG)
        .filter((f) => f.kind === 'raw-hex')
        .map((f) => f.line),
    ).toEqual([4])
  })

  // A trailing annotation is scoped to its OWN line — otherwise `const a = '#f00' // theme-allow`
  // would silently waive the statement below it too.
  it('a trailing annotation does not reach the line below', () => {
    const src = `const a = '#f00' // ${A}\nconst b = '#0f0'\n`
    expect(
      checkSource(src, PATH, DEFAULT_GUARD_CONFIG).filter((f) => f.kind === 'raw-hex'),
    ).toHaveLength(1)
  })
})

// ── findAllowAnnotations / neutralizeAllowAnnotation ─────────────────────────────────────────────

describe('findAllowAnnotations', () => {
  const cfg = DEFAULT_GUARD_CONFIG

  it('classifies each named id by whose reach it falls in', () => {
    const src = [
      `// theme-allow raw-hex — a guard kind`,
      `const a = '#f00'`,
      `// theme-allow hand-rolled-plot — a plugin rule, outside checkSource's reach`,
      `const b = 1`,
      `// theme-allow raw-hexx — a typo`,
      `const c = 2`,
      `// theme-allow`,
      `const d = 3`,
    ].join('\n')
    const sites = findAllowAnnotations(src, PATH, cfg)

    expect(sites.map((s) => s.line)).toEqual([1, 3, 5, 7])
    expect(sites[0]).toMatchObject({ guardKinds: ['raw-hex'], pluginRules: [], bare: false })
    expect(sites[1]).toMatchObject({ guardKinds: [], pluginRules: ['hand-rolled-plot'] })
    expect(sites[2]).toMatchObject({ rules: [], unknownRules: ['raw-hexx'], bare: false })
    expect(sites[3]).toMatchObject({ bare: true, hasReason: false })
  })

  it('records the file-declaration form once, at the line it is written on', () => {
    const src = `// theme-allow-file raw-hex — the whole palette fixture\nconst a = '#f00'\n`
    expect(findAllowAnnotations(src, PATH, cfg)).toMatchObject([
      { line: 1, scope: 'file', guardKinds: ['raw-hex'] },
    ])
  })

  it('carries the source line verbatim, and finds nothing in a file with no annotation', () => {
    expect(findAllowAnnotations(`const a = '#f00'\n`, PATH, cfg)).toEqual([])
    expect(
      findAllowAnnotations(`  // theme-allow raw-hex — why not\nconst a = 1\n`, PATH, cfg)[0]?.text,
    ).toBe('  // theme-allow raw-hex — why not')
  })

  // It shares `collectAllowAnnotations` with `checkSource`, so it cannot list a line the scan does
  // not honour — the mirrored regex `--audit-allows` carried was already one alternation behind.
  it('agrees with checkSource about what is prose and what is an annotation', () => {
    expect(
      findAllowAnnotations(`// a theme-allow raw-hex goes here\nconst a = 1\n`, PATH, cfg),
    ).toEqual([])
    expect(
      findAllowAnnotations(`/** theme-allow raw-hex — deliberate */\nconst a = 1\n`, PATH, cfg),
    ).toHaveLength(1)
  })

  it('finds the JSON member form in a manifest', () => {
    const src = `{\n  "basalt:theme-allow-file": "raw-hex — brand color"\n}\n`
    expect(findAllowAnnotations(src, 'public/site.webmanifest', cfg)).toMatchObject([
      { line: 2, scope: 'file', guardKinds: ['raw-hex'] },
    ])
  })
})

describe('neutralizeAllowAnnotation', () => {
  const cfg = DEFAULT_GUARD_CONFIG

  it('neutralizes ONE annotation and reveals exactly what it suppressed', () => {
    const src = [
      `const a = '#f00' // theme-allow raw-hex — first`,
      `const b = '#0f0' // theme-allow raw-hex — second`,
    ].join('\n')
    expect(checkSource(src, PATH, cfg).filter((f) => f.kind === 'raw-hex')).toEqual([])

    const probe = neutralizeAllowAnnotation(src, 1, cfg)
    expect(probe).toContain(NEUTRALIZED_ALLOW_TOKEN)
    expect(
      checkSource(probe, PATH, cfg)
        .filter((f) => f.kind === 'raw-hex')
        .map((f) => f.line),
    ).toEqual([1])
  })

  it('leaves a line with no token, and an out-of-range line, untouched', () => {
    const src = `const a = 1\nconst b = 2\n`
    expect(neutralizeAllowAnnotation(src, 1, cfg)).toBe(src)
    expect(neutralizeAllowAnnotation(src, 99, cfg)).toBe(src)
  })

  it('the neutralized token shares no substring with the annotation it replaces', () => {
    expect(NEUTRALIZED_ALLOW_TOKEN).not.toContain(cfg.allowComment)
    expect(NEUTRALIZED_ALLOW_TOKEN.includes('theme-allow')).toBe(false)
  })
})

describe('PLUGIN_RULE_IDS', () => {
  it('names no guard kind — the two registries are disjoint by construction', () => {
    for (const id of PLUGIN_RULE_IDS) expect(Object.hasOwn(GUARD_RULES, id)).toBe(false)
  })
})
