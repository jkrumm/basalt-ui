/**
 * basalt-ui/ai: partView, the one safe renderer of a message's parts, and the chat parts around it.
 * Model text always renders as untrusted markdown (the trust level is pinned); reasoning and tool
 * calls fold into one `ReasoningTrace`. `Composer` writes a message (with mentions and files),
 * `ModelPicker` chooses who answers, `Message` and `MessageActions` draw a turn. No runtime: the
 * app owns its chat object and passes its status and stop function in.
 * Needs the four peers of basalt-ui/content (react-markdown, remark-gfm, rehype-sanitize, remend);
 * the AI SDK packages are never imported, the part types are structural. The wire-to-ToolView
 * mapping stays internal.
 */

export { partView } from './part-view'
export type { MessagePart, PartViewOptions, ToolView } from './contract'
export { defineBlock, defineCatalog } from './catalog/define'
export { Composer } from './composer'
export type { ComposerMessage, ComposerProps, ComposerStatus, Mention } from './composer'
export { ModelPicker } from './model-picker'
export type { ModelPickerProps } from './model-picker'
export { ReasoningTrace } from './reasoning-trace'
export type { TraceStep } from './reasoning-trace'
export { Message, MessageActions } from './message'
export type { MessageAction } from './message'
