/**
 * `primitive-bypass` (guardrails section 4, row 9): hand-rolled markup where a primitive exists.
 * Six of ten repos hand-roll tables, the console ships 10 raw controls and 20 headings, and five
 * of seven apps pin a locale. Twelve forms, all on; `figure-readout` keeps a card's headline the
 * answer while a hover moves (owner review 2). The `Intl` form points at `useFormat`, which
 * now carries `time` and an options bag. A mark drawn through the geometry seam (`useChartFocus`)
 * is legal in both the SVG and the HTML data-mark form.
 *
 * Ejected and seed files define the primitives, so the preset switches the rule off there. A
 * directory the consumer names in `manifest.bespoke` (zone B: a game table, a seating plan) draws
 * its own surface, so the two forms that deny positioned geometry and hand-drawn marks
 * (`svg-data-marks`, `html-data-marks`) are off there and every other form still runs.
 *
 * Known limits (syntactic rule, no type information, no cross-file reads):
 * - `table-rows`: rows built by a helper or a hook (`rowsOf(data).map(...)`) read as data too; a
 *   fixed table is an UPPER_CASE constant or an array literal. A `.map` nested in a row is the
 *   row's cells, never a second report.
 * - `svg-data-marks`: a `<path d>` from a d3-shape generator (`line()(data)`) or a helper that
 *   returns the string is not read; only a `d` or `points` built in the file with `.map`, `.flatMap` or
 *   `.reduce` is, inline or through a const (`const points = rows.map(…)`, then
 *   `points={points.join(' ')}`).
 * - `html-data-marks`: a custom-property mark is read only when the class names the property in a
 *   geometry or flex utility (`w-(--w)`, `h-[var(--h)]`, `grow-(--g)`, `basis-(--b)`, `scale-x-(--s)`,
 *   `translate-y-(--t)`, `[width:var(--w)]`); a property read by a stylesheet is out of reach. A `transform` reads
 *   only as `scale`, `scaleX` or `scaleY` of a datum; a `translate` transform is not.
 *   A custom property set on the element's JSX parent is read as one set on the element itself (the
 *   child's class sizes by it); one set on a grandparent or higher is not.
 * - `intl-format`: `toFixed` is read where it renders (a JSX child expression, directly or through
 *   a template literal, `+` or a ternary). One returned from a helper, a key or a CSS value is not
 *   display text by syntax and passes. A date-fns formatter is read through a named import from
 *   `date-fns` or `date-fns/format`; a namespace import is out of reach. Test files
 *   (`*.test.*`, `*.spec.*`) are skipped: they compute expected text.
 * - `list-rows`: a row element reads when a data `.map` returns it directly (an arrow body or a
 *   `return`) and it is a lowercase `div`, `li`, `a`, `button`, `article` or `section` with a
 *   `border-t|b|y` utility, or when a `divide-y` element has the `.map` as a direct child; a row
 *   inside a component the map calls, a class built in a variable and a fixed list (an array
 *   literal or an UPPER_CASE constant) are not read. A `ul` or `ol` reads only as the `divide-y` parent. A full `border` (a tile) passes.
 * - `chart-body-root`: a wrapper that is a component (`<Stack>`) passes; only a lowercase element
 *   or a fragment is looked through.
 * - `raw-heading`: a tag held in a variable is read where the variable is declared in the file
 *   (`'h2'`, a ternary of heading strings, `` `h${level}` ``); a tag passed in as a prop or built by
 *   a helper is not.
 * - `raw-control`: a `div` or `span` with `role="button"` and `onClick` reads, and so does an `<a>`
 *   with `onClick` and no `href`; one that only forwards a handler through a spread does not, and
 *   an `<a>` with a spread may carry its `href` there, so it passes.
 * - `raw-heading`: an intrinsic element with a literal `role="heading"` reads (`<div role="heading"
 *   aria-level={2}>`); a role held in a variable or a spread is not read, and a component
 *   (`<Box role="heading">`) is left to its own definition.
 * - `raw-control`: a `div`, `span`, `li`, `tr`, `td`, `th` or `img` with an explicit `onClick` and no
 *   role reads; one with a role or a spread (which may carry the role) passes, and so does a
 *   handler whose only statement is a `stopPropagation()` call (an arrow or a function body); a
 *   handler held in a variable that stops propagation reads, as the body is not visible.
 * - `chart-body-root`: a chart kind reads outside a card only with a `section`, `main`, `article`
 *   or `aside` above it in the same JSX tree, or a `Section` or `Page` imported from
 *   `basalt-ui/page`; one under a `div` or that is the whole return of a
 *   component (a `ChartCard` may wrap it in another file) is a cross-file fact and passes. A `Card`, `ChartCard`, `DataPanel` or any
 *   `*Card`/`*Panel` ancestor passes, and so does a `StatCell` (its `chart` slot is a kit frame).
 * - `intl-format`: a dayjs or moment formatter is read by the callee name (`dayjs(...)`,
 *   `moment(...)`, `.utc()` chains); a value held in a variable first (`const d = dayjs(at)`) is not.
 *   luxon's `toFormat`, `toRelative` and `toRelativeCalendar` read on a `DateTime.*(...)` chain
 *   rendered as JSX text (its
 *   `toLocaleString` reads anywhere, as every `toLocale*String` does); one held in a variable or
 *   returned from a helper is not. `toDateString`, `toTimeString` and `toUTCString` (English-only
 *   date text) read rendered as JSX text, as `toFixed` does; one in a prop, an object value or a
 *   template literal is not read, since `toUTCString` is also the HTTP date a header or a cookie
 *   takes.
 * - `raw-heading`: `createElement('h2', ...)`, `createElement(`h${level}`, ...)` and
 *   `React.createElement` read; a tag from a variable or a spread of arguments does not.
 * - `role-table`: a `row`, `gridcell`, `cell`, `columnheader`, `rowheader` or `rowgroup` role reads
 *   on an intrinsic element (a component owns its markup) unless an ancestor in the file carries a `table`, `grid` or `treegrid` role (which reads on
 *   its own); a role held in a variable or set by a component's own markup is not read.
 * - `table-rows`: `Array.from(rows, (r) => <TableRow />)` reads as `.map` does; `Array.from`
 *   with no mapper does not.
 * - `chart-body-root`: `Section` and `Page` read through a namespace import
 *   (`import * as P from 'basalt-ui/page'`, `<P.Section>`) as through a named one.
 * - `svg-data-marks`: a mark is `aria-hidden` by its own attribute or an ancestor's, read in the
 *   same file only; the seam spread may sit in another file's component and then it still reports.
 * - `checkable-input`: basalt's `Input` reads when it is imported from `basalt-ui/ui/input` in the
 *   file (renamed or not) with a literal `type="checkbox"` or `"radio"`; a `type` held in a
 *   variable or a spread, and an `Input` from another path, are not read.
 * - `figure-readout`: a `figure` attribute's `value` or `delta` that calls `.readout(` reads, in an
 *   object written in the attribute (through a ternary or a logical operand); a figure built in a
 *   variable or a helper, and a value derived from `focus.datum` by hand, are not read.
 * - `svg-data-marks`: a `<g>` that is not inside an `<svg>` in the file is a marks root too (a
 *   marks component split into its own file); a `.map` of marks under a root a helper component
 *   renders (`<Dots />` returning bare `<circle>`s with no `<g>`) is not read.
 */
import type { Node, Visitor } from '../../factory'
import { isTestFile, mergeVisitors } from '../../factory'
import type { AstForm, RuleEntry } from '../../rule-table'
import { defineRules } from '../../rule-table'

/** Chart kinds that are a chart as a whole: never the root of a `DataPanel` body. */
export const CHART_KINDS: ReadonlySet<string> = new Set([
  'CartesianChart',
  'Lines',
  'Bars',
  'StackedArea',
  'Sparkline',
  'BandStrip',
  'Donut',
  'Heatmap',
  'IntervalTrack',
  'Waterfall',
  'RangeNavigator',
  'DualPanel',
  'MirroredBars',
])

const RAW_CONTROLS: ReadonlySet<string> = new Set([
  'button',
  'input',
  'select',
  'textarea',
  'dialog',
  'details',
  'progress',
  'meter',
])
/** Elements that are not interactive by nature: an `onClick` with no role makes a button of them. */
const CLICKABLE_NON_CONTROLS: ReadonlySet<string> = new Set([
  'div',
  'span',
  'li',
  'tr',
  'td',
  'th',
  'img',
])
const HEADINGS: ReadonlySet<string> = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const SVG_MARKS: ReadonlySet<string> = new Set([
  'rect',
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'polyline',
  'text',
])
const ROW_CHAIN: ReadonlySet<string> = new Set(['sort', 'toSorted', 'slice'])
const LOCALE_METHODS: ReadonlySet<string> = new Set([
  'toLocaleString',
  'toLocaleDateString',
  'toLocaleTimeString',
])
/** English-only date text, read where it renders as JSX text: `toUTCString` is also the HTTP date a header or cookie takes. */
const ENGLISH_DATE_METHODS: ReadonlySet<string> = new Set([
  'toDateString',
  'toTimeString',
  'toUTCString',
])

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'

