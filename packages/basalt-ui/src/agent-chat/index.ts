/**
 * basalt-ui/agent-chat — Mantine-styled thread-chat components over the headless `basalt-ui/agent`
 * layer, capped by the flagship `ThreadWorkspace` composite.
 *
 * This module is Mantine-coupled by design and lives under the root entry (unlike `basalt-ui/agent`,
 * which stays headless so it can be styled by any consumer).
 *
 * @example
 * import { ThreadWorkspace } from 'basalt-ui/agent-chat'
 * import { createThreadsStore, edenTransport, heuristicOutcome } from 'basalt-ui/agent'
 */

// ── ThreadWorkspace (flagship composite) ──────────────────────────────────────
export { ThreadWorkspace } from './thread-workspace'
export type { ThreadWorkspaceProps } from './thread-workspace'

// ── ThreadFeed ────────────────────────────────────────────────────────────────
export { ThreadFeed } from './thread-feed'
export type { ThreadFeedProps } from './thread-feed'

// ── ThreadOutcomeCard ─────────────────────────────────────────────────────────
export { ThreadOutcomeCard } from './thread-outcome-card'
export type { ThreadOutcomeCardProps } from './thread-outcome-card'

// ── ThreadDetailPanel ─────────────────────────────────────────────────────────
export { ThreadDetailPanel } from './thread-detail-panel'
export type { ThreadDetailPanelProps } from './thread-detail-panel'

// ── Composer ──────────────────────────────────────────────────────────────────
export { Composer } from './composer'
export type { ComposerProps } from './composer'

// ── threadPartRenderers + ThreadTranscript ────────────────────────────────────
export { threadPartRenderers, ThreadTranscript } from './thread-message'
export type { ThreadTranscriptProps } from './thread-message'
