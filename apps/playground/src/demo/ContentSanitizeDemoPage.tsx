/**
 * ContentSanitizeDemoPage — basalt-ui 1.12.0 playground gate demo 2: `Markdown`'s `sanitizeSchema`
 * extension.
 *
 * Renders ONE message carrying a custom `<pg-badge>` tag and a simulated `<script>` injection (see
 * `./rehype-playground-tags`), toggle-able so both halves of the security boundary are observable
 * side by side rather than just the happy one:
 *
 *  - extension OFF: both the badge AND the script are stripped — the demo's own custom tag is just
 *    as unprivileged as an attacker's, proving the baseline default-deny.
 *  - extension ON (`sanitizeSchema={{ tagNames: ['pg-badge'], attributes: { 'pg-badge': ['tone'] } }}`):
 *    the badge survives — but the script is STILL stripped, because an additions-only schema can
 *    only ADD `pg-badge`; there is no code path that lets it touch `script`.
 *
 * A live capture of the rendered DOM (via `MutationObserver`, below the message) makes both halves
 * PROVABLE rather than merely visible: no `<script>` element and no leaked JS text ever appear,
 * regardless of the toggle.
 */
import { Badge, Box, Group, Paper, Stack, Switch, Text, Title } from '@mantine/core'
import { Markdown } from 'basalt-ui/content'
import type { SanitizeSchemaExtension } from 'basalt-ui/content'
import { useEffect, useRef, useState } from 'react'
import { PLAYGROUND_SANITIZE_DEMO_MARKDOWN, rehypePlaygroundTags } from './rehype-playground-tags'

// Styles the custom `<pg-badge>` element the rehype plugin injects — an unknown tag renders
// unstyled by default, so this makes "the tag survived" visually obvious. Colors are exclusively
// `var(--vx-*)` tokens, never a raw hex/rgb/hsl.
const PG_BADGE_STYLES = `
pg-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: var(--vx-radius-pill);
  background: var(--vx-accent-fill);
  color: var(--vx-on-accent);
  font-family: var(--basalt-font-mono);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
`

const EXTENSION: SanitizeSchemaExtension = {
  tagNames: ['pg-badge'],
  attributes: { 'pg-badge': ['tone'] },
}

const REHYPE_PLUGINS = [rehypePlaygroundTags]

export function ContentSanitizeDemoPage() {
  const [extensionEnabled, setExtensionEnabled] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const [capturedHtml, setCapturedHtml] = useState('')

  // Captures the REAL rendered DOM rather than trusting what we asked for — Markdown lazy-loads
  // react-markdown/rehype-sanitize via React.lazy, so the tree can settle a render or two after
  // this effect first runs; a MutationObserver catches every subsequent change, not just the first.
  useEffect(() => {
    const node = containerRef.current
    if (node === null) return
    const capture = (): void => setCapturedHtml(node.innerHTML)
    capture()
    const observer = new MutationObserver(capture)
    observer.observe(node, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [extensionEnabled])

  const badgeSurvives = capturedHtml.includes('<pg-badge')
  const scriptStripped = !capturedHtml.toLowerCase().includes('<script')

  return (
    <Stack gap="md" p="md">
      <style>{PG_BADGE_STYLES}</style>

      <div>
        <Title order={3}>Sanitize schema extension</Title>
        <Text size="sm" c="dimmed" mt={4}>
          A <code>sanitizeSchema</code> extension widens what <code>Markdown</code> allows through —
          additions only. Toggle it and watch the custom tag appear/disappear; the simulated{' '}
          <code>&lt;script&gt;</code> stays stripped either way.
        </Text>
      </div>

      <Group gap="sm">
        <Switch
          label="sanitizeSchema extension enabled"
          checked={extensionEnabled}
          onChange={(event) => setExtensionEnabled(event.currentTarget.checked)}
        />
        <Badge color={badgeSurvives ? 'green' : 'gray'} variant="light">
          pg-badge {badgeSurvives ? 'rendered' : 'stripped'}
        </Badge>
        <Badge color={scriptStripped ? 'green' : 'red'} variant="light">
          script {scriptStripped ? 'stripped' : 'PRESENT — sanitizer failure'}
        </Badge>
      </Group>

      <Paper p="sm">
        <Box ref={containerRef}>
          <Markdown
            contentTrust="untrusted"
            density="chat"
            rehypePlugins={REHYPE_PLUGINS}
            {...(extensionEnabled ? { sanitizeSchema: EXTENSION } : {})}
          >
            {PLAYGROUND_SANITIZE_DEMO_MARKDOWN}
          </Markdown>
        </Box>
      </Paper>

      <Paper p="sm">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
          Rendered DOM (captured live) — proves the script never lands, not just that it isn't
          visible
        </Text>
        <Text size="xs" ff="monospace" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {capturedHtml || '(rendering…)'}
        </Text>
      </Paper>
    </Stack>
  )
}