const child = (node: Node, key: string): Node | undefined => {
  const value = node[key]
  return isNode(value) ? value : undefined
}

const children = (node: Node, key: string): Node[] => {
  const value = node[key]
  return Array.isArray(value) ? value.filter(isNode) : []
}

const stringValue = (node: Node | undefined): string | undefined =>
  node?.type === 'Literal' && typeof node['value'] === 'string' ? node['value'] : undefined

const nameOf = (node: Node | undefined): string | undefined =>
  node?.type === 'Identifier' || node?.type === 'JSXIdentifier'
    ? (node['name'] as string)
    : undefined

/** The tag of an intrinsic or component element: `button`, `DataPanel`; `a.b` has none. */
const tagOf = (opening: Node): string | undefined => nameOf(child(opening, 'name'))

const attribute = (opening: Node, name: string): Node | undefined =>
  children(opening, 'attributes').find(
    (attr) => attr.type === 'JSXAttribute' && nameOf(child(attr, 'name')) === name,
  )

/** The string an attribute is statically set to: `type="radio"` and `type={'radio'}`. */
const attributeText = (opening: Node, name: string): string | undefined => {
  const value = child(attribute(opening, name) ?? { type: '' }, 'value')
  if (value?.type === 'JSXExpressionContainer') return stringValue(child(value, 'expression'))
  return stringValue(value)
}

const parentOf = (node: Node): Node | undefined => node['parent'] as Node | undefined

/** Every string a subtree writes: literals and template text. */
function stringsIn(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const entry of node) stringsIn(entry, found)
  } else if (isNode(node)) {
    if (node.type === 'Literal' && typeof node['value'] === 'string') found.push(node['value'])
    if (node.type === 'TemplateElement') {
      const value = node['value'] as { cooked?: string | null; raw: string }
      found.push(value.cooked ?? value.raw)
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'parent' && typeof value === 'object') stringsIn(value, found)
    }
  }
  return found
}

/** True when some node under `root` (itself included) passes `test`. */
function someNode(root: Node | undefined, test: (node: Node) => boolean): boolean {
  if (!root) return false
  if (test(root)) return true
  for (const [key, value] of Object.entries(root)) {
    if (key === 'parent' || typeof value !== 'object' || value === null) continue
    const nodes = Array.isArray(value) ? value : [value]
    if (nodes.some((entry) => isNode(entry) && someNode(entry, test))) return true
  }
  return false
}

const classTokens = (opening: Node): string[] =>
  stringsIn(attribute(opening, 'className')).flatMap((text) => text.split(/\s+/))

const form = (id: string, fix: string, next: string, detect: AstForm['detect']): AstForm => ({
  id,
  detect,
  fix,
  next,
  fixture: `import-bypass/${id}.tsx`,
})

/** A form that is off in a `manifest.bespoke` directory (zone B), where the rest of the rule runs. */
const bespokeOff = (f: AstForm): AstForm => ({ ...f, zonesOff: ['bespoke'] })

/** A visitor over the opening tag of every JSX element. */
const opening = (onOpening: (node: Node) => void): Visitor => ({ JSXOpeningElement: onOpening })

const isCheckable = (node: Node): boolean => {
  const type = attributeText(node, 'type')
  return type === 'checkbox' || type === 'radio'
}

/** `<input type="file">` the page hides (`hidden`, `sr-only`, `hidden`): the label is the control. */
const isHiddenFileInput = (node: Node): boolean =>
  attributeText(node, 'type') === 'file' &&
  (attribute(node, 'hidden') !== undefined ||
    classTokens(node).some((token) => token === 'sr-only' || token === 'hidden'))

/** A `div` or `span` that is a button by role and click handler: `<div role="button" onClick>`. */
const isFakeButton = (node: Node): boolean => {
  const tag = tagOf(node)
  if (tag !== 'div' && tag !== 'span') return false
  const role = attributeText(node, 'role')
  return role?.split(/\s+/).includes('button') === true && attribute(node, 'onClick') !== undefined
}

/** An `<a onClick>` with no `href` and no spread (which may carry one): a button spelled as a link. */
const isAnchorButton = (node: Node): boolean =>
  tagOf(node) === 'a' &&
  attribute(node, 'onClick') !== undefined &&
  attribute(node, 'href') === undefined &&
  !children(node, 'attributes').some((attr) => attr.type === 'JSXSpreadAttribute')

/** `e.stopPropagation()`, as an expression or as the only statement of a block. */
const isStopPropagationCall = (node: Node | undefined): boolean => {
  const call = node?.type === 'ExpressionStatement' ? child(node, 'expression') : node
  if (call?.type !== 'CallExpression') return false
  const callee = child(call, 'callee')
  return (
    callee?.type === 'MemberExpression' &&
    callee['computed'] !== true &&
    nameOf(child(callee, 'property')) === 'stopPropagation'
  )
}

/** An `onClick` that only stops the event: a wrapper that keeps a click from reaching its parent. */
const onlyStopsPropagation = (node: Node): boolean => {
  const value = child(attribute(node, 'onClick') ?? { type: '' }, 'value')
  const handler = value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : undefined
  if (handler?.type !== 'ArrowFunctionExpression' && handler?.type !== 'FunctionExpression') {
    return false
  }
  const body = child(handler, 'body')
  if (body?.type !== 'BlockStatement') return isStopPropagationCall(body)
  const statements = children(body, 'body')
  return statements.length === 1 && isStopPropagationCall(statements[0])
}

/**
 * A `div`, `span`, `li`, `tr`, `td`, `th` or `img` with `onClick` and no `role` (and no spread,
 * which may carry one): a clickable element that is a button with no semantics and, mostly, no
 * keyboard route. A handler that only calls `stopPropagation` is a wrapper, not a control.
 */
const isClickableRow = (node: Node): boolean =>
  CLICKABLE_NON_CONTROLS.has(tagOf(node) ?? '') &&
  attribute(node, 'onClick') !== undefined &&
  attribute(node, 'role') === undefined &&
  !children(node, 'attributes').some((attr) => attr.type === 'JSXSpreadAttribute') &&
  !onlyStopsPropagation(node)

/**
 * Raw `button`, `input`, `select`, `textarea`, the native `dialog`, `details`, `progress` and
 * `meter`, a `div` or `span` that is a button by `role="button"` and `onClick`, an `<a onClick>`
 * with no `href`, and a `div`, `span`, `li`, `tr`, `td`, `th` or `img` with `onClick` and no `role`
 * (unless the handler only calls `stopPropagation`). A
 * `type="file"` input that is visually hidden (a `hidden` attribute, or a `sr-only` or `hidden`
 * class) passes: it sits behind a label, and no
 * primitive wraps a file input. A visible file input still reports.
 */
const rawControl = form(
  'raw-control',
  'Use ui/button, ui/input, ui/select, ui/textarea, ui/dialog, ui/progress or ui/meter; a details disclosure is ui/collapsible or ui/accordion; a clickable row is a link or a button inside the row',
  'Eject the primitive to change its structure',
  ({ report }) =>
    opening((node) => {
      const tag = tagOf(node)
      if (isFakeButton(node)) return report(node, `<${tag} role="button">`)
      if (isAnchorButton(node)) return report(node, '<a onClick> without href')
      if (isClickableRow(node)) return report(node, `<${tag} onClick> without a role`)
      if (tag === undefined || !RAW_CONTROLS.has(tag)) return
      if (tag === 'input' && (isCheckable(node) || isHiddenFileInput(node))) return
      report(node, `<${tag}>`)
    }),
)

/** The module whose `Input` is the basalt primitive. */
const INPUT_PRIMITIVE_SOURCE = 'basalt-ui/ui/input'

const checkableInput = form(
  'checkable-input',
  'Use ui/checkbox, ui/switch or ui/radio-group',
  'Bind a boolean field with FormField',
  ({ report }) => {
    const primitives = new Set<string>()
    return mergeVisitors([
      {
        ImportDeclaration(node) {
          if (stringValue(child(node, 'source')) !== INPUT_PRIMITIVE_SOURCE) return
          for (const spec of children(node, 'specifiers')) {
            if (spec.type !== 'ImportSpecifier') continue
            const imported = child(spec, 'imported')
            if ((nameOf(imported) ?? stringValue(imported)) !== 'Input') continue
            const local = nameOf(child(spec, 'local'))
            if (local !== undefined) primitives.add(local)
          }
        },
      },
      opening((node) => {
        const tag = tagOf(node)
        if (tag === undefined || !isCheckable(node)) return
        if (tag === 'input' || primitives.has(tag)) {
          report(node, `${tag}[type="${attributeText(node, 'type')}"]`)
        }
      }),
    ])
  },
)

