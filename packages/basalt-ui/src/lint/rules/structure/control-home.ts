/**
 * `basalt/control-home` (guardrails section 4, row 10): one form, `outside-home`. A JSX use of a
 * control primitive (`ui/select`, `combobox`, `segmented`, `number-field`, `slider`, `switch`,
 * `checkbox`, `radio-group`, and `input` and `tabs` when their value is `useState` or `useReducer`
 * state: the search box filtering a list and `Tabs` as the page's view switch) in app code whose lexical ancestors in the same file are none of a
 * home. The predicate is file-local and wrapper-only (controls-url-state section 9, I7): it never
 * infers a home from where a component is rendered, so a control a file renders for another
 * file's home needs its own `ControlHome`. Body children of `Section` and `Page` and the nodes of
 * a page slot are the same predicate: neither is a home.
 *
 * A control is in a home when an ancestor (or the control itself) is
 *
 * - `FormField`, `FilterSet`, `ViewTabs` or `ControlHome`;
 * - a render passed to `filterSlot.custom(...)` that keeps no state of its own (`useState` or
 *   `useReducer` in that function, or a control value prop reading such state from an enclosing
 *   function, is a value with no handle, so the custom render is not a home);
 * - a handle-taking composite: a JSX element with an attribute named `handle`, `control` or
 *   `field` whose value is a `.field.<name>` member chain, or an identifier hoisted from one
 *   (`const range = store.field.range`), resolved at `Program:exit` so the order of the
 *   declaration and the element does not matter.
 *
 * Known limit: an `Input` or `Tabs` is a control in a form far more often than a filter, so it
 * reports only when its value reads state held in the same file; a value from a prop, a store
 * outside the file or a form library passes, since syntax cannot tell a filter from a form field.
 *
 * Never file-waivable: `waiver-needs-reason` rejects a file-level directive for this id, because
 * each control outside a home is a product signal. A line waiver with a reason is the counted
 * escape; above 5 per app the homes are redesigned, never the rule widened (spikes/control-home).
 */
import type { Node, Visitor } from '../../factory'
import type { AstForm } from '../../rule-table'
import { defineRules } from '../../rule-table'

const CONTROL_PRIMITIVES: ReadonlySet<string> = new Set([
  'select',
  'combobox',
  'segmented',
  'number-field',
  'slider',
  'switch',
  'checkbox',
  'radio-group',
  'input',
  'tabs',
])

/**
 * Roots read only when their value is held in `useState` or `useReducer` (the search box filtering
 * a list, the page's view switch): an `Input` or `Tabs` in a form or a `defaultValue` tab set is
 * not a control with a missing handle, so only a value with no handle reports.
 */
const STATE_ONLY_ROOTS: ReadonlySet<string> = new Set(['Input', 'Tabs'])

/** The root component of each primitive: its parts (`SelectItem`, `Radio`) are never controls of their own. */
const CONTROL_ROOTS: ReadonlySet<string> = new Set([
  'Select',
  'NativeSelect',
  'Combobox',
  'Autocomplete',
  'Segmented',
  'NumberField',
  'Slider',
  'Switch',
  'Checkbox',
  'CheckboxGroup',
  'RadioGroup',
  ...STATE_ONLY_ROOTS,
])

/** The props through which a control holds its value: reading state through one means no handle owns it. */
const VALUE_ATTRIBUTES: ReadonlySet<string> = new Set([
  'value',
  'defaultValue',
  'checked',
  'defaultChecked',
  'onValueChange',
  'onValueCommit',
  'onCheckedChange',
  'onChange',
])

const HOMES: ReadonlySet<string> = new Set(['FormField', 'FilterSet', 'ViewTabs', 'ControlHome'])
const HANDLE_ATTRIBUTES: ReadonlySet<string> = new Set(['handle', 'state', 'control', 'field'])
const STATE_HOOKS: ReadonlySet<string> = new Set(['useState', 'useReducer'])

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

const nameOf = (node: Node | undefined): string | undefined =>
  node?.type === 'Identifier' || node?.type === 'JSXIdentifier'
    ? (node['name'] as string)
    : undefined

