/**
 * `import-boundary` (guardrails section 4, row 8): the import routes an agent reaches first around
 * the owned entries. 2.x had these as one hand-copied ban that an `extends` silently replaced; here
 * each route is a form with its own fix token and fixture.
 *
 * Thirteen forms: eight package bans, the engine allowlist, direct `useReactTable` (an import, or a
 * re-export of it from a module; `export *` is not read, it names no hook) or a table engine
 * (`@tanstack/table-core`, AG Grid, react-data-grid, MUI X Data Grid), the un-ejected
 * `@/components/ui/*` path, `useChat()` without a `chat` option and persist libraries outside a
 * `StorageLike` adapter. The repo-only rows (layer table, single `host.tsx` importer) are not
 * here: a form carries no profile of its own and this rule ships at `parts` and `app`.
 *
 * The `ui-path` form reads `@/`, `~/`, `#/`, `src/` and relative `components/ui/<name>` paths; an ejected name
 * stays legal however it is spelled. The `radix` form leaves `@radix-ui/react-icons` alone: it is
 * an icon set, and an icon prop takes the icon library's own component; it reads every `@mantine/*`
 * package (the stack 2.x shipped on) but `@mantine/hooks`, a hooks set with no UI whose storage
 * hooks `persist-storage` reads. The `visx`, `streamdown`
 * and `persist-storage` forms list the rival packages in the table below.
 *
 * Every package list is a DENYLIST, not a closed set: it names the rivals an agent reaches for first
 * in each category (headless primitives, form widgets, chart libraries, data and router libraries,
 * persistence, table engines, markdown renderers, realtime transports); an unlisted package in
 * the same category passes until it is added to its form.
 *
 * Option: `{ ejected?: string[] }`, the paths of `manifest.ejected`. An entry may be a
 * `@/components/ui/<name>` specifier or a file path under `components/ui/`. An ejected file is the
 * primitive's owned copy, so its own `@base-ui` import is the one thing it exists to hold.
 */
import type { Node, RuleContext, Visitor } from '../../factory'
import { mergeVisitors } from '../../factory'
import type { AstForm, RuleEntry } from '../../rule-table'
import { defineRules } from '../../rule-table'

export const OPTIONS_SCHEMA = [
  {
    type: 'object',
    properties: { ejected: { type: 'array', items: { type: 'string' } } },
    additionalProperties: false,
  },
] as const

/** Exact `@tanstack/charts` subpaths a consumer may import: 17 modules plus two families. */
export const ENGINE_SUBPATHS: ReadonlySet<string> = new Set([
  'line',
  'area',
  'area-x',
  'bar',
  'rect',
  'rule',
  'dot',
  'tick',
  'text',
  'vector',
  'link',
  'arrow',
  'difference',
  'stack',
  'mark/decorative',
  'd3/shape',
  'types',
])

/** Allowed families: `scales/*` and `transform/*`; the bare `transform` is not one. */
export const ENGINE_FAMILIES: readonly string[] = ['scales/', 'transform/']

const ENGINE = '@tanstack/charts'

/** Packages whose import is a persistence route of its own (any specifier). */
const STORAGE_PACKAGES: ReadonlySet<string> = new Set([
  'use-local-storage',
  'use-local-storage-state',
  '@uidotdev/usehooks',
  'redux-persist',
  'zustand-persist',
  '@nanostores/persistent',
  '@tanstack/query-sync-storage-persister',
  '@tanstack/query-async-storage-persister',
  'idb-keyval',
  'localforage',
])

/** Packages that are only a route through named specifiers. */
const STORAGE_NAMES: Readonly<Record<string, ReadonlySet<string>>> = {
  'zustand/middleware': new Set(['persist', 'createJSONStorage']),
  'jotai/utils': new Set(['atomWithStorage', 'createJSONStorage']),
  // A consumer's own Mantine storage hook is a persistence route; basalt itself depends on none.
  '@mantine/hooks': new Set(['useLocalStorage', 'useSessionStorage']),
  'usehooks-ts': new Set(['useLocalStorage', 'useSessionStorage']),
  'react-use': new Set(['useLocalStorage', 'useSessionStorage']),
}

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
  node?.type === 'Identifier' ? (node['name'] as string) : undefined