const GROUP_ELEMENTS: ReadonlySet<string> = new Set(['section', 'li'])

/** The element a node of an element sits in, through containers and fragments. */
const enclosingElement = (element: Node): Node | undefined => {
  for (let at = parentOf(element); at; at = parentOf(at)) if (at.type === 'JSXElement') return at
  return undefined
}

/** The `.map` call whose callback returns `element`: an arrow body or a `return`. */
function mapReturning(element: Node): Node | undefined {
  let at: Node = element
  let up = parentOf(at)
  while (up?.type === 'ParenthesizedExpression') {
    at = up
    up = parentOf(at)
  }
  let fn: Node | undefined
  if (up?.type === 'ReturnStatement') {
    const block = parentOf(up)
    fn = block?.type === 'BlockStatement' ? parentOf(block) : undefined
  } else if (up?.type === 'ArrowFunctionExpression' && up['body'] === at) {
    fn = up
  }
  return fn !== undefined && isMapCallback(fn) ? parentOf(fn) : undefined
}

/** True when `element` is what a `.map` callback returns: an arrow body or a `return`. */
const returnedFromMap = (element: Node): boolean => mapReturning(element) !== undefined

function isMapCallback(fn: Node): boolean {
  if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') return false
  const call = parentOf(fn)
  return call?.type === 'CallExpression' && isMapCall(call) && children(call, 'arguments')[0] === fn
}

/**
 * A raw heading reports, with one allowance: a heading whose nearest enclosing element is a
 * lowercase `section` or `li` that a `.map` callback returns titles one repeated group (a board
 * column), and no frame owns that title. An `<h1>` in a page body or an `<h3>` in a card still
 * reports.
 */
const rawHeading = form(
  'raw-heading',
  'Name the area with Section or PageBar; text-display is the title style',
  'A heading inside prose is Prose',
  ({ report }) => {
    const headingTags = new Set<string>()
    return {
      VariableDeclarator(node) {
        const name = nameOf(child(node, 'id'))
        if (name !== undefined && isHeadingTag(child(node, 'init'))) headingTags.add(name)
      },
      JSXOpeningElement: rawHeadingOpening(report, headingTags),
      CallExpression(node) {
        if (calleeName(node) !== 'createElement') return
        const first = children(node, 'arguments')[0]
        if (!isHeadingTag(first)) return
        report(node, `createElement(${stringValue(unwrapped(first)) ?? 'a heading tag'})`)
      },
    }
  },
)

/**
 * A heading tag chosen in a variable: `'h2'`, `cond ? 'h2' : 'h3'`, or `` `h${level}` ``, also
 * under `as const` or `satisfies`.
 */
function isHeadingTag(written: Node | undefined): boolean {
  const init = unwrapped(written)
  if (!init) return false
  if (init.type === 'ConditionalExpression') {
    return isHeadingTag(child(init, 'consequent')) || isHeadingTag(child(init, 'alternate'))
  }
  if (init.type === 'TemplateLiteral') {
    const [first] = children(init, 'quasis')
    const text = (first?.['value'] as { cooked?: string | null; raw: string } | undefined)?.cooked
    return text === 'h' && children(init, 'expressions').length === 1
  }
  const text = stringValue(init)
  return text !== undefined && HEADINGS.has(text)
}

function rawHeadingOpening(
  report: Parameters<AstForm['detect']>[0]['report'],
  headingTags: ReadonlySet<string>,
): (node: Node) => void {
  return (node) => {
    const tag = tagOf(node)
    if (tag !== undefined && headingTags.has(tag)) return report(node, `<${tag}> a heading tag`)
    if (tag !== undefined && /^[a-z]/.test(tag) && attributeText(node, 'role') === 'heading') {
      return report(node, `<${tag} role="heading">`)
    }
    if (tag === undefined || !HEADINGS.has(tag)) return
    const group = enclosingElement(parentOf(node) as Node)
    const groupTag = group ? tagOf(child(group, 'openingElement') as Node) : undefined
    if (group && groupTag !== undefined && GROUP_ELEMENTS.has(groupTag) && returnedFromMap(group)) {
      return
    }
    report(node, `<${tag}>`)
  }
}

/** Tailwind's whole-table display utility, and the parts that sit in one. */
const DISPLAY_TABLE = /^(?:[\w-]+:)*(?:inline-)?table$/
const DISPLAY_TABLE_PART = /^(?:[\w-]+:)*table-(?:row|cell|row-group|header-group|footer-group)$/

/** True when an ancestor element of `node` carries the whole-table display class. */
const insideDisplayTable = (node: Node): boolean => {
  for (let at = enclosingElement(parentOf(node) as Node); at; at = enclosingElement(at)) {
    const open = child(at, 'openingElement')
    if (open && classTokens(open).some((token) => DISPLAY_TABLE.test(token))) return true
  }
  return false
}

/**
 * A `<table>`, a `<dl>` (key-value rows: Facts ships for them), and an intrinsic element laid out
 * as a table by Tailwind's display utilities (`table`, `inline-table`; a `table-row` or `table-cell` outside one,
 * so a table is one finding). `table-auto` and `table-fixed` set a layout, not a display, and pass.
 */
const rawTable = form(
  'raw-table',
  'Use ui/table for a static table, DataTable for data and Facts from basalt-ui/page for key-value rows',
  'Eject ui/table to change its structure',
  ({ report }) =>
    opening((node) => {
      const tag = tagOf(node)
      if (tag === 'table') return report(node, '<table>')
      if (tag === 'dl') return report(node, '<dl>')
      if (tag === undefined || !/^[a-z]/.test(tag)) return
      const tokens = classTokens(node)
      if (tokens.some((token) => DISPLAY_TABLE.test(token))) {
        return report(node, `<${tag}> displayed as a table`)
      }
      const part = tokens.find((token) => DISPLAY_TABLE_PART.test(token))
      if (part !== undefined && !insideDisplayTable(node)) {
        report(node, `<${tag}> displayed as a ${part.replace(/^.*:/, '')}`)
      }
    }),
)

const isMapCall = (node: Node): boolean => {
  const callee = child(node, 'callee')
  if (callee?.type !== 'MemberExpression' || callee['computed'] === true) return false
  const method = nameOf(child(callee, 'property'))
  return method === 'map' || method === 'flatMap'
}

const SEAM_FIX =
  'a mark a page draws itself spreads focus.item(i) inside a focus.target container from useChartFocus, with chartLabels, both from basalt-ui/charts'

const identifiersIn = (node: unknown, found = new Set<string>()): Set<string> => {
  if (Array.isArray(node)) {
    for (const entry of node) identifiersIn(entry, found)
  } else if (isNode(node)) {
    if (node.type === 'Identifier') found.add(node['name'] as string)
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'parent' && typeof value === 'object') identifiersIn(value, found)
    }
  }
  return found
}

/** The names a binding pattern introduces: `d`, `{ share }`, `[a, b]`, `{ x: d }`, `d = 0`. */
function bindingNames(pattern: Node | undefined, names = new Set<string>()): Set<string> {
  if (!pattern) return names
  switch (pattern.type) {
    case 'Identifier':
      names.add(pattern['name'] as string)
      break
    case 'AssignmentPattern':
      bindingNames(child(pattern, 'left'), names)
      break
    case 'RestElement':
      bindingNames(child(pattern, 'argument'), names)
      break
    case 'ArrayPattern':
      for (const element of children(pattern, 'elements')) bindingNames(element, names)
      break
    case 'ObjectPattern':
      for (const prop of children(pattern, 'properties')) {
        bindingNames(prop.type === 'Property' ? child(prop, 'value') : prop, names)
      }
      break
  }
  return names
}

/** The datum a `.map` callback binds: its first parameter, never the index or the array. */
const datumNames = (fn: Node | undefined): Set<string> =>
  bindingNames(fn ? children(fn, 'params')[0] : undefined)

type MapScope = { node: Node; frames: number; params: Set<string> }
type JsxFrame = { targets: Set<string>; items: Set<string> }

/** `focus.target` or `focus.item(i)` as a spread: the handle's name and which half it is. */
const seamSpread = (attr: Node): { handle: string; half: 'target' | 'item' } | undefined => {
  if (attr.type !== 'JSXSpreadAttribute') return undefined
  const arg = child(attr, 'argument')
  const member = arg?.type === 'CallExpression' ? child(arg, 'callee') : arg
  if (member?.type !== 'MemberExpression' || member['computed'] === true) return undefined
  const handle = nameOf(child(member, 'object'))
  const prop = nameOf(child(member, 'property'))
  if (handle === undefined) return undefined
  if (arg?.type === 'MemberExpression' && prop === 'target') return { handle, half: 'target' }
  if (arg?.type === 'CallExpression' && prop === 'item') return { handle, half: 'item' }
  return undefined
}

