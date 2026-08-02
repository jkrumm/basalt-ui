/**
 * AgentChatSubpathDemoPage — the B1 release gate: proves `basalt-ui/agent-chat` is independently
 * consumable.
 *
 * CONSTRAINT (do not violate): this module's ENTIRE import graph from `basalt-ui` is
 * `basalt-ui/agent-chat` + `basalt-ui/agent` — nothing else. No `basalt-ui` root barrel, no
 * `BasaltProvider`, no `basalt-ui/dashboard`, no `basalt-ui/shell`. The playground app's own root
 * (`main.tsx`) still mounts `BasaltProvider` — that is unavoidable and fine, since the constraint is
 * on THIS file's imports, not on what the surrounding app happens to already have mounted. Adding a
 * root-barrel import here would silently destroy the one thing this page exists to prove: that
 * `ThreadTranscript` resolves and renders without dragging in the shell/dashboard/provider. If a
 * future edit needs something from the root barrel, it belongs on a different route.
 *
 * @example
 * <Route path="/agent-chat-subpath" component={AgentChatSubpathDemoPage} />
 */
import { Badge, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { ThreadTranscript } from 'basalt-ui/agent-chat'
import type { ChatMessage } from 'basalt-ui/agent'

// Canned, static transcript — no transport, no store, no live stream. The point of this page is
// the import graph, not the runtime behaviour (that is what /agent and /threads already cover).
const CANNED_MESSAGES: ChatMessage[] = [
  {
    id: 'subpath-msg-1',
    role: 'user',
    parts: [{ type: 'text', text: 'What does the `basalt-ui/agent-chat` subpath ship?' }],
    createdAt: Date.now() - 60_000,
  },
  {
    id: 'subpath-msg-2',
    role: 'assistant',
    parts: [
      {
        type: 'reasoning',
        text: 'The consumer is asking about the Mantine chrome layer over the headless agent primitives.',
      },
      {
        type: 'text',
        text:
          'It ships the Mantine-styled thread-chat chrome — `ThreadWorkspace`, `ThreadFeed`, ' +
          '`ThreadOutcomeCard`, `ThreadDetailPanel`, `Composer`, `ThreadTranscript`, and ' +
          '`threadPartRenderers` — over the headless `basalt-ui/agent` layer. This page (the one ' +
          'rendering this very transcript) imports only those two subpaths, nothing else from ' +
          '`basalt-ui`.',
      },
    ],
    createdAt: Date.now() - 45_000,
  },
  {
    id: 'subpath-msg-3',
    role: 'user',
    parts: [{ type: 'text', text: 'Does it need the shell or a provider to render?' }],
    createdAt: Date.now() - 20_000,
  },
  {
    id: 'subpath-msg-4',
    role: 'assistant',
    parts: [
      {
        type: 'tool',
        toolName: 'check_import_graph',
        input: { file: 'AgentChatSubpathDemoPage.tsx' },
        output: { basaltImports: ['basalt-ui/agent-chat', 'basalt-ui/agent'] },
      },
      {
        type: 'text',
        text: 'No — this transcript rendered with exactly those two subpaths imported from `basalt-ui`.',
      },
    ],
    createdAt: Date.now() - 5_000,
  },
]

export function AgentChatSubpathDemoPage() {
  return (
    <Stack gap="md" p="md">
      <div>
        <Group gap="xs" align="center">
          <Title order={3}>Agent chat — subpath only</Title>
          <Badge color="teal" variant="light">
            basalt-ui/agent-chat
          </Badge>
        </Group>
        <Text size="sm" c="dimmed" mt={4}>
          The B1 release gate: this page&apos;s only imports from `basalt-ui` are
          `basalt-ui/agent-chat` (for `ThreadTranscript`) and `basalt-ui/agent` (for the
          `ChatMessage` type). No root barrel, no `BasaltProvider` import, no shell, no dashboard.
        </Text>
      </div>

      <Paper p="sm">
        <ThreadTranscript messages={CANNED_MESSAGES} />
      </Paper>
    </Stack>
  )
}