/** `pkg` itself or any subpath of it. */
const within = (source: string, pkg: string): boolean =>
  source === pkg || source.startsWith(`${pkg}/`)

/** A listed package, or `name*` for a family (`victory-*`): the package itself, a subpath or a sibling. */
const listed = (source: string, entry: string): boolean =>
  entry.endsWith('*') ? source.startsWith(entry.slice(0, -1)) : within(source, entry)

/**
 * Every module specifier in a file: static imports, re-exports, `import()` and `require()` with a
 * literal. `onSource` gets the declaration or call node so a form can read its specifiers.
 */
function sourceVisitor(onSource: (node: Node, source: string) => void): Visitor {
  const fromSource = (node: Node): void => {
    const source = stringValue(child(node, 'source'))
    if (source !== undefined) onSource(node, source)
  }
  return {
    ImportDeclaration: fromSource,
    ExportAllDeclaration: fromSource,
    ExportNamedDeclaration: fromSource,
    ImportExpression(node) {
      const source = stringValue(child(node, 'source'))
      if (source !== undefined) onSource(node, source)
    },
    CallExpression(node) {
      if (nameOf(child(node, 'callee')) !== 'require') return
      const source = stringValue(children(node, 'arguments')[0])
      if (source !== undefined) onSource(node, source)
    },
  }
}

type HostContext = RuleContext & { readonly filename?: string; readonly physicalFilename?: string }

const ejectedPaths = (options: readonly unknown[]): string[] => {
  const [first] = options
  const list = (first as { ejected?: unknown } | undefined)?.ejected
  return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : []
}