/** A type annotation naming `ChartFocus<…>`: `focus: ChartFocus<Row>`. */
const namesChartFocus = (annotation: Node | undefined): boolean => {
  const type = annotation && child(annotation, 'typeAnnotation')
  return type?.type === 'TSTypeReference' && nameOf(child(type, 'typeName')) === 'ChartFocus'
}

/**
 * The names a component parameter binds that may hold a focus handle its caller made: a
 * parameter, or a destructured prop. An annotated one counts only when it names `ChartFocus`; a
 * props type declared elsewhere (`{ focus }: Props`) is taken on trust.
 */
function passedHandles(param: Node | undefined, names: Set<string>): void {
  const pattern = param?.type === 'AssignmentPattern' ? child(param, 'left') : param
  if (!pattern) return
  const annotation = child(pattern, 'typeAnnotation')
  if (pattern.type === 'Identifier') {
    if (annotation === undefined || namesChartFocus(annotation)) names.add(nameOf(pattern) ?? '')
    return
  }
  if (pattern.type !== 'ObjectPattern') return
  const literal = annotation && child(annotation, 'typeAnnotation')
  const members = literal?.type === 'TSTypeLiteral' ? children(literal, 'members') : undefined
  for (const prop of children(pattern, 'properties')) {
    if (prop.type !== 'Property') continue
    const key = nameOf(child(prop, 'key'))
    const typed = members?.find((m) => nameOf(child(m, 'key')) === key)
    if (members !== undefined && !namesChartFocus(typed && child(typed, 'typeAnnotation'))) continue
    for (const name of bindingNames(child(prop, 'value'))) names.add(name)
  }
}

/** The wrappers a component is declared through: `memo(function Rings(…))`, `forwardRef(…)`. */
const COMPONENT_WRAPPERS: ReadonlySet<string> = new Set(['memo', 'forwardRef'])

const calleeName = (call: Node): string | undefined => {
  const callee = child(call, 'callee')
  return callee?.type === 'MemberExpression' ? nameOf(child(callee, 'property')) : nameOf(callee)
}

/** A function that is a call's argument (a `.map` callback, an effect), and not a wrapped component. */
const isCallback = (fn: Node): boolean => {
  const parent = parentOf(fn)
  return (
    parent?.type === 'CallExpression' &&
    children(parent, 'arguments').includes(fn) &&
    !COMPONENT_WRAPPERS.has(calleeName(parent) ?? '')
  )
}

/**
 * What the data-mark forms share: the `.map` callbacks around a node, and whether a mark is drawn
 * through the geometry seam. Wired means the mark, or an element between it and its `.map`,
 * spreads `focus.item(i)`, where either `focus` is the result of `useChartFocus(...)` in this file
 * and an element around the `.map` spreads the same handle's `focus.target`, or `focus` reaches
 * this component as a parameter or prop: its caller made it and spreads `focus.target` on the
 * container that renders this component, so a seam split across two files needs no waiver.
 */
function dataMarkScope() {
  const handles = new Set<string>()
  const passed = new Set<string>()
  const component = (node: Node): void => {
    if (isCallback(node)) return
    for (const param of children(node, 'params')) passedHandles(param, passed)
  }
  const frames: JsxFrame[] = []
  const maps: MapScope[] = []
  const entered = new WeakSet<Node>()
  const visitor: Visitor = {
    FunctionDeclaration: component,
    FunctionExpression: component,
    ArrowFunctionExpression: component,
    VariableDeclarator(node) {
      const init = child(node, 'init')
      const id = child(node, 'id')
      if (init?.type !== 'CallExpression' || nameOf(child(init, 'callee')) !== 'useChartFocus')
        return
      const name = nameOf(id)
      if (name !== undefined) handles.add(name)
    },
    JSXElement(node) {
      const frame: JsxFrame = { targets: new Set(), items: new Set() }
      for (const attr of children(child(node, 'openingElement') ?? node, 'attributes')) {
        const spread = seamSpread(attr)
        if (spread) frame[spread.half === 'target' ? 'targets' : 'items'].add(spread.handle)
      }
      frames.push(frame)
    },
    'JSXElement:exit'() {
      frames.pop()
    },
    CallExpression(node) {
      if (!isMapCall(node)) return
      const callback = children(node, 'arguments')[0]
      maps.push({ node, frames: frames.length, params: datumNames(callback) })
      entered.add(node)
    },
    'CallExpression:exit'(node) {
      if (entered.has(node)) maps.pop()
    },
  }
  return {
    visitor,
    maps,
    /** True when the element on top of the stack is a seam-wired mark of its `.map`. */
    wired(map: MapScope): boolean {
      const marked = frames.slice(map.frames).flatMap((frame) => [...frame.items])
      return marked.some(
        (handle) =>
          (passed.has(handle) && !handles.has(handle)) ||
          (handles.has(handle) &&
            frames.slice(0, map.frames).some((frame) => frame.targets.has(handle))),
      )
    },
  }
}

const BUILD_METHODS: ReadonlySet<string> = new Set(['map', 'flatMap', 'reduce'])

/** A call that builds a value from a collection: `data.map(...)`, `.flatMap`, `.reduce`. */
const isBuildCall = (node: Node): boolean => {
  const callee = node.type === 'CallExpression' ? child(node, 'callee') : undefined
  return (
    callee?.type === 'MemberExpression' &&
    callee['computed'] !== true &&
    BUILD_METHODS.has(nameOf(child(callee, 'property')) ?? '')
  )
}

/** The name a method chain starts from: `points` of `points.join(' ')`, `d` of `d.trim()`; the node itself otherwise. */
const builtChainRoot = (node: Node): Node => {
  let at = node
  while (at.type === 'CallExpression') {
    const callee = child(at, 'callee')
    if (callee?.type !== 'MemberExpression') break
    const object = child(callee, 'object')
    if (!object) break
    at = object
  }
  return at
}

/** `aria-hidden`, `aria-hidden="true"` or `aria-hidden={true}`: not `"false"` or `{false}`. */
const isAriaHidden = (opening: Node): boolean => {
  const attr = attribute(opening, 'aria-hidden')
  if (!attr) return false
  const value = child(attr, 'value')
  if (!value) return true
  const inner = value.type === 'JSXExpressionContainer' ? child(value, 'expression') : value
  return inner?.type === 'Literal' && (inner['value'] === true || inner['value'] === 'true')
}

/** A mark that is `aria-hidden`, or sits under an `aria-hidden` element: decorative artwork. */
function isDecorative(mark: Node): boolean {
  if (isAriaHidden(mark)) return true
  for (let at = parentOf(parentOf(mark) as Node); at; at = parentOf(at)) {
    if (at.type !== 'JSXElement') continue
    const open = child(at, 'openingElement')
    if (open && isAriaHidden(open)) return true
  }
  return false
}

/**
 * A mark drawn per datum inside an `<svg>`: `data.map((d) => <rect … />)`. Static artwork (an icon,
 * a fixed grid) is not data-mapped and passes, and so does a mark drawn through the geometry seam.
 * One report per map call. A `<path d>` built from data (an inline `.map(...).join(' ')`, or a name
 * a declaration in the file binds to one) is a data mark too; a constant `d` is artwork. A `<g>`
 * outside any `<svg>` roots the same check: the marks component of a chart split into files. A
 * mapped mark that is `aria-hidden` (itself or under an `aria-hidden` element) passes in a file
 * where another mark spreads `focus.item(...)`: it is decoration beside seam marks (an edge between
 * nodes) and must not take a tab stop. With no seam spread in the file it still reports.
 */
