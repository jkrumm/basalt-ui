/**
 * basalt-ui/ai: partView, the one safe renderer of a message's parts. Model text always renders as
 * untrusted markdown (the trust level is pinned); tool calls fold into a rail of six-state rows.
 * Needs the four peers of basalt-ui/content (react-markdown, remark-gfm, rehype-sanitize, remend);
 * the AI SDK packages are never imported, the part types are structural. The wire-to-ToolView
 * mapping stays internal: the concept's surface is three symbols.
 */

export { partView } from './part-view'
export type { MessagePart, PartViewOptions, ToolView } from './contract'
export { defineBlock, defineCatalog } from './catalog/define'
