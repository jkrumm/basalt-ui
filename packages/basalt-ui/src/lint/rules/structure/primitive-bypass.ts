/**
 * `primitive-bypass` (guardrails section 4, row 9): hand-rolled markup where a primitive exists.
 * Six of ten repos hand-roll tables, the console ships 10 raw controls and 20 headings, and five
 * of seven apps pin a locale. Ten forms, all on; the `Intl` form points at `useFormat`, which
 * now carries `time` and an options bag. A mark drawn through the geometry seam (`useChartFocus`)
 * is legal in both the SVG and the HTML data-mark form.
 *
 * Ejected and seed files define the primitives, so the preset switches the rule off there.
 *
 * Known limits (syntactic rule, no type information, no cross-file reads):
 * - `table-rows`: rows built by a helper or a hook (`rowsOf(data).map(...)`) read as data too; a
 *   fixed table is an UPPER_CASE constant or an array literal. A `.map` nested in a row is the
 *   row's cells, never a second report.
 * - `svg-data-marks`: a `<path d>` from a d3-shape generator (`line()(data)`) or a helper that
 *   returns the string is not read; only a `d` built in the file with `.map`, `.flatMap` or
 *   `.reduce` is.
 * - `html-data-marks`: a custom-property mark is read only when the class names the property in a
 *   geometry utility (`w-(--w)`, `h-[var(--h)]`); a property read by a stylesheet is out of reach.
 * - `intl-format`: `toFixed` is read where it renders (a JSX child expression, directly or through
 *   a template literal, `+` or a ternary). One returned from a helper, a key or a CSS value is not
 *   display text by syntax and passes. A date-fns formatter is read through a named import from
 *   `date-fns` or `date-fns/format`; a namespace import is out of reach. Test files
 *   (`*.test.*`, `*.spec.*`) are skipped: they compute expected text.
 * - `chart-body-root`: a wrapper that is a component (`<Stack>`) passes; only a lowercase element
 *   is looked through.
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
  'DualPanel',
  'MirroredBars',
])

const RAW_CONTROLS: ReadonlySet<string> = new Set(['button', 'input', 'select', 'textarea'])
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

/**
 * Raw `button`, `input`, `select` and `textarea`. A `type="file"` input that is visually hidden
 * (a `hidden` attribute, or a `sr-only` or `hidden` class) passes: it sits behind a label, and no
 * primitive wraps a file input. A visible file input still reports.
 */
const rawControl = form(
  'raw-control',
  'Use ui/button, ui/input, ui/select or ui/textarea',
  'Eject the primitive to change its structure',
  ({ report }) =>
    opening((node) => {
      const tag = tagOf(node)
      if (tag === undefined || !RAW_CONTROLS.has(tag)) return
      if (tag === 'input' && (isCheckable(node) || isHiddenFileInput(node))) return
      report(node, `<${tag}>`)
    }),
)

const checkableInput = form(
  'checkable-input',
  'Use ui/checkbox, ui/switch or ui/radio-group',
  'Bind a boolean field with FormField',
  ({ report }) =>
    opening((node) => {
      if (tagOf(node) === 'input' && isCheckable(node)) {
        report(node, `input[type="${attributeText(node, 'type')}"]`)
      }
    }),
)

const GROUP_ELEMENTS: ReadonlySet<string> = new Set(['section', 'li'])

/** The element a node of an element sits in, through containers and fragments. */
const enclosingElement = (element: Node): Node | undefined => {
  for (let at = parentOf(element); at; at = parentOf(at)) if (at.type === 'JSXElement') return at
  return undefined
}

/** True when `element` is what a `.map` callback returns: an arrow body or a `return`. */
function returnedFromMap(element: Node): boolean {
  let at: Node = element
  let up = parentOf(at)
  while (up?.type === 'ParenthesizedExpression') {
    at = up
    up = parentOf(at)
  }
  if (up?.type === 'ReturnStatement') {
    const block = parentOf(up)
    const fn = block?.type === 'BlockStatement' ? parentOf(block) : undefined
    return fn !== undefined && isMapCallback(fn)
  }
  return up?.type === 'ArrowFunctionExpression' && up['body'] === at && isMapCallback(up)
}

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
  ({ report }) =>
    opening((node) => {
      const tag = tagOf(node)
      if (tag === undefined || !HEADINGS.has(tag)) return
      const group = enclosingElement(parentOf(node) as Node)
      const groupTag = group ? tagOf(child(group, 'openingElement') as Node) : undefined
      if (
        group &&
        groupTag !== undefined &&
        GROUP_ELEMENTS.has(groupTag) &&
        returnedFromMap(group)
      ) {
        return
      }
      report(node, `<${tag}>`)
    }),
)