/** The component a source imports a control from: `basalt-ui/ui/select` and `@/components/ui/select`. */
const controlPrimitive = (source: unknown): boolean => {
  if (typeof source !== 'string') return false
  const match = /(?:^|\/)ui\/([a-z-]+)$/.exec(source)
  return match !== null && CONTROL_PRIMITIVES.has(match[1] as string)
}

/** The element's tag when it is a plain identifier: `Select`; `a.b` has none. */
const tagOf = (opening: Node): string | undefined => nameOf(child(opening, 'name'))

/** The root identifier of a JSX member tag (`Select.Root` is `Select`), or the plain tag. */
const tagRoot = (opening: Node): string | undefined => {
  let name = child(opening, 'name')
  while (name?.type === 'JSXMemberExpression') name = child(name, 'object')
  return nameOf(name)
}

const isFieldChain = (node: Node | undefined): boolean => {
  let current = node
  while (current?.type === 'MemberExpression') {
    const object = child(current, 'object')
    if (
      object?.type === 'MemberExpression' &&
      object['computed'] !== true &&
      nameOf(child(object, 'property')) === 'field' &&
      current['computed'] !== true
    ) {
      return true
    }
    current = object
  }
  return false
}

const expressionOf = (attr: Node): Node | undefined => {
  const value = child(attr, 'value')
  return value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : undefined
}

/** `filterSlot.custom` as a callee. */
const isCustomSlot = (callee: Node | undefined): boolean =>
  callee?.type === 'MemberExpression' &&
  callee['computed'] !== true &&
  nameOf(child(callee, 'object')) === 'filterSlot' &&
  nameOf(child(callee, 'property')) === 'custom'

const isFunction = (node: Node | undefined): node is Node =>
  node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression'

/** Depth-first walk of a subtree, skipping the `parent` back-reference. */
function someDescendant(root: Node, test: (node: Node) => boolean): boolean {
  const stack: Node[] = [root]
  while (stack.length > 0) {
    const node = stack.pop() as Node
    if (test(node)) return true
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue
      if (Array.isArray(value)) stack.push(...value.filter(isNode))
      else if (isNode(value)) stack.push(value)
    }
  }
  return false
}

type Frame =
  | { kind: 'home' }
  | { kind: 'element'; handles: string[]; bound: boolean; control: boolean }
  | { kind: 'custom'; fn: Node }

type Use = {
  node: Node
  subject: string
  /** The local name is a state-only root (`Input`, `Tabs`): it reports only on state it reads. */
  stateOnly: boolean
  frames: Frame[]
  attributes: Node[]
  scope: Node[]
}

