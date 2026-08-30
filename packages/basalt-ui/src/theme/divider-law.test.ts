/**
 * The divider law — a mechanical inventory of every HORIZONTAL hairline basalt draws
 * (`docs/DESIGN-SPEC.md` §8: depth is a shadow, and a border-as-border is reserved for a layout
 * divider).
 *
 * The bug this file exists to prevent, measured on the playground's `Controls (mobile)` page at
 * 390px: the page carried five rules in its first 320px — a table box whose top edge sat directly
 * under the table's own `WidgetHeader`, its bottom edge on the last row's own hairline, and a
 * section rule 8px from the next one. None of them divided anything. Two rules stack into a band,
 * and a band under a heading says "the heading is not part of what follows", which is the opposite
 * of what a section header is for.
 *
 * So the law has two halves and this file pins both:
 *
 * 1. **A header never draws a rule under itself** — in the CHROME lane (shell, controls, dashboard,
 *    data, widget-header, theme). The reader already has the heading's type scale, its weight and
 *    the space below it; a line adds a fourth channel saying the same thing and costs a band.
 * 2. **A between-rows family always drops its LAST rule** — the line after the final row is an
 *    outer border pretending to be a separator, and it is the line that lands on top of whatever
 *    frame the container already has.
 *
 * One deliberate exception to law 1: `PageAside`'s shell-form header (docs/DESIGN-SPEC.md §5, §8
 * inversion #12). It is not the forbidden echo of the heading's own type scale — it closes the top
 * belt's seam across the panel so the boundary doesn't dead-end at the aside column, the same
 * `--vx-divider` line the header|main AppShell seam draws one column over. It is ledgered below as
 * `region-boundary`, not `between-rows`.
 *
 * The guard is an INVENTORY, not a pattern match: every horizontal hairline in every CSS module has
 * to be listed below with a `kind` and a reason, so a seventh one added next month fails here and
 * gets classified rather than shipping unexamined. That is the same idiom `theme/border-coverage.test.ts`
 * uses for Mantine's stock borders, applied to the ones basalt writes itself.
 *
 * Not in scope, deliberately: the `border` SHORTHAND (a box around a control or a card — that is an
 * edge, not a rule, and `border-coverage.test.ts` owns it), vertical hairlines (a column rule
 * divides two regions by construction), Mantine's own `inset 0 -1px 0` redraw of a STICKY table
 * head's `border-bottom`, which is a row line drawn as a shadow because `border-collapse: collapse`
 * drops borders on sticky cells — it appears and disappears with `withRowBorders`, so it is the same
 * line every other row gets and not a header rule — and the four `AppShell` region seams
 * (docs/DESIGN-SPEC.md §5): they live in Mantine's own CSS, painted through `[data-with-border]` and
 * the theme's `AppShell.extend({ vars })`, never in a `shell/*.module.css` module this file scans.
 */
import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dir, '..')

type Hairline = { readonly file: string; readonly selector: string; readonly decl: string }

/**
 * Every `border-{top,bottom,block-start,block-end}` and every 1px inset `box-shadow` in a CSS
 * module, with the selector it sits under. A hand-rolled scanner rather than a regex per file: the
 * SELECTOR is half the classification (`.header` vs `.rows > *:not(:last-child)` are the two
 * opposite verdicts), and a regex over declarations alone cannot see it.
 */
