/**
 * The subpath allotment `basalt()` gates on: per runtime subpath its peers, its lazy peers and the other
 * subpaths it imports at runtime (`.` for every layer above core, plus the declared L4 edges), the L4
 * composite directories and every allotted primitive with its own extra peers.
 *
 * Hand-authored data, pinned by `allotment.test.ts` against `src/surfaces.ts`, the peer table of
 * `scripts/surface-gates.ts`, `src/ui/*.tsx` and the package subpaths (`docs/v3/CONTRACT.md` renders the
 * same facts); a subpath, a peer or a primitive added in one place and not here fails there.
 */
export type SubpathAllotment = {
  /** Peers every import of the subpath needs installed. */
  peers: string[]
  /** Peers loaded only on first use (`import()`); not gated. */
  lazy: string[]
  /** Other subpaths it imports at runtime: `.` for every layer above core, plus declared edges. */
  reaches: string[]
}

export type Allotment = {
  /** Runtime subpath (`.`, `ui`, `router`, …) -> its allotment. */
  subpaths: Record<string, SubpathAllotment>
  /** The L4 composite subpaths: `optimizeDeps.exclude` targets once an app ejects. */
  composites: string[]
  /** Every allotted primitive (`basalt-ui/ui/<name>`), shipped or not yet. */
  primitives: string[]
  /** A primitive's own extra peers, beyond the `ui` row. */
  primitivePeers: Record<string, string[]>
}

export const ALLOTMENT: Allotment = {
  subpaths: {
    '.': {
      peers: ['react'],
      lazy: [],
      reaches: [],
    },
    ui: {
      peers: ['@base-ui/react', 'react-dom'],
      lazy: [],
      reaches: ['.'],
    },
    router: {
      peers: ['@tanstack/react-router'],
      lazy: [],
      reaches: ['.'],
    },
    data: {
      peers: ['@tanstack/react-query'],
      lazy: [],
      reaches: ['.'],
    },
    form: {
      peers: ['@tanstack/react-form', '@base-ui/react'],
      lazy: [],
      reaches: ['.'],
    },
    motion: {
      peers: ['motion'],
      lazy: [],
      reaches: ['.'],
    },
    page: {
      peers: ['react', '@base-ui/react'],
      lazy: [],
      reaches: ['.'],
    },
    shell: {
      peers: ['@base-ui/react', '@tanstack/react-router', '@tanstack/react-hotkeys'],
      lazy: [],
      reaches: ['.', 'page', 'router'],
    },
    cards: {
      peers: ['react', '@base-ui/react'],
      lazy: [],
      reaches: ['.'],
    },
    controls: {
      peers: ['react', '@base-ui/react'],
      lazy: [],
      reaches: ['.'],
    },
    table: {
      peers: ['@tanstack/react-table', '@base-ui/react'],
      lazy: [],
      reaches: ['.', 'controls'],
    },
    charts: {
      peers: ['@tanstack/charts', 'd3-scale'],
      lazy: [],
      reaches: ['.'],
    },
    content: {
      peers: ['react-markdown', 'remark-gfm', 'rehype-sanitize', 'remend', '@base-ui/react'],
      lazy: ['shiki', 'pele'],
      reaches: ['.'],
    },
    ai: {
      peers: ['react-markdown', 'remark-gfm', 'rehype-sanitize', 'remend', '@base-ui/react'],
      lazy: [],
      reaches: ['.', 'content'],
    },
  },
  composites: ['page', 'shell', 'cards', 'controls', 'table', 'charts', 'content', 'ai'],
  primitives: [
    'button',
    'input',
    'textarea',
    'number-field',
    'select',
    'combobox',
    'checkbox',
    'radio-group',
    'switch',
    'slider',
    'segmented',
    'field',
    'dialog',
    'sheet',
    'popover',
    'tooltip',
    'menu',
    'toast',
    'tabs',
    'accordion',
    'collapsible',
    'card',
    'table',
    'scroll-area',
    'separator',
    'skeleton',
    'badge',
    'status',
    'alert',
    'kbd',
    'progress',
    'meter',
    'toolbar',
    'num',
    'date-picker',
    'calendar',
    'resizable',
    'virtual-list',
    'sortable-list',
  ],
  primitivePeers: {
    calendar: ['react-day-picker'],
    'date-picker': ['react-day-picker'],
    resizable: ['react-resizable-panels'],
    'virtual-list': ['@tanstack/react-virtual'],
    'sortable-list': ['@atlaskit/pragmatic-drag-and-drop'],
  },
}