const svgDataMarks = bespokeOff(
  form(
    'svg-data-marks',
    `Draw the chart with ChartCard and a kind from basalt-ui/charts, or ${SEAM_FIX}`,
    'CartesianChart marks for a mark the kinds lack',
    ({ report }) => {
      type SvgScope = { maps: MapScope[]; reported: Set<Node> }
      const scopes: SvgScope[] = []
      const entered = new WeakSet<Node>()
      const seam = dataMarkScope()
      const builtPaths = new Set<string>()
      const decorative = new Map<Node, { node: Node; message: string }>()
      let itemSpread = false
      const pathFromData = (opening: Node, name: string): boolean => {
        const value = child(attribute(opening, name) ?? { type: '' }, 'value')
        const expression =
          value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : undefined
        if (!expression) return false
        const bound = nameOf(builtChainRoot(expression))
        return (bound !== undefined && builtPaths.has(bound)) || someNode(expression, isBuildCall)
      }
      return mergeVisitors([
        seam.visitor,
        {
          VariableDeclarator(node) {
            const name = nameOf(child(node, 'id'))
            if (name !== undefined && someNode(child(node, 'init'), isBuildCall))
              builtPaths.add(name)
          },
          JSXElement(node) {
            const open = child(node, 'openingElement')
            const root = open && tagOf(open)
            if (root === 'svg' || (root === 'g' && scopes.length === 0)) {
              scopes.push({ maps: [], reported: new Set() })
              entered.add(node)
            }
          },
          'JSXElement:exit'(node) {
            if (entered.has(node)) scopes.pop()
          },
          CallExpression(node) {
            const scope = scopes.at(-1)
            if (scope && isMapCall(node)) {
              scope.maps.push(seam.maps.at(-1) as MapScope)
              entered.add(node)
            }
          },
          'CallExpression:exit'(node) {
            if (entered.has(node)) scopes.at(-1)?.maps.pop()
          },
          JSXOpeningElement(node) {
            const scope = scopes.at(-1)
            const map = scope?.maps.at(-1)
            const tag = tagOf(node)
            const built =
              tag === 'path' ? 'd' : tag === 'polyline' || tag === 'polygon' ? 'points' : ''
            if (built && !map && pathFromData(node, built)) {
              if (!children(node, 'attributes').some((attr) => seamSpread(attr))) {
                report(node, `<${tag}> ${built} built from data`)
              }
              return
            }
            if (!scope || !map || tag === undefined || !SVG_MARKS.has(tag)) return
            if (scope.reported.has(map.node) || seam.wired(map)) return
            if (isDecorative(node)) {
              if (!decorative.has(map.node)) {
                decorative.set(map.node, { node, message: `<${tag}> mapped over data` })
              }
              return
            }
            scope.reported.add(map.node)
            decorative.delete(map.node)
            report(node, `<${tag}> mapped over data`)
          },
          JSXSpreadAttribute(node) {
            if (seamSpread(node)?.half === 'item') itemSpread = true
          },
          'Program:exit'() {
            if (itemSpread) return
            for (const { node, message } of decorative.values()) report(node, message)
          },
        },
      ])
    },
  ),
)

const GEOMETRY_STYLE: ReadonlySet<string> = new Set([
  'width',
  'height',
  'left',
  'top',
  'right',
  'bottom',
  'flex',
  'flexGrow',
  'flexBasis',
  'inlineSize',
  'blockSize',
])

const unwrapped = (node: Node | undefined): Node | undefined => {
  let at = node
  while (
    at?.type === 'TSAsExpression' ||
    at?.type === 'TSSatisfiesExpression' ||
    at?.type === 'ParenthesizedExpression'
  ) {
    at = child(at, 'expression')
  }
  return at
}

/**
 * True when a class names the custom property in a geometry utility: `w-(--w)`, `h-[var(--h)]`,
 * the flex share of a bar, `grow-(--g)`, `basis-(--b)`, `flex-(--f)`, and the scale or offset of one,
 * `scale-x-(--s)`, `translate-y-(--t)`.
 */
const sizesFromProperty = (opening: Node, property: string): boolean => {
  const name = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const utility = new RegExp(
    `^(?:[\\w-]+:)*-?(?:(?:min|max)-)?(?:w|h|size|left|top|right|bottom|inset|basis|grow|flex-grow|flex|(?:scale|translate)(?:-[xy])?)-(?:\\(${name}\\)|\\[var\\(${name}\\)\\])$`,
  )
  return classTokens(opening).some((token) => utility.test(token) || sizes(name).test(token))
}

/**
 * A class that sizes the element (its width, height or flex share) from the custom property:
 * `w-(--w)`, `h-[var(--h)]`, `basis-(--b)`, or the arbitrary property `[width:var(--w)]`. Scale,
 * translate and offsets are left out: a flip or a nudge is no measure of a datum.
 */
const sizes = (name: string): RegExp =>
  new RegExp(
    `^(?:[\\w-]+:)*(?:(?:(?:min|max)-)?(?:w|h|size)|basis|grow|flex-grow|flex)-(?:\\(${name}\\)|\\[var\\(${name}\\)\\])$|^(?:[\\w-]+:)*\\[(?:(?:min-|max-)?(?:width|height|inline-size|block-size)|flex|flex-basis|flex-grow):var\\(${name}\\)\\]$`,
  )

const sizedByProperty = (opening: Node, property: string): boolean => {
  const name = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return classTokens(opening).some((token) => sizes(name).test(token))
}

/** A value computed at runtime: anything but a string or number literal or a template with no holes. */
const isComputed = (value: Node | undefined): boolean => {
  const at = unwrapped(value)
  if (at === undefined || at.type === 'Literal') return false
  return at.type !== 'TemplateLiteral' || children(at, 'expressions').length > 0
}

/**
 * Outside a map: a custom property set inline from a computed value that a class on the same
 * element sizes it by (`className="w-(--w)" style={{ '--w': `${share * 100}%` }}`), a bar sized
 * from data through the route `shadcn/no-inline-styles` names (lint-10.4). The `holder` is the
 * element that sets the property: the element itself, or its JSX parent (a property set on the
 * parent and read by the child's class). Returns the property.
 */
const computedSizeProperty = (opening: Node, holder: Node = opening): string | undefined => {
  const value = child(attribute(holder, 'style') ?? { type: '' }, 'value')
  const style = unwrapped(
    value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : undefined,
  )
  if (style?.type !== 'ObjectExpression') return undefined
  for (const prop of children(style, 'properties')) {
    if (prop.type !== 'Property' || prop['computed'] === true) continue
    const key = child(prop, 'key')
    const keyName = nameOf(key) ?? stringValue(key)
    if (keyName === undefined || !keyName.startsWith('--')) continue
    if (isComputed(child(prop, 'value')) && sizedByProperty(opening, keyName)) return keyName
  }
  return undefined
}

/**
 * The geometry keys of a `style={{ … }}` object whose value reads a name in `names`; a custom
 * property (`'--w'`) counts when a class sizes the element from it, which is the route
 * `shadcn/no-inline-styles` advises for a dynamic value.
 */
