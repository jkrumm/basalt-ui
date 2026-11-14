/**
 * `primitive-bypass` (guardrails section 4, row 9): hand-rolled markup where a primitive exists.
 * Six of ten repos hand-roll tables, the console ships 10 raw controls and 20 headings, and five
 * of seven apps pin a locale. Ten forms, all on; the `Intl` form points at `useFormat`, which
 * now carries `time` and an options bag. A mark drawn through the geometry seam (`useChartFocus`)
 * is legal in both the SVG and the HTML data-mark form.
 *
 * Ejected and seed files define the primitives, so the preset switches the rule off there.
 */
import type { Node, Visitor } from '../../factory'
import { mergeVisitors } from '../../factory'
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

const rawControl = form(
  'raw-control',
  'Use ui/button, ui/input, ui/select or ui/textarea',
  'Eject the primitive to change its structure',
  ({ report }) =>
    opening((node) => {
      const tag = tagOf(node)
      if (tag === undefined || !RAW_CONTROLS.has(tag)) return
      if (tag === 'input' && isCheckable(node)) return
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

const rawHeading = form(
  'raw-heading',
  'Name the area with Section or PageBar; text-display is the title style',
  'A heading inside prose is Prose',
  ({ report }) =>
    opening((node) => {
      const tag = tagOf(node)
      if (tag !== undefined && HEADINGS.has(tag)) report(node, `<${tag}>`)
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

/**
 * A mark drawn per datum inside an `<svg>`: `data.map((d) => <rect … />)`. Static artwork (an icon,
 * a fixed grid) is not data-mapped and passes, and so does a mark drawn through the geometry seam.
 * One report per map call.
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
    return mergeVisitors([
      seam.visitor,
      {
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

/** The geometry keys of a `style={{ … }}` object whose value reads a name in `names`. */
const datumGeometry = (opening: Node, names: ReadonlySet<string>): string | undefined => {
  const value = child(attribute(opening, 'style') ?? { type: '' }, 'value')
  const style = value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : undefined
  if (style?.type !== 'ObjectExpression') return undefined
  for (const prop of children(style, 'properties')) {
    if (prop.type !== 'Property' || prop['computed'] === true) continue
    const key = child(prop, 'key')
    const keyName = nameOf(key) ?? stringValue(key)
    if (keyName === undefined || !GEOMETRY_STYLE.has(keyName)) continue
    for (const used of identifiersIn(child(prop, 'value'))) if (names.has(used)) return keyName
  }
  return undefined
}

/**
 * An intrinsic element sized or positioned by a datum inside a `.map` callback: a `div` whose
 * `style` sets `width`, `height`, `left`, `top`, `right` or `bottom` from the datum's share. An SVG
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

const tableRows = form(
  'table-rows',
  'Use DataTable: sorting, paging and the header menu are its columns',
  'ui/table stays for rows that are fixed content',
  ({ report }) => {
    const bodies: Node[] = []
    return {
      JSXElement(node) {
        const open = child(node, 'openingElement')
        if (open && tagOf(open) === 'TableBody') bodies.push(node)
      },
      'JSXElement:exit'(node) {
        if (bodies.at(-1) === node) bodies.pop()
      },
      CallExpression(node) {
        if (bodies.length === 0 || !isMapCall(node)) return
        const callee = child(node, 'callee') as Node
        if (isShapedRows(child(callee, 'object'))) report(node, 'rows from a sort/slice chain')
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
    case 'JSXElement':
      return [expression]
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

/**
 * `new Intl.*Format(...)` and `toLocale*String(...)` pin the locale in app code. Reading
 * `new Intl.DateTimeFormat().resolvedOptions()` is not formatting and passes.
 */
const intlFormat: AstForm = {
  ...form(
    'intl-format',
    'Use useFormat in components and createFormat in .ts modules',
    'A reasoned waiver where Format has no matching option',
    ({ report }) => {
      const resolved = new WeakSet<Node>()
      return {
        CallExpression(node) {
          const callee = child(node, 'callee')
          if (callee?.type === 'MemberExpression' && callee['computed'] !== true) {
            const method = nameOf(child(callee, 'property'))
            if (method === 'resolvedOptions') {
              const object = child(callee, 'object')
              if (object) resolved.add(object)
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