/** Whether the linted file is one of the `manifest.ejected` paths (a file entry, not a specifier). */
const isEjectedFile = (context: RuleContext): boolean => {
  const host = context as HostContext
  const file = (host.physicalFilename ?? host.filename ?? '').replaceAll('\\', '/')
  return ejectedPaths(context.options).some((path) => {
    const entry = path.replaceAll('\\', '/').replace(/^\.\//, '')
    return /\.[cm]?[jt]sx?$/.test(entry) && (file === entry || file.endsWith(`/${entry}`))
  })
}

/**
 * A package ban. Each list is a DENYLIST of the rival packages an agent reaches for first, not a
 * closed set: an unlisted package in the same category passes. The categories are headless
 * primitives, form widgets, chart libraries, data and router libraries, persistence, table
 * engines, markdown renderers and realtime transports. A new rival is a line in its form.
 */
const packageForm = (
  id: string,
  packages: readonly string[],
  fix: string,
  next: string,
  {
    allowInEjected = false,
    except = [],
  }: { allowInEjected?: boolean; except?: readonly string[] } = {},
): AstForm => ({
  id,
  detect: ({ context, report }) => {
    if (allowInEjected && isEjectedFile(context)) return {}
    return sourceVisitor((node, source) => {
      if (except.some((pkg) => listed(source, pkg))) return
      if (packages.some((pkg) => listed(source, pkg))) report(node, source)
    })
  },
  fix,
  next,
  fixture: `import-bypass/${id}.tsx`,
})

const isAllowedEngineSubpath = (subpath: string): boolean => {
  if (subpath.split('/').some((part) => part === '' || part === '.' || part === '..')) return false
  return (
    ENGINE_SUBPATHS.has(subpath) ||
    ENGINE_FAMILIES.some((prefix) => subpath.startsWith(prefix) && subpath.length > prefix.length)
  )
}

const engineOutsideList: AstForm = {
  id: 'engine-subpath',
  detect: ({ report }) =>
    sourceVisitor((node, source) => {
      if (!within(source, ENGINE)) return
      if (source !== ENGINE && isAllowedEngineSubpath(source.slice(ENGINE.length + 1))) return
      report(node, source)
    }),
  fix: 'Import a chart kind from basalt-ui/charts, or a mark from the 19 allowed engine subpaths',
  next: 'Compose the mark through CartesianChart marks',
  fixture: 'import-bypass/engine-subpath.tsx',
}

/**
 * Table engines a consumer builds a table on instead of DataTable: TanStack Table's framework-free
 * core (`createTable`), AG Grid, react-data-grid and MUI X Data Grid (`@mui/x-data-grid*`, its -pro
 * and -premium too). `@tanstack/react-table` itself stays legal for its column types
 * and helpers; its hook is read by name below.
 */
const TABLE_PACKAGES: readonly string[] = [
  '@tanstack/table-core',
  'ag-grid-react',
  'ag-grid-community',
  'ag-grid-enterprise',
  'react-data-grid',
  '@mui/x-data-grid*',
]

/**
 * `import { useReactTable }` from anywhere, `Table.useReactTable()` through a namespace, and any
 * import of a table engine in `TABLE_PACKAGES`.
 */
const directReactTable: AstForm = {
  id: 'react-table-hook',
  detect: ({ report }) =>
    mergeVisitors([
      sourceVisitor((node, source) => {
        if (TABLE_PACKAGES.some((pkg) => listed(source, pkg))) report(node, source)
      }),
      reactTableHook(report),
    ]),
  fix: 'Render the table with DataTable from basalt-ui/table',
  next: 'A static table is ui/table',
  fixture: 'import-bypass/react-table-hook.tsx',
}

function reactTableHook(report: (node: Node, subject: string) => void): Visitor {
  return {
    ImportSpecifier(node) {
      if (nameOf(child(node, 'imported')) === 'useReactTable') report(node, 'useReactTable')
    },
    // A re-export from a module reads the hook; `export { useReactTable }` of a local is not one.
    ExportNamedDeclaration(node) {
      if (stringValue(child(node, 'source')) === undefined) return
      for (const specifier of children(node, 'specifiers')) {
        if (nameOf(child(specifier, 'local')) === 'useReactTable')
          report(specifier, 'useReactTable')
      }
    },
    CallExpression(node) {
      const callee = child(node, 'callee')
      if (callee?.type !== 'MemberExpression' || callee['computed'] === true) return
      if (nameOf(child(callee, 'property')) === 'useReactTable') report(node, 'useReactTable()')
    },
  }
}

const UI_PREFIX = 'components/ui/'

/** `@/components/ui/button` and `src/components/ui/button.tsx` both name `button`. */
const uiName = (path: string): string => {
  const at = path.lastIndexOf(UI_PREFIX)
  const rest = at === -1 ? path : path.slice(at + UI_PREFIX.length)
  return rest.replace(/\.[cm]?[jt]sx?$/, '').replace(/\/index$/, '')
}

/** The shadcn alias (`@/`, `~/`, `#/`), a `src/` rooted path or a relative path into `components/ui`, not a package's own. */
const isUiPath = (source: string): boolean =>
  /^(?:[@~#]\/|src\/|(?:\.{1,2}\/)+(?:[^/]+\/)*?)components\/ui(?:\/|$)/.test(source)

const ejectedNames = (options: readonly unknown[]): Set<string> => {
  const [first] = options
  const list = (first as { ejected?: unknown } | undefined)?.ejected
  return new Set(Array.isArray(list) ? list.filter((p) => typeof p === 'string').map(uiName) : [])
}

const uiPath: AstForm = {
  id: 'ui-path',
  detect: ({ context, report }) => {
    const ejected = ejectedNames(context.options)
    return sourceVisitor((node, source) => {
      if (!isUiPath(source)) return
      if (ejected.has(uiName(source))) return
      report(node, source)
    })
  },
  fix: 'Import the primitive from basalt-ui/ui/<name>; only an ejected copy has a local path',
  next: 'Eject the primitive with basalt-ui eject, then import the copy',
  fixture: 'import-bypass/ui-path.tsx',
}

/** A props list that proves `chat` (a `chat` key or a spread, which may carry it). */
const carriesChat = (object: Node): boolean =>
  children(object, 'properties').some((property) => {
    if (property.type === 'SpreadElement') return true
    const key = child(property, 'key')
    return property['computed'] !== true && (nameOf(key) ?? stringValue(key)) === 'chat'
  })

/**
 * `useChat()` or `x.useChat({ ...})` without a `chat` option (`unlessCallHas: 'chat'`). The hook is
 * also read under an import alias (`import { useChat as useLegacyChat } from 'ai/react'`), and an
 * identifier argument is resolved when it is a same-file `const` object literal; any other
 * opaque argument (a parameter, a call, an import) may carry `chat` and passes.
 */
const useChatWithoutChat: AstForm = {
  id: 'use-chat-chat',
  detect: ({ report }) => {
    const aliases = new Set<string>(['useChat'])
    const objects = new Map<string, Node>()
    const calls: Node[] = []
    return {
      ImportSpecifier(node) {
        if (nameOf(child(node, 'imported')) !== 'useChat') return
        const local = nameOf(child(node, 'local'))
        if (local !== undefined) aliases.add(local)
      },
      VariableDeclarator(node) {
        const id = nameOf(child(node, 'id'))
        const init = child(node, 'init')
        if (id !== undefined && init?.type === 'ObjectExpression') objects.set(id, init)
      },
      CallExpression(node) {
        calls.push(node)
      },
      'Program:exit'() {
        for (const node of calls) {
          const callee = child(node, 'callee')
          const member = callee?.type === 'MemberExpression' && callee['computed'] !== true
          const name = member ? nameOf(child(callee, 'property')) : nameOf(callee)
          if (name === undefined || !(member ? name === 'useChat' : aliases.has(name))) continue
          const [first] = children(node, 'arguments')
          if (first === undefined) {
            report(node, 'useChat()')
            continue
          }
          const options = first.type === 'Identifier' ? objects.get(first['name'] as string) : first
          if (options?.type !== 'ObjectExpression') continue
          if (!carriesChat(options)) report(node, 'useChat()')
        }
      },
    }
  },
  fix: 'Create the Chat outside the hook and pass it: useChat({ chat })',
  next: 'Render the messages with partView from basalt-ui/ai',
  fixture: 'import-bypass/use-chat-chat.tsx',
}

/**
 * A persistence route outside an adapter. A file that mentions `StorageLike` (imports it, names
 * it in a type or declares it) is the adapter, so it is read at `Program:exit` once the whole
 * file has been seen.
 */
const persistRoute: AstForm = {
  id: 'persist-storage',
  detect: ({ report }) => {
    const found: { node: Node; subject: string }[] = []
    let adapter = false
    return {
      ...sourceVisitor((node, source) => {
        if (STORAGE_PACKAGES.has(source) || [...STORAGE_PACKAGES].some((p) => within(source, p))) {
          found.push({ node, subject: source })
          return
        }
        const names = STORAGE_NAMES[source]
        if (!names) return
        const specifiers = children(node, 'specifiers')
        // A namespace import, `export *`, `import()` and `require()` cannot be narrowed to a name.
        const namespace =
          (node.type !== 'ImportDeclaration' && node.type !== 'ExportNamedDeclaration') ||
          specifiers.some((s) => s.type === 'ImportNamespaceSpecifier')
        const hit = specifiers.find(
          (s) =>
            s.type !== 'ImportNamespaceSpecifier' &&
            names.has(nameOf(child(s, 'imported')) ?? nameOf(child(s, 'local')) ?? ''),
        )
        if (namespace || hit) found.push({ node, subject: source })
      }),
      Identifier(node) {
        if (node['name'] === 'StorageLike') adapter = true
      },
      'Program:exit'() {
        if (adapter) return
        for (const { node, subject } of found) report(node, subject)
      },
    }
  },
  fix: 'Use persisted(key) from basalt-ui, or implement the backend as a StorageLike adapter',
  next: 'persisted.setStorage selects the app-wide backend',
  fixture: 'import-bypass/persist-storage.tsx',
}

const FORMS: readonly AstForm[] = [
  packageForm(
    'base-ui',
    [
      '@base-ui/react',
      '@base-ui-components/react',
      'react-day-picker',
      '@tanstack/react-virtual',
      '@tanstack/virtual-core',
      'react-virtuoso',
      'react-window',
      'react-datepicker',
    ],
    'Import the owned primitive from basalt-ui/ui/<name>: date-picker, virtual-list',
    'Eject the primitive with basalt-ui eject, then edit the copy',
    { allowInEjected: true },
  ),
  packageForm(
    'radix',
    [
      '@radix-ui',
      'radix-ui',
      'vaul',
      '@headlessui/react',
      '@floating-ui/react',
      '@floating-ui/react-dom',
      'react-aria-components',
      '@ark-ui',
      '@mantine',
      '@chakra-ui',
      '@mui/material',
      '@mui/joy',
      'react-aria',
    ],
    'Import the owned primitive from basalt-ui/ui/<name>: popover, menu, tooltip, sheet; Radix, Mantine, Chakra, MUI, React Aria, Ark and Floating UI are not in the stack',
    'Eject the primitive with basalt-ui eject, then edit the copy',
    { except: ['@radix-ui/react-icons', '@mantine/hooks'] },
  ),
  packageForm(
    'cmdk',
    ['cmdk', 'react-cmdk', 'kbar'],
    'Use CommandPalette from basalt-ui/shell (+0.9 KB against cmdk +16.0 KB and 24 packages)',
    'defineCommands lists a command in the palette',
  ),
  packageForm(
    'sonner',
    ['sonner', 'react-hot-toast', 'react-toastify', 'notistack'],
    'Call notify() and mount ToastHost from basalt-ui/page',
    'ui/toast for a toast with its own placement',
  ),
  packageForm(
    'streamdown',
    [
      'streamdown',
      'react-markdown',
      'markdown-to-jsx',
      'marked-react',
      'marked',
      'markdown-it',
      'showdown',
      'react-remark',
    ],
    'Render model text with Markdown contentTrust from basalt-ui/content',
    'partView for a streamed part',
  ),
  packageForm(
    'tailwind-merge',
    ['tailwind-merge', 'tailwind-variants'],
    'Compose classes with cn() from basalt-ui; twMerge drops text-red-500 beside text-display',
    'A cva variant per state',
  ),
  packageForm(
    'visx',
    [
      '@visx',
      'recharts',
      'react-apexcharts',
      '@mui/x-charts',
      '@tremor/react',
      '@nivo',
      'chart.js',
      'react-chartjs-2',
      'echarts',
      'echarts-for-react',
      'highcharts',
      'highcharts-react-official',
      'victory',
      'victory-*',
      '@observablehq/plot',
    ],
    'Use a chart kind from basalt-ui/charts, or CartesianChart marks',
    'Compose the mark from the allowed engine subpaths',
  ),
  packageForm(
    'data-library',
    [
      'swr',
      '@apollo/client',
      'socket.io-client',
      '@microsoft/fetch-event-source',
      'react-use-websocket',
      'nuqs',
      'react-router',
      'react-router-dom',
      'pusher-js',
      'ably',
      'react-query',
      'urql',
      'wouter',
      'use-query-params',
    ],
    'Fetch through the query client and liveQuery from basalt-ui/data, open a stream with createChannel, and keep routes and URL state in basalt-ui/router (a field; TanStack Router, never react-router)',
    'createChannel takes the Transport seam, so a socket is one adapter',
  ),
  engineOutsideList,
  directReactTable,
  uiPath,
  useChatWithoutChat,
  persistRoute,
]

export const IMPORT_BOUNDARY: RuleEntry = {
  family: 'import',
  profiles: ['parts', 'app'],
  defect:
    'Argo copy-pasted ban silently replaced by extends; cmdk +16.0 KB and 24 packages; streamdown +152.2 vs +56.8 KB; tailwind-merge drops text-red-500 beside text-display',
  forms: FORMS,
  schema: OPTIONS_SCHEMA,
}

export const importBoundaryRules = defineRules({ 'import-boundary': IMPORT_BOUNDARY })
