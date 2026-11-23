import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of `FlowCanvas` and `FlowChecklist`: the tools, the zoom controls, the issue counts and
 * the checklist. Their own area, so a page that draws no canvas ships none.
 */
export type FlowMessages = Record<
  | 'flow.tools'
  | 'flow.pointer'
  | 'flow.hand'
  | 'flow.zoomIn'
  | 'flow.zoomOut'
  | 'flow.fit'
  | 'flow.zoom'
  | 'flow.allSet',
  string
> &
  Record<'flow.zoomLevel', (f: Format, scale: number) => string> &
  Record<'flow.issues' | 'flow.toFix', (f: Format, count: number) => string> &
  Record<'flow.rowIssue' | 'flow.groupMenu', (f: Format, text: string) => string>

export const flow = {
  'flow.tools': 'Canvas tools',
  'flow.pointer': 'Pointer',
  'flow.hand': 'Hand',
  'flow.zoomIn': 'Zoom in',
  'flow.zoomOut': 'Zoom out',
  'flow.fit': 'Zoom to fit',
  'flow.zoom': 'Zoom',
  'flow.zoomLevel': (f, scale) => f.number(scale, { style: 'percent' }),
  'flow.issues': (_f, count) => (count === 1 ? '1 issue' : `${count} issues`),
  'flow.rowIssue': (_f, text) => `Issue: ${text}`,
  'flow.groupMenu': (_f, name) => `Actions for ${name}`,
  'flow.toFix': (_f, count) =>
    count === 1 ? 'Fix this before it runs' : `Fix these ${count} before it runs`,
  'flow.allSet': 'Everything it needs is in place',
} satisfies Partial<BasaltMessages>