const outsideHome: AstForm = {
  id: 'outside-home',
  fix: 'Put the control in a home: FormField, FilterSet, ViewTabs or ControlHome around it, or filterSlot.custom(handle, label, render) over a field handle',
  next: 'A panel-local value takes <ControlHome home="..."> with externalField; a counted line waiver names why no home fits',
  fixture: 'control-home/outside-home.tsx',
  detect: ({ report }): Visitor => {
    /** Local names bound to a control primitive. */
    const controls = new Set<string>()
    const stateOnlyLocals = new Set<string>()
    /** Names assigned a `.field.<name>` chain anywhere in the file. */
    const hoisted = new Set<string>()
    /** Render functions handed to `filterSlot.custom`, and the functions that keep state. */
    const customRenders = new Set<Node>()
    const stateful = new Set<Node>()
    /** Names bound by `const [x, set] = useState(...)` or `useReducer` anywhere in the file. */
    const stateNames = new Map<Node, Set<string>>()
    const functions: Node[] = []
    const frames: Frame[] = []
    const uses: Use[] = []

    /** A control whose attributes read file-level state keeps its value outside any handle. */
    const readsState = (use: Use): boolean =>
      use.attributes.some((attr) =>
        someDescendant(
          attr,
          (node) =>
            node.type === 'Identifier' &&
            use.scope.some((fn) => stateNames.get(fn)?.has(nameOf(node) ?? '') === true),
        ),
      )

    const homed = (use: Use): boolean =>
      use.frames.some((frame) => {
        if (frame.kind === 'home') return true
        if (frame.kind === 'custom') return !stateful.has(frame.fn) && !readsState(use)
        return frame.bound || frame.handles.some((name) => hoisted.has(name))
      })

    const enterFunction = (node: Node): void => {
      functions.push(node)
      if (customRenders.has(node)) frames.push({ kind: 'custom', fn: node })
    }
    const exitFunction = (node: Node): void => {
      functions.pop()
      if (customRenders.has(node)) frames.pop()
    }

    return {
      ImportDeclaration(node) {
        if (!controlPrimitive(child(node, 'source')?.['value'])) return
        for (const specifier of children(node, 'specifiers')) {
          if (specifier.type === 'ImportNamespaceSpecifier') continue
          const imported = child(specifier, 'imported')
          const importedName = nameOf(imported) ?? (imported?.['value'] as string | undefined)
          if (specifier.type === 'ImportSpecifier' && !CONTROL_ROOTS.has(importedName ?? ''))
            continue
          const local = nameOf(child(specifier, 'local'))
          if (local === undefined) continue
          controls.add(local)
          if (STATE_ONLY_ROOTS.has(importedName ?? '')) stateOnlyLocals.add(local)
        }
      },
      VariableDeclarator(node) {
        const id = child(node, 'id')
        const init = child(node, 'init')
        const name = nameOf(id)
        if (name !== undefined && isFieldChain(init)) hoisted.add(name)
        if (
          id?.type === 'ArrayPattern' &&
          init?.type === 'CallExpression' &&
          STATE_HOOKS.has(nameOf(child(init, 'callee')) ?? '')
        ) {
          const owner = functions.at(-1)
          if (owner === undefined) return
          const names = stateNames.get(owner) ?? new Set<string>()
          stateNames.set(owner, names)
          for (const element of children(id, 'elements')) {
            const bound = nameOf(element)
            if (bound !== undefined) names.add(bound)
          }
        }
      },
      CallExpression(node) {
        const callee = child(node, 'callee')
        if (isCustomSlot(callee)) {
          for (const arg of children(node, 'arguments')) if (isFunction(arg)) customRenders.add(arg)
        } else if (STATE_HOOKS.has(nameOf(callee) ?? '')) {
          const owner = functions.at(-1)
          if (owner) stateful.add(owner)
        }
      },
      ArrowFunctionExpression: enterFunction,
      'ArrowFunctionExpression:exit': exitFunction,
      FunctionExpression: enterFunction,
      'FunctionExpression:exit': exitFunction,
      FunctionDeclaration: (node) => functions.push(node),
      'FunctionDeclaration:exit': () => functions.pop(),
      JSXElement(node) {
        const opening = child(node, 'openingElement')
        if (!opening) return
        const tag = tagOf(opening)
        let bound = false
        const handles: string[] = []
        for (const attr of children(opening, 'attributes')) {
          if (attr.type !== 'JSXAttribute') continue
          if (!HANDLE_ATTRIBUTES.has(nameOf(child(attr, 'name')) ?? '')) continue
          const expression = expressionOf(attr)
          if (isFieldChain(expression)) bound = true
          else if (expression?.type === 'Identifier') handles.push(expression['name'] as string)
        }
        const root = tagRoot(opening)
        const isControl = root !== undefined && controls.has(root)
        const inside = frames.some((frame) => frame.kind === 'element' && frame.control)
        frames.push(
          tag !== undefined && HOMES.has(tag)
            ? { kind: 'home' }
            : { kind: 'element', handles, bound, control: isControl },
        )
        // One control, one report: a part inside a reported control (`Radio` in `RadioGroup`) is not another.
        if (isControl && !inside) {
          uses.push({
            node: opening,
            subject: `<${root}>`,
            stateOnly: stateOnlyLocals.has(root),
            frames: [...frames],
            scope: [...functions],
            attributes: children(opening, 'attributes').filter((attr) =>
              VALUE_ATTRIBUTES.has(nameOf(child(attr, 'name')) ?? ''),
            ),
          })
        }
      },
      'JSXElement:exit'() {
        frames.pop()
      },
      'Program:exit'() {
        for (const use of uses) {
          if (use.stateOnly && !readsState(use)) continue
          if (!homed(use)) report(use.node, use.subject)
        }
      },
    }
  },
}

export const controlHomeRules = defineRules({
  'control-home': {
    family: 'structure',
    profiles: ['parts', 'app'],
    defect:
      'the highest-friction family, 21 waivers; one console filter existed in 3 UIs (self-guardrails, console)',
    forms: [outsideHome],
  },
})