function scanHairlines(): { rules: Hairline[]; drops: Hairline[] } {
  const rules: Hairline[] = []
  const drops: Hairline[] = []
  const files = [...new Glob('**/*.module.css').scanSync({ cwd: SRC })].sort()
  for (const file of files) {
    const css = readFileSync(join(SRC, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const stack: string[] = []
    let buf = ''
    for (const ch of css) {
      if (ch === '{') {
        stack.push(buf.trim().replace(/\s+/g, ' '))
        buf = ''
        continue
      }
      if (ch === '}') {
        stack.pop()
        buf = ''
        continue
      }
      if (ch !== ';') {
        buf += ch
        continue
      }
      const decl = buf.trim().replace(/\s+/g, ' ')
      buf = ''
      const border = /^border-(?:top|bottom|block-start|block-end):\s*(.+)$/.exec(decl)
      const selector = stack.join(' >> ')
      if (border !== null) {
        ;(border[1] === 'none' ? drops : rules).push({ file, selector, decl })
        continue
      }
      if (decl.startsWith('box-shadow:') && decl.includes('inset') && /\b-?1px\b/.test(decl)) {
        rules.push({ file, selector, decl })
      }
    }
  }
  return { rules, drops }
}

/**
 * `between-rows` — the line sits BETWEEN two members of a list and the family drops its last one.
 * `region-boundary` — it separates two layout regions that are not a header and its content (the
 *   mobile bar and the page it floats over, an article's body and its footer).
 * `prose-typography` — an AUTHORED document, not app chrome: an `<hr>` the author wrote, the rule
 *   under an article's `h2`, a code block's filename bar. A document's conventions are the reader's
 *   expectations there (`docs/CONTENT-SPEC.md`), and `content/**` is out of the chrome lane for
 *   exactly that reason. Nothing in this kind may appear outside `content/`.
 */
type Kind = 'between-rows' | 'region-boundary' | 'prose-typography'

const LEDGER: readonly { file: string; selector: string; kind: Kind; why: string }[] = [
  {
    file: 'controls/controls.module.css',
    selector:
      '.sheetOption + .sheetOption, .sheetDisclosureBody + .sheetOption, .sheetOption + .sheetDisclosureBody',
    kind: 'between-rows',
    why: "The filter sheet's option rows. Written as an adjacent-sibling rule so the FIRST row has no top line — the group label above it is a header and gets no rule (C15).",
  },
  {
    file: 'controls/controls.module.css',
    selector: '.sheetRow',
    kind: 'between-rows',
    why: 'A 44px sheet row. Paired with `.sheetRow:last-child { border-bottom: none }` below, which the last-rule assertion checks.',
  },
  {
    file: 'controls/panel-row.module.css',
    selector: '.row + .row',
    kind: 'between-rows',
    why: "An aside's inspector rows (`docs/ASIDE-SPEC.md` §3). Adjacent-sibling, so the FIRST row draws no top line — the group's own header already bounds it — and the family has no trailing rule by construction.",
  },
  {
    file: 'shell/page-aside.module.css',
    selector: '.body > * + *',
    kind: 'between-rows',
    why: "The aside body's GROUPS — flush chrome, hairline-separated, rather than a stack of cards (Lightroom, not a dashboard). Same adjacent-sibling shape as the rows inside them, so the first group draws nothing under the panel header above it.",
  },
  {
    file: 'shell/page-aside.module.css',
    selector: ".panel[data-basalt-page-aside='shell'] .header",
    kind: 'region-boundary',
    why: "The shell-form aside header's bottom rule closes the top belt's seam across the panel (docs/DESIGN-SPEC.md §5, §8 #12) instead of dead-ending at the aside column — a continuation of the header|main AppShell seam, not a heading echoing its own type scale.",
  },
  {
    file: 'dashboard/settings-section.module.css',
    selector: '.rows > *:not(:last-child)',
    kind: 'between-rows',
    why: 'A settings list. The `:not(:last-child)` IS the last-rule drop, written into the selector rather than as a second rule.',
  },
  {
    file: 'content/article-layout.module.css',
    selector: '.header',
    kind: 'prose-typography',
    why: "An article's masthead rule — the title-block convention of a printed document, and the one place a reader expects a line under a heading.",
  },
  {
    file: 'content/article-layout.module.css',
    selector: '.footer',
    kind: 'region-boundary',
    why: 'Prev/next navigation below the article body — two regions, and the rule is above the footer rather than under a heading.',
  },
  {
    file: 'content/guide.module.css',
    selector: '.footer',
    kind: 'region-boundary',
    why: 'Same shape as the article footer: the boundary between a document and the navigation after it.',
  },
  {
    file: 'content/prose.module.css',
    selector: '.root hr',
    kind: 'prose-typography',
    why: 'An `<hr>` the AUTHOR wrote in their markdown. basalt does not get to drop a divider the document asked for.',
  },
  {
    file: 'content/prose.module.css',
    selector: '.root.article h2',
    kind: 'prose-typography',
    why: "The `article` prose variant's section rule — a long-form document convention, scoped to that variant and never applied to app chrome.",
  },
  {
    file: 'content/code-block.module.css',
    selector: '.header',
    kind: 'prose-typography',
    why: "A code block's filename/language bar. The block is a quoted artifact inside a document, and the bar is its frame's top row rather than a section heading.",
  },
]

const CHROME_LANES = ['shell/', 'controls/', 'dashboard/', 'data/', 'widget-header/', 'theme/']

function isChrome(file: string): boolean {
  return CHROME_LANES.some((lane) => file.startsWith(lane))
}

const { rules, drops } = scanHairlines()

describe('every horizontal hairline is inventoried and classified', () => {
  test('no hairline exists that the ledger does not name', () => {
    const listed = new Set(LEDGER.map((e) => `${e.file}|${e.selector}`))
    const unlisted = rules
      .filter((r) => !listed.has(`${r.file}|${r.selector}`))
      .map((r) => `${r.file} → ${r.selector} { ${r.decl} }`)
    // Do NOT silence this by adding an entry with a hand-wave. Decide which `kind` the line is: a
    // `between-rows` family (then add the last-rule drop too), a `region-boundary`, or — only inside
    // `content/**` — `prose-typography`. A rule under a heading in the chrome lane is none of the
    // three, and the fix is to delete it and let the type scale and the space do the work.
    expect(unlisted).toEqual([])
  })

  test('the ledger names nothing that no longer exists', () => {
    const found = new Set(rules.map((r) => `${r.file}|${r.selector}`))
    expect(LEDGER.filter((e) => !found.has(`${e.file}|${e.selector}`)).map((e) => e.file)).toEqual(
      [],
    )
  })

  test('`prose-typography` is confined to content/ — app chrome has no authored-document lane', () => {
    expect(
      LEDGER.filter((e) => e.kind === 'prose-typography' && !e.file.startsWith('content/')).map(
        (e) => `${e.file} → ${e.selector}`,
      ),
    ).toEqual([])
  })

  test('every ledger entry carries a real reason', () => {
    expect(LEDGER.filter((e) => e.why.length < 40).map((e) => e.selector)).toEqual([])
  })
})

describe('a header never draws a rule under itself in the chrome lane', () => {
  // The five class names the chrome lane uses for "the heading row of a thing" — `WidgetHeader`'s
  // root/titleRow/subtitle, `Section`'s, the filter sheet's, the table toolbar's. A `border-bottom`
  // on any of them is the exact regression this describe block exists for.
  const HEADER_SELECTOR =
    /^\.(?:root|header|titleRow|title|subtitle|sheetHeader|sheetTitle|toolbar|thead|head)\b/

  test('no chrome-lane hairline sits under a header-shaped selector', () => {
    const offenders = rules
      .filter((r) => isChrome(r.file) && HEADER_SELECTOR.test(r.selector))
      .map((r) => `${r.file} → ${r.selector} { ${r.decl} }`)
    expect(offenders).toEqual([])
  })

  test('the chrome lane holds between-rows lines and the one aside-header region boundary', () => {
    // The mobile bar's old `region-boundary` top rule is gone — that seam is now Mantine's own
    // `AppShell.Footer` edge (docs/DESIGN-SPEC.md §5), outside this scan. The one that replaced it
    // is the shell-form aside header's bottom rule: it closes the top belt's seam across the panel
    // (§8 #12) rather than a heading drawing a line under itself, so it is ledgered
    // `region-boundary`, not `between-rows`. The other `region-boundary` entries live in
    // `content/**`, outside CHROME_LANES.
    const kinds = LEDGER.filter((e) => isChrome(e.file)).map((e) => e.kind)
    expect([...new Set(kinds)].sort()).toEqual(['between-rows', 'region-boundary'])
  })
})

describe('a between-rows family drops its last rule', () => {
  for (const entry of LEDGER.filter((e) => e.kind === 'between-rows')) {
    test(`${entry.file} → ${entry.selector}`, () => {
      // Either the selector itself excludes the last member (`:not(:last-child)`, or an
      // adjacent-sibling combinator, which draws the line as the SECOND row's top edge and so has no
      // trailing rule by construction), or the module carries an explicit `border: none` drop.
      const selfLimiting = /:not\(:last-child\)|\+/.test(entry.selector)
      const dropped = drops.some(
        (d) => d.file === entry.file && d.selector.startsWith(`${entry.selector}:last`),
      )
      expect(selfLimiting || dropped).toBe(true)
    })
  }

  test('the themed Table drops its last body row — the rule that used to land on the outer box', () => {
    // `BasaltDataTable`'s `withTableBorder` went to `false` by default in the same minor (see
    // `data/data-table.test.tsx`); while both shipped, the two lines sat on top of each other and the
    // doubling hid which of them was drawing it. `tbody` scoped so a `tfoot` totals row keeps the
    // BETWEEN rule above it.
    const css = readFileSync(join(SRC, 'theme/controls.module.css'), 'utf8')
    expect(css).toContain('html .tableRoot tbody tr:last-of-type')
    expect(drops).toContainEqual({
      file: 'theme/controls.module.css',
      selector: 'html .tableRoot tbody tr:last-of-type',
      decl: 'border-bottom: none',
    })
  })

  test('the themed Accordion drops its last item — the same law, already shipped', () => {
    expect(drops).toContainEqual({
      file: 'theme/controls.module.css',
      selector: '.accordionItem:last-of-type',
      decl: 'border-bottom: none',
    })
  })
})
