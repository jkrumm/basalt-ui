import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of `ChainView`: the legend, a node's blockers for a reader, and the zoom and focus
 * controls. Their own area, so a page that draws no chain (a `DataTable`, a `RowList`) ships none.
 */
export type ChainMessages = Record<
  | 'chain.blocks'
  | 'chain.done'
  | 'chain.zoomIn'
  | 'chain.zoomOut'
  | 'chain.fit'
  | 'chain.focusNone'
  | 'chain.showAll'
  | 'chain.controls',
  string
> &
  Record<'chain.zoomLevel', (f: Format, scale: number) => string> &
  Record<
    'chain.waitsOn' | 'chain.alsoWaitsOn' | 'chain.focus',
    (f: Format, names: string) => string
  >

export const chain = {
  'chain.blocks': 'Blocks',
  'chain.done': 'Done',
  'chain.waitsOn': (_f, names) => `Waits on ${names}`,
  'chain.alsoWaitsOn': (_f, names) => `Also waits on ${names}`,
  'chain.zoomIn': 'Zoom in',
  'chain.zoomOut': 'Zoom out',
  'chain.fit': 'Fit to width',
  'chain.zoomLevel': (f, scale) => f.number(scale, { style: 'percent' }),
  'chain.focus': (_f, name) => `Focus on ${name}`,
  'chain.focusNone': 'Point at a node to focus it',
  'chain.showAll': 'Show all',
  'chain.controls': 'Chain view',
} satisfies Partial<BasaltMessages>