const rawTable = form(
  'raw-table',
  'Use ui/table for a static table and DataTable for data',
  'Eject ui/table to change its structure',
  ({ report }) =>
    opening((node) => {
      if (tagOf(node) === 'table') report(node, '<table>')
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

/**
 * What the data-mark forms share: the `.map` callbacks around a node, and whether a mark is drawn
 * through the geometry seam. Wired means the mark, or an element between it and its `.map`,
 * spreads `focus.item(i)`, inside an element that spreads the same handle's `focus.target`, where
 * `focus` is the result of `useChartFocus(...)` in this file.
 */
function dataMarkScope() {
  const handles = new Set<string>()
  const frames: JsxFrame[] = []
  const maps: MapScope[] = []
  const entered = new WeakSet<Node>()
  const visitor: Visitor = {
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
          handles.has(handle) &&
          frames.slice(0, map.frames).some((frame) => frame.targets.has(handle)),
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

/**
 * A mark drawn per datum inside an `<svg>`: `data.map((d) => <rect … />)`. Static artwork (an icon,
 * a fixed grid) is not data-mapped and passes, and so does a mark drawn through the geometry seam.
 * One report per map call. A `<path d>` built from data (an inline `.map(...).join(' ')`, or a name
 * a declaration in the file binds to one) is a data mark too; a constant `d` is artwork.
 */
const svgDataMarks = form(
  'svg-data-marks',
  `Draw the chart with ChartCard and a kind from basalt-ui/charts, or ${SEAM_FIX}`,
  'CartesianChart marks for a mark the kinds lack',
  ({ report }) => {
    type SvgScope = { maps: MapScope[]; reported: Set<Node> }
    const scopes: SvgScope[] = []
    const entered = new WeakSet<Node>()
    const seam = dataMarkScope()
    const builtPaths = new Set<string>()
    const pathFromData = (opening: Node): boolean => {
      const value = child(attribute(opening, 'd') ?? { type: '' }, 'value')
      const expression =
        value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : undefined
      if (!expression) return false
      const name = nameOf(expression)
      return name !== undefined ? builtPaths.has(name) : someNode(expression, isBuildCall)
    }
    return mergeVisitors([
      seam.visitor,
      {
        VariableDeclarator(node) {
          const name = nameOf(child(node, 'id'))
          if (name !== undefined && someNode(child(node, 'init'), isBuildCall)) builtPaths.add(name)
        },
        JSXElement(node) {
          const open = child(node, 'openingElement')
          if (open && tagOf(open) === 'svg') {
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
          if (tag === 'path' && !map && pathFromData(node)) {
            if (!children(node, 'attributes').some((attr) => seamSpread(attr))) {
              report(node, '<path> d built from data')
            }
            return
          }
          if (!scope || !map || tag === undefined || !SVG_MARKS.has(tag)) return
          if (scope.reported.has(map.node) || seam.wired(map)) return
          scope.reported.add(map.node)
          report(node, `<${tag}> mapped over data`)
        },
      },
    ])
  },
)

const GEOMETRY_STYLE: ReadonlySet<string> = new Set([
  'width',
  'height',
  'left',
  'top',
  'right',
  'bottom',
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

/** True when a class names the custom property in a geometry utility: `w-(--w)`, `h-[var(--h)]`. */
const sizesFromProperty = (opening: Node, property: string): boolean => {
  const name = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const utility = new RegExp(
    `^(?:[\\w-]+:)*-?(?:(?:min|max)-)?(?:w|h|size|left|top|right|bottom|inset|basis)-(?:\\(${name}\\)|\\[var\\(${name}\\)\\])$`,
  )
  return classTokens(opening).some((token) => utility.test(token))
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
    const geometry = GEOMETRY_STYLE.has(keyName)
    if (!geometry && !(keyName.startsWith('--') && sizesFromProperty(opening, keyName))) continue
    for (const used of identifiersIn(child(prop, 'value'))) if (names.has(used)) return keyName
  }
  return undefined
}

/**
 * An intrinsic element sized or positioned by a datum inside a `.map` callback: a `div` whose
 * `style` sets `width`, `height`, `left`, `top`, `right` or `bottom` (or a custom property a class
 * sizes the element from, `w-(--w)`) from the datum's share. An SVG
 * mark is the `svg-data-marks` form's; a mark drawn through the geometry seam passes. One report
 * per map call.
 */
const htmlDataMarks = form(
  'html-data-marks',
  `Use BarList from basalt-ui/cards for a share bar, or ${SEAM_FIX}`,
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
        },
      },
    ])
  },
)

const roleTableOrGrid = form(
  'role-table',
  'Use ui/table, or DataTable for data, which carry the table semantics',
  'Eject ui/table to change its structure',
  ({ report }) => ({
    JSXAttribute(node) {
      if (nameOf(child(node, 'name')) !== 'role') return
      const value = child(node, 'value')
      const text =
        value?.type === 'JSXExpressionContainer'
          ? stringValue(child(value, 'expression'))
          : stringValue(value)
      if (text === undefined) return
      const role = text.split(/\s+/).find((token) => token === 'table' || token === 'grid')
      if (role) report(node, `role="${role}"`)
    },
  }),
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
  if (node?.type === 'ArrayExpression') return true
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
        if (bodies.length === 0 || !isMapCall(node)) return
        mapped.add(node)
        depth += 1
        if (depth > 1) return
        const receiver = child(child(node, 'callee') as Node, 'object')
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

const chartBodyRoot = form(
  'chart-body-root',
  'Wrap the chart in ChartCard; DataPanel body is for tables, lists and boards',
  'A bespoke layout is parts inside DataPanel',
  ({ report }) =>
    opening((node) => {
      if (tagOf(node) !== 'DataPanel') return
      const value = child(attribute(node, 'body') ?? { type: '' }, 'value')
      if (value?.type !== 'JSXExpressionContainer') return
      for (const root of bodyRoots(child(value, 'expression'))) {
        const tag = tagOf(child(root, 'openingElement') as Node)
        if (tag !== undefined && CHART_KINDS.has(tag)) report(root, `<${tag}> as DataPanel body`)
      }
    }),
)

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
 * `new Intl.DateTimeFormat().resolvedOptions()` is not formatting and passes. Test files pass.
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
            if (method === 'toFixed') {
              if (rendersAsChild(node)) report(node, 'toFixed()')
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
    chartBodyRoot,
    intlFormat,
  ],
}

export const primitiveBypassRules = defineRules({ 'primitive-bypass': PRIMITIVE_BYPASS })