const datumGeometry = (opening: Node, names: ReadonlySet<string>): string | undefined => {
  const value = child(attribute(opening, 'style') ?? { type: '' }, 'value')
  const style = unwrapped(
    value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : undefined,
  )
  if (style?.type !== 'ObjectExpression') return undefined
  for (const prop of children(style, 'properties')) {
    if (prop.type !== 'Property' || prop['computed'] === true) continue
    const key = child(prop, 'key')
    const keyName = nameOf(key) ?? stringValue(key)
    if (keyName === undefined) continue
    const geometry =
      GEOMETRY_STYLE.has(keyName) ||
      (keyName === 'transform' &&
        stringsIn(child(prop, 'value')).some((t) => /scale[XY]?\(/.test(t)))
    if (!geometry && !(keyName.startsWith('--') && sizesFromProperty(opening, keyName))) continue
    for (const used of identifiersIn(child(prop, 'value'))) if (names.has(used)) return keyName
  }
  return undefined
}

/**
 * A fill bar: a `style` width computed with a percent sign, as a template ending in `%` or a
 * `+ '%'` concatenation. A literal width (`'50%'`) is not computed.
 */
const percentWidth = (opening: Node): boolean => {
  const value = child(attribute(opening, 'style') ?? { type: '' }, 'value')
  const style = unwrapped(
    value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : undefined,
  )
  if (style?.type !== 'ObjectExpression') return false
  return children(style, 'properties').some((prop) => {
    if (prop.type !== 'Property' || prop['computed'] === true) return false
    const key = child(prop, 'key')
    if ((nameOf(key) ?? stringValue(key)) !== 'width') return false
    const expression = unwrapped(child(prop, 'value'))
    if (expression?.type === 'TemplateLiteral') {
      const quasis = children(expression, 'quasis')
      const last = quasis.at(-1)?.['value'] as { cooked?: string | null; raw: string } | undefined
      return children(expression, 'expressions').length > 0 && (last?.cooked ?? last?.raw) === '%'
    }
    if (expression?.type === 'BinaryExpression' && expression['operator'] === '+') {
      return stringValue(child(expression, 'right')) === '%'
    }
    return false
  })
}

/**
 * An intrinsic element sized or positioned by a datum inside a `.map` callback: a `div` whose
 * `style` sets `width`, `height`, `left`, `top`, `right`, `bottom` or its flex share (`flex`,
 * `flexGrow`, `flexBasis`, `inlineSize`, `blockSize`, a `transform` of `scale`, `scaleX` or `scaleY`), or a custom property a class sizes the element from (`w-(--w)`,
 * `grow-(--g)`, `scale-x-(--s)`: the route `shadcn/no-inline-styles` names), from the datum's share. An SVG
 * mark is the `svg-data-marks` form's; a mark drawn through the geometry seam passes. One report
 * per map call. Outside a map, a `style` width computed with a percent sign (a fill bar from one
 * value) reports once per element, as does a custom property set from a computed value that a
 * class on the element sizes it by (`w-(--w)`, `h-(--h)`, `[width:var(--w)]`, cast or not), unless
 * the element sits in a seam-wired map.
 */
const htmlDataMarks = bespokeOff(
  form(
    'html-data-marks',
    `Use ui/progress or ui/meter for one value, BarList from basalt-ui/cards for a share bar, or ${SEAM_FIX}`,
    'CartesianChart marks for a mark the kinds lack',
    ({ report }) => {
      const seam = dataMarkScope()
      const reported = new Set<Node>()
      return mergeVisitors([
        seam.visitor,
        {
          JSXOpeningElement(node) {
            const tag = tagOf(node)
            if (tag === undefined || !/^[a-z]/.test(tag) || SVG_MARKS.has(tag)) return
            for (const map of seam.maps) {
              const key = datumGeometry(node, map.params)
              if (key === undefined) continue
              if (!reported.has(map.node) && !seam.wired(map)) {
                reported.add(map.node)
                report(node, `<${tag}> ${key} set from a datum`)
              }
              return
            }
            if (percentWidth(node)) {
              report(node, `<${tag}> width set to a computed percentage`)
              return
            }
            // A mark of a seam-wired `.map` (`focus.item(i)`) is the seam's, however it is sized.
            if (seam.maps.some((map) => seam.wired(map))) return
            const parentOpening = child(
              enclosingElement(parentOf(node) as Node) ?? { type: '' },
              'openingElement',
            )
            const property =
              computedSizeProperty(node) ??
              (parentOpening ? computedSizeProperty(node, parentOpening) : undefined)
            if (property !== undefined) {
              report(node, `<${tag}> sized by ${property}, set from a computed value`)
            }
          },
        },
      ])
    },
  ),
)

/** The roles that only make sense inside a table, grid or treegrid. */
const TABLE_PARTS: ReadonlySet<string> = new Set([
  'rowgroup',
  'columnheader',
  'rowheader',
  'row',
  'gridcell',
  'cell',
])

const INTRINSIC_ONLY_PARTS: ReadonlySet<string> = new Set(['row', 'gridcell', 'cell', 'rowheader'])

const roleTableOrGrid = form(
  'role-table',
  'Use ui/table, or DataTable for data, which carry the table semantics',
  'Eject ui/table to change its structure',
  ({ report }) => {
    // `row`, `gridcell`, `rowgroup` and the headers are the parts of a table; one outside an element with a table
    // or grid role is reported, so a table that is already reported is one finding.
    const roleTokens = (attribute: Node): string[] => {
      const value = child(attribute, 'value')
      const text =
        value?.type === 'JSXExpressionContainer'
          ? stringValue(child(value, 'expression'))
          : stringValue(value)
      return text === undefined ? [] : text.split(/\s+/)
    }
    const isWhole = (token: string): boolean =>
      token === 'table' || token === 'grid' || token === 'treegrid'
    const insideWhole = (attribute: Node): boolean => {
      for (let element = parentOf(attribute); element; element = parentOf(element)) {
        const opening = element.type === 'JSXElement' ? child(element, 'openingElement') : undefined
        if (!opening) continue
        const roles = children(opening, 'attributes').filter(
          (a) => a.type === 'JSXAttribute' && nameOf(child(a, 'name')) === 'role',
        )
        if (roles.some((a) => roleTokens(a).some(isWhole))) return true
      }
      return false
    }
    return {
      JSXAttribute(node) {
        if (nameOf(child(node, 'name')) !== 'role') return
        const tokens = roleTokens(node)
        const role = tokens.find(isWhole)
        if (role) return report(node, `role="${role}"`)
        // `row`, `gridcell`, `cell` and `rowheader` are read on an intrinsic element only: a
        // component (`<TableRow role="row">`) owns its markup.
        const owner = parentOf(node)
        const intrinsic = /^[a-z]/.test((owner && tagOf(owner)) ?? '')
        const part = tokens.find(
          (token) => TABLE_PARTS.has(token) && (intrinsic || !INTRINSIC_ONLY_PARTS.has(token)),
        )
        if (part && !insideWhole(node)) report(node, `role="${part}"`)
      },
    }
  },
)

/** True when a `.map` receiver is a chain through `.sort`, `.toSorted` or `.slice`. */
const isShapedRows = (receiver: Node | undefined): boolean => {
  let node = receiver
  while (node?.type === 'CallExpression') {
    const callee = child(node, 'callee')
    if (callee?.type !== 'MemberExpression') return false
    if (ROW_CHAIN.has(nameOf(child(callee, 'property')) ?? '')) return true
    node = child(callee, 'object')
  }
  return false
}

/** The collection and the mapper of `rows.map(fn)`, `rows.flatMap(fn)` or `Array.from(rows, fn)`. */
const mappedRows = (node: Node): { receiver: Node | undefined } | undefined => {
  if (isMapCall(node)) return { receiver: child(child(node, 'callee') as Node, 'object') }
  const callee = child(node, 'callee')
  if (callee?.type !== 'MemberExpression' || callee['computed'] === true) return undefined
  if (nameOf(child(callee, 'object')) !== 'Array' || nameOf(child(callee, 'property')) !== 'from') {
    return undefined
  }
  const args = children(node, 'arguments')
  return args.length > 1 ? { receiver: args[0] } : undefined
}

const FIXED_ROWS = /^[A-Z][A-Z0-9_]*$/

/**
 * Fixed content: an array literal or an UPPER_CASE constant (or a name bound to one), through any
 * method chain.
 */
const isFixedRows = (receiver: Node | undefined, bound: ReadonlySet<string>): boolean => {
  let node = receiver
  while (node?.type === 'CallExpression') {
    const callee = child(node, 'callee')
    if (callee?.type !== 'MemberExpression') return false
    node = child(callee, 'object')
  }
  // An array literal is fixed content; a spread copy (`[...rows]`) is the data it copies.
  if (node?.type === 'ArrayExpression') {
    return !children(node, 'elements').some((element) => element.type === 'SpreadElement')
  }
  const name = nameOf(node)
  return name !== undefined && (FIXED_ROWS.test(name) || bound.has(name))
}

/** A declaration's value is a sort/slice chain, directly or as a `useMemo` factory's result. */
const shapedInit = (init: Node | undefined): boolean => {
  if (isShapedRows(init)) return true
  if (init?.type !== 'CallExpression' || nameOf(child(init, 'callee')) !== 'useMemo') return false
  const factory = children(init, 'arguments')[0]
  return factory?.type === 'ArrowFunctionExpression' && isShapedRows(child(factory, 'body'))
}

/**
 * Table rows mapped from data inside a `TableBody`: DataTable owns sorting, paging and the header
 * menu. Rows from an array literal or an UPPER_CASE constant are fixed content and pass; a sort or
 * slice chain, or a name bound to one in the file, is named in the message. One report per
 * outermost `.map`, so the cells mapped inside a row are not a second finding.
 */
const tableRows = form(
  'table-rows',
  'Use DataTable: sorting, paging and the header menu are its columns',
  'ui/table stays for rows that are fixed content',
  ({ report }) => {
    const bodies: Node[] = []
    const shaped = new Set<string>()
    const fixed = new Set<string>()
    const mapped = new WeakSet<Node>()
    let depth = 0
    return {
      VariableDeclarator(node) {
        const name = nameOf(child(node, 'id'))
        if (name === undefined) return
        const init = child(node, 'init')
        if (isFixedRows(init, fixed) && init?.type !== 'Identifier') fixed.add(name)
        else if (shapedInit(init)) shaped.add(name)
      },
      JSXElement(node) {
        const open = child(node, 'openingElement')
        if (open && tagOf(open) === 'TableBody') bodies.push(node)
      },
      'JSXElement:exit'(node) {
        if (bodies.at(-1) === node) bodies.pop()
      },
      CallExpression(node) {
        const rows = bodies.length === 0 ? undefined : mappedRows(node)
        if (!rows) return
        mapped.add(node)
        depth += 1
        if (depth > 1) return
        const { receiver } = rows
        if (isFixedRows(receiver, fixed)) return
        const hoisted = shaped.has(nameOf(receiver) ?? '')
        report(
          node,
          isShapedRows(receiver)
            ? 'rows from a sort/slice chain'
            : hoisted
              ? 'rows from a hoisted sort/slice'
              : 'rows mapped from data',
        )
      },
      'CallExpression:exit'(node) {
        if (mapped.has(node)) depth -= 1
      },
      JSXOpeningElement(node) {
        if (tagOf(node) === 'TableHead' && attribute(node, 'onClick')) {
          report(node, '<TableHead onClick>')
        }
      },
    }
  },
)

/** `border-t`, `border-b`, `border-y` and `divide-y` at any width above zero, under any variants. */
const ROW_RULE = /^(?:border-[tby]|divide-y)(?:-(?!0$|reverse$)\d+)?$/

/** Intrinsic elements a row is; table rows are `raw-table`'s. */
const ROW_TAGS: ReadonlySet<string> = new Set(['div', 'li', 'a', 'button', 'article', 'section'])
/** The element a `divide-y` sits on is a row container, so a list too. */
const DIVIDE_TAGS: ReadonlySet<string> = new Set([...ROW_TAGS, 'ul', 'ol'])

const rowRuleToken = (opening: Node): string | undefined =>
  classTokens(opening).find((token) => ROW_RULE.test(token.slice(token.lastIndexOf(':') + 1)))

/**
 * A repeating row list built by hand: a row element a data `.map` returns that carries a
 * `border-t`, `border-b` or `border-y` utility, or an element with `divide-y` whose children are
 * a data `.map`. Rows from an array literal or an UPPER_CASE constant are fixed content (a nav) and
 * pass, and so does a full `border` (a tile). With the default border color a bare rule is the
 * hairline now, but the list is still a part: RowList owns the row, its focus link, its scroll and
 * its density.
 */
const listRows = form(
  'list-rows',
  'Use RowList from basalt-ui/cards: rows are separated by spacing, with a hairline opt-in',
  'Several columns are DataTable; bars against one scale are BarList; a stream of events is EventList',
  ({ report }) => {
    const fixed = new Set<string>()
    return {
      VariableDeclarator(node) {
        const name = nameOf(child(node, 'id'))
        const init = child(node, 'init')
        if (name !== undefined && isFixedRows(init, fixed) && init?.type !== 'Identifier') {
          fixed.add(name)
        }
      },
      JSXElement(node) {
        const open = child(node, 'openingElement')
        const tag = open === undefined ? undefined : tagOf(open)
        if (open === undefined || tag === undefined || !DIVIDE_TAGS.has(tag)) return
        const token = rowRuleToken(open)
        if (token === undefined) return
        const base = token.slice(token.lastIndexOf(':') + 1)
        if (!base.startsWith('divide-') && !ROW_TAGS.has(tag)) return
        if (base.startsWith('divide-')) {
          const mapped = children(node, 'children').find((kid) => {
            const expression =
              kid.type === 'JSXExpressionContainer' ? child(kid, 'expression') : kid
            return expression?.type === 'CallExpression' && mappedRows(expression) !== undefined
          })
          const call = mapped && child(mapped, 'expression')
          const rows = call && mappedRows(call)
          if (rows && !isFixedRows(rows.receiver, fixed)) report(node, `<${tag} class="${token}">`)
          return
        }
        const call = mapReturning(node)
        const rows = call && mappedRows(call)
        if (rows && !isFixedRows(rows.receiver, fixed)) report(node, `<${tag} class="${token}">`)
      },
    }
  },
)

/** The root element a `body` expression renders, through arrows, ternaries and `&&`. */
function bodyRoots(expression: Node | undefined): Node[] {
  if (!expression) return []
  switch (expression.type) {
    case 'JSXElement': {
      const tag = tagOf(child(expression, 'openingElement') as Node)
      const inside =
        tag !== undefined && /^[a-z]/.test(tag)
          ? children(expression, 'children').flatMap(bodyRoots)
          : []
      return [expression, ...inside]
    }
    case 'JSXFragment':
      return children(expression, 'children').flatMap(bodyRoots)
    case 'JSXExpressionContainer':
      return bodyRoots(child(expression, 'expression'))
    case 'ArrowFunctionExpression':
      return bodyRoots(child(expression, 'body'))
    case 'ConditionalExpression':
      return [
        ...bodyRoots(child(expression, 'consequent')),
        ...bodyRoots(child(expression, 'alternate')),
      ]
    case 'LogicalExpression':
      return bodyRoots(child(expression, 'right'))
    default:
      return []
  }
}

/**
 * A card frame: `ChartCard`, `DataPanel`, `Card`, any `*Card` or `*Panel` (`StatCard`), and
 * `StatCell`, whose `chart` slot is a box the kit draws inside its `StatGroup` as `StatCard`'s is.
 */
const isCardFrame = (tag: string): boolean =>
  tag === 'StatCell' || /^(?:Card|[A-Z]\w*(?:Card|Panel))$/.test(tag)

/** The sectioning elements a page is made of; a `div` is a layout wrapper a card may wrap elsewhere. */
const PAGE_ELEMENTS: ReadonlySet<string> = new Set(['section', 'main', 'article', 'aside'])

/**
 * True when a chart kind sits under a page element (`section`, `main`, `article`, `aside`) with no
 * card frame or chart kind above it: `<section><Lines /></section>`. A chart that is the whole
 * return of a component, under components only, or under a `div` has no such ancestor and passes.
 */
/** `P.Section`, a member tag with an identifier object: `P.Section`. */
const qualifiedTag = (opening: Node): string | undefined => {
  const name = child(opening, 'name')
  if (name?.type !== 'JSXMemberExpression') return undefined
  const object = nameOf(child(name, 'object'))
  const property = nameOf(child(name, 'property'))
  return object !== undefined && property !== undefined ? `${object}.${property}` : undefined
}

function bareInPage(chart: Node, pageParts: ReadonlySet<string>): boolean {
  let intrinsic = false
  for (let at = parentOf(parentOf(chart) as Node); at; at = parentOf(at)) {
    if (at.type !== 'JSXElement') continue
    const open = child(at, 'openingElement') as Node
    const tag = tagOf(open) ?? qualifiedTag(open)
    if (tag === undefined) continue
    if (isCardFrame(tag) || CHART_KINDS.has(tag)) return false
    if (PAGE_ELEMENTS.has(tag) || pageParts.has(tag)) intrinsic = true
  }
  return intrinsic
}

/** basalt's own page frames: a `Section` or `Page` from `basalt-ui/page` is never a card. */
const PAGE_FRAMES: ReadonlySet<string> = new Set(['Section', 'Page'])

/**
 * A chart kind as a `DataPanel` body root, or bare in a page: a page element (or `Section`/`Page`
 * imported from `basalt-ui/page`, under any local name or through a namespace import) above it and no `ChartCard`, `DataPanel`,
 * `Card` or other `*Card` / `*Panel` frame. A plain `Card` passes.
 */
const chartBodyRoot = form(
  'chart-body-root',
  'Wrap the chart in ChartCard; DataPanel body is for tables, lists and boards',
  'A bespoke layout is parts inside DataPanel',
  ({ report }) => {
    const pageParts = new Set<string>()
    return mergeVisitors([
      {
        ImportDeclaration(node) {
          if (stringValue(child(node, 'source')) !== 'basalt-ui/page') return
          for (const spec of children(node, 'specifiers')) {
            if (spec.type === 'ImportNamespaceSpecifier') {
              const namespace = nameOf(child(spec, 'local'))
              if (namespace === undefined) continue
              for (const frame of PAGE_FRAMES) pageParts.add(`${namespace}.${frame}`)
              continue
            }
            const imported = nameOf(child(spec, 'imported'))
            const local = nameOf(child(spec, 'local'))
            if (imported !== undefined && local !== undefined && PAGE_FRAMES.has(imported)) {
              pageParts.add(local)
            }
          }
        },
      },
      opening((node) => chartBodyOpening(node, pageParts, report)),
    ])
  },
)

function chartBodyOpening(
  node: Node,
  pageParts: ReadonlySet<string>,
  report: Parameters<AstForm['detect']>[0]['report'],
): void {
  const own = tagOf(node)
  if (own !== undefined && CHART_KINDS.has(own)) {
    if (bareInPage(node, pageParts)) report(node, `<${own}> outside a card`)
    return
  }
  if (own !== 'DataPanel') return
  const value = child(attribute(node, 'body') ?? { type: '' }, 'value')
  if (value?.type !== 'JSXExpressionContainer') return
  for (const root of bodyRoots(child(value, 'expression'))) {
    const tag = tagOf(child(root, 'openingElement') as Node)
    if (tag !== undefined && CHART_KINDS.has(tag)) report(root, `<${tag}> as DataPanel body`)
  }
}

const isIntlFormat = (node: Node): boolean => {
  if (node.type !== 'NewExpression' && node.type !== 'CallExpression') return false
  const callee = child(node, 'callee')
  if (callee?.type !== 'MemberExpression' || callee['computed'] === true) return false
  const method = nameOf(child(callee, 'property'))
  return (
    nameOf(child(callee, 'object')) === 'Intl' && method !== undefined && method.endsWith('Format')
  )
}

const DATE_FNS_FORMATTERS: ReadonlySet<string> = new Set([
  'format',
  'formatDistance',
  'formatDistanceStrict',
  'formatDistanceToNow',
  'formatDistanceToNowStrict',
  'formatRelative',
  'formatDuration',
])

const MOMENT_LIKE: ReadonlySet<string> = new Set(['dayjs', 'moment'])

/** The identifier a call or member chain starts from: `DateTime` of `DateTime.fromISO(at).toUTC()`. */
function chainRoot(node: Node | undefined): string | undefined {
  let at = node
  while (at?.type === 'CallExpression' || at?.type === 'MemberExpression') {
    const next = child(at, at.type === 'CallExpression' ? 'callee' : 'object')
    const name = nameOf(next)
    if (name !== undefined) return name
    at = next
  }
  return undefined
}

/** A luxon `DateTime` chain: `DateTime.fromISO(at)`, `DateTime.now().setZone(z)`. */
const isLuxonChain = (node: Node | undefined): boolean =>
  node?.type === 'CallExpression' && chainRoot(node) === 'DateTime'

/** The `dayjs` or `moment` a call chain starts from: `dayjs(at)`, `dayjs(at).utc()`, `moment.utc(at)`. */
function momentRoot(node: Node | undefined): string | undefined {
  const root = chainRoot(node)
  return root !== undefined && MOMENT_LIKE.has(root) ? root : undefined
}

const isMomentChain = (node: Node | undefined): boolean =>
  node?.type === 'CallExpression' && momentRoot(node) !== undefined

/** Wrappers that pass a string through: a template, `+`, a ternary, a cast. */
const PASS_THROUGH: ReadonlySet<string> = new Set([
  'TemplateLiteral',
  'BinaryExpression',
  'LogicalExpression',
  'ConditionalExpression',
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSNonNullExpression',
])

/** True when the value is a child expression of a JSX element: `<span>{x.toFixed(1)}%</span>`. */
function rendersAsChild(node: Node): boolean {
  let at = parentOf(node)
  while (at && PASS_THROUGH.has(at.type)) at = parentOf(at)
  if (at?.type !== 'JSXExpressionContainer') return false
  const owner = parentOf(at)
  return owner?.type === 'JSXElement' || owner?.type === 'JSXFragment'
}

/**
 * `new Intl.*Format(...)`, `toLocale*String(...)`, a `toFixed` rendered as JSX text and a named
 * date-fns formatter pin the locale or the number format in app code. Reading
 * `new Intl.DateTimeFormat().resolvedOptions()` is not formatting and passes. A `.format(...)` on a
 * `dayjs(...)` or `moment(...)` call chain reads as a date-fns formatter does. Test files pass.
 */
const intlFormat: AstForm = {
  ...form(
    'intl-format',
    'Use useFormat in components and createFormat in .ts modules',
    'A reasoned waiver where Format has no matching option',
    ({ context, report }) => {
      if (isTestFile(context)) return {}
      const resolved = new WeakSet<Node>()
      const dateFns = new Set<string>()
      const calls: { node: Node; name: string }[] = []
      return {
        ImportDeclaration(node) {
          const source = stringValue(child(node, 'source'))
          if (source !== 'date-fns' && source !== 'date-fns/format') return
          for (const spec of children(node, 'specifiers')) {
            const local = nameOf(child(spec, 'local'))
            if (local === undefined) continue
            if (spec.type === 'ImportDefaultSpecifier' && source === 'date-fns/format') {
              dateFns.add(local)
            }
            const imported = child(spec, 'imported')
            const importedName = nameOf(imported) ?? stringValue(imported)
            if (
              spec.type === 'ImportSpecifier' &&
              importedName !== undefined &&
              DATE_FNS_FORMATTERS.has(importedName)
            ) {
              dateFns.add(local)
            }
          }
        },
        'Program:exit'() {
          for (const { node, name } of calls)
            if (dateFns.has(name)) report(node, `${name}() from date-fns`)
        },
        CallExpression(node) {
          const callee = child(node, 'callee')
          const bare = nameOf(callee)
          if (bare !== undefined) calls.push({ node, name: bare })
          if (callee?.type === 'MemberExpression' && callee['computed'] !== true) {
            const method = nameOf(child(callee, 'property'))
            if (method === 'resolvedOptions') {
              const object = child(callee, 'object')
              if (object) resolved.add(object)
              return
            }
            if (method === 'format' && isMomentChain(child(callee, 'object'))) {
              report(node, `${momentRoot(child(callee, 'object'))}().format()`)
              return
            }
            if (
              (method === 'toFormat' ||
                method === 'toRelative' ||
                method === 'toRelativeCalendar') &&
              isLuxonChain(child(callee, 'object'))
            ) {
              if (rendersAsChild(node)) report(node, `DateTime.${method}()`)
              return
            }
            if (
              method === 'toFixed' ||
              (method !== undefined && ENGLISH_DATE_METHODS.has(method))
            ) {
              if (rendersAsChild(node)) report(node, `${method}()`)
              return
            }
            if (method !== undefined && LOCALE_METHODS.has(method)) {
              report(node, `${method}()`)
              return
            }
          }
          if (isIntlFormat(node) && !resolved.has(node)) report(node, 'Intl.*Format()')
        },
        NewExpression(node) {
          if (isIntlFormat(node) && !resolved.has(node)) report(node, 'new Intl.*Format()')
        },
      }
    },
  ),
}

/** `formsOff`: form ids a config block switches off for its files (an override, a zone). */
const OPTIONS_SCHEMA = [
  {
    type: 'object',
    properties: { formsOff: { type: 'array', items: { type: 'string' } } },
    additionalProperties: false,
  },
] as const

/** The figure fields that are the card's answer: they stay while a hover moves. */
const HEADLINE_FIELDS: ReadonlySet<string> = new Set(['value', 'delta'])

/** A call of a focus handle's `readout` (`focus.readout(rest, read)`, any receiver). */
const isReadoutCall = (node: Node): boolean => {
  if (node.type !== 'CallExpression') return false
  const callee = child(node, 'callee')
  return callee?.type === 'MemberExpression' && nameOf(child(callee, 'property')) === 'readout'
}

/**
 * The headline fields of every figure object a `figure` expression can take, through a ternary
 * (`ready ? { … } : { value: null }`) or a logical operand; an object nested inside a field (a
 * `delta` object) is part of that field.
 */
function headlineFields(node: Node | undefined): Node[] {
  if (node === undefined) return []
  if (node.type === 'ObjectExpression')
    return children(node, 'properties').filter(
      (p) => p.type === 'Property' && HEADLINE_FIELDS.has(nameOf(child(p, 'key')) ?? ''),
    )
  if (node.type === 'ConditionalExpression')
    return [
      ...headlineFields(child(node, 'consequent')),
      ...headlineFields(child(node, 'alternate')),
    ]
  if (node.type === 'LogicalExpression')
    return [...headlineFields(child(node, 'left')), ...headlineFields(child(node, 'right'))]
  return []
}

const figureReadout = form(
  'figure-readout',
  "Keep the figure's value and delta the answer; the focused datum's reading goes in the figure's period or status, or the tooltip",
  'A reading that needs a figure of its own is a tooltip row (tooltip.rows)',
  ({ report }) =>
    opening((node) => {
      const value = child(attribute(node, 'figure') ?? { type: '' }, 'value')
      if (value?.type !== 'JSXExpressionContainer') return
      for (const field of headlineFields(child(value, 'expression'))) {
        if (someNode(child(field, 'value'), isReadoutCall))
          report(field, `figure ${nameOf(child(field, 'key')) ?? 'field'} from focus.readout`)
      }
    }),
)

export const PRIMITIVE_BYPASS: RuleEntry = {
  family: 'structure',
  profiles: ['parts', 'app'],
  zonesOff: ['ejected', 'seed'],
  defect:
    '6 of 10 repos hand-roll tables; console 10 raw controls, 5 tables, 20 headings, ~600 lines hand SVG; 13 selection waivers; 5 of 7 apps pin locale; axe label critical 8/8',
  forms: [
    rawControl,
    checkableInput,
    rawHeading,
    rawTable,
    svgDataMarks,
    htmlDataMarks,
    roleTableOrGrid,
    tableRows,
    listRows,
    chartBodyRoot,
    intlFormat,
    figureReadout,
  ],
  schema: OPTIONS_SCHEMA,
}

export const primitiveBypassRules = defineRules({ 'primitive-bypass': PRIMITIVE_BYPASS })
