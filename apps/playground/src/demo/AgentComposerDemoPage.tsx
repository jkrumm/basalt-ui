/**
 * AgentComposerDemoPage — basalt-ui 1.12.0 playground gate demo 3: the full `Composer` prop set.
 *
 * Exercises, all on one composer instance:
 *  - `leftSection` — an opaque slot Composer never learns the meaning of, standing in for a real
 *    voice recorder: "Simulate voice input" streams a canned transcript into the composer over a
 *    few hundred ms via `ComposerHandle.insertText`, the write escape hatch obtained through
 *    `ref`. Place the caret mid-text (click into the textarea) before recording and watch each
 *    chunk land exactly there rather than at the end — then click away to unfocus the textarea and
 *    record again to see chunks append at the end instead, per `insertText`'s documented fallback.
 *  - `rightSection` — a real attach button wired to `attachments` / `onAttachmentsChange`.
 *  - `onPaste` — pasting an image (or any file) attaches it instead of dumping binary junk into the
 *    textarea.
 *  - `draftKey` — persists the unsent draft under `basalt:composer-draft:agent-composer-demo`. A
 *    REAL page reload (F5), not a client-side reset, restores it — that is the only way to prove
 *    this half; the event log below cannot simulate a reload.
 *  - `onSubmit` returning a `Promise` — the draft/attachments clear OPTIMISTICALLY the instant Send
 *    is clicked; a REJECTED promise restores exactly what was cleared. The "Fail the next send"
 *    switch arms exactly one simulated rejection so the restore is easy to trigger and watch.
 */
import {
  ActionIcon,
  Badge,
  CloseButton,
  FileButton,
  Group,
  List,
  Paper,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import type { ComposerAttachment, ComposerHandle, ComposerSubmit } from 'basalt-ui/agent-chat'
import { Composer } from 'basalt-ui/agent-chat'
import { VX } from 'basalt-ui/tokens'
import type { ClipboardEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { IconMic, IconPaperclip, IconSparkle } from './icons'

// ── Simulated voice input (a stand-in for a real speech-to-text recorder) ────────────────────────
// Streams a canned transcript into the composer word-by-word via `ComposerHandle.insertText` — the
// same shape a real recorder's `onTranscript` callback would drive (see Composer's own `@example`).

const TRANSCRIPT_CHUNKS = [
  'Remember ',
  'to ',
  'update ',
  'the ',
  'changelog ',
  'before ',
  'shipping ',
  '1.12.0. ',
]

const TRANSCRIPT_STEP_MS = 220

function VoiceRecordButton({ recording, onClick }: { recording: boolean; onClick: () => void }) {
  return (
    <ActionIcon
      variant={recording ? 'filled' : 'light'}
      color={recording ? 'red' : 'gray'}
      size={42}
      radius="md"
      // A real record button must not steal focus from wherever the caret was placed — a mousedown
      // on any button moves focus by default, which would make `insertText`'s selection-aware path
      // unreachable via mouse click before onClick even fires. Preventing it here is what makes the
      // "place the caret mid-text, then click record" demonstration honest.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={recording}
      aria-label={
        recording ? 'Recording — streaming transcript into the composer' : 'Simulate voice input'
      }
      title={
        recording ? 'Recording…' : 'Simulate voice input — streams a canned transcript to the caret'
      }
    >
      <IconMic />
    </ActionIcon>
  )
}

// ── Attachments ──────────────────────────────────────────────────────────────────
// `attachmentFromFile` mints an object URL per selection; the page below is the only owner of that
// storage and is responsible for revoking it. Composer only ever calls `onAttachmentsChange` for its
// own optimistic-clear-then-restore-on-rejection submit lifecycle (attachments are "owned by the
// caller" — Composer forwards them on submit and asks for a reset, it never renders its own remove
// affordance), so that handler must stay a plain passthrough: revoking there would hand back a
// restored attachment pointing at a dead URL. A URL is only genuinely unreachable at three points —
// a successful send (no restore is coming), an explicit removal via the close button below, or page
// unmount — and those are the only three places this file calls `URL.revokeObjectURL`.

function attachmentFromFile(file: File): ComposerAttachment {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mediaType: file.type.length > 0 ? file.type : 'application/octet-stream',
    size: file.size,
    url: URL.createObjectURL(file),
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgentComposerDemoPage() {
  const composerRef = useRef<ComposerHandle>(null)
  const [attachments, setAttachments] = useState<readonly ComposerAttachment[]>([])
  const [failNext, setFailNext] = useState(false)
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [log, setLog] = useState<string[]>([])

  // Guards the streaming loop below against inserting into an unmounted composer. Reset at effect
  // SETUP, not just declared `false` at init — StrictMode runs this effect's cleanup then a second
  // setup on the same fiber, and without the reset here the flag is left tripped from the phantom
  // cleanup, so the transcript-insertion loop bails immediately on every real recording attempt.
  const cancelledRef = useRef(false)
  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
    }
  }, [])

  // Object URLs this page has minted (attachment id → URL), so they can be revoked exactly once each
  // is genuinely unreachable — see the comment above `attachmentFromFile`.
  const ownedUrlsRef = useRef(new Map<string, string>())
  useEffect(() => {
    const ownedUrls = ownedUrlsRef.current
    return () => {
      for (const url of ownedUrls.values()) {
        URL.revokeObjectURL(url)
      }
      ownedUrls.clear()
    }
  }, [])

  const addFiles = useCallback((files: readonly File[]) => {
    if (files.length === 0) return
    const created = files.map(attachmentFromFile)
    for (const attachment of created) {
      ownedUrlsRef.current.set(attachment.id, attachment.url)
    }
    setAttachments((prev) => [...prev, ...created])
  }, [])

  // The one place a removal is unambiguously permanent — the close button below, not Composer's own
  // submit-clear machinery — so this is safe to revoke immediately.
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== id))
    const url = ownedUrlsRef.current.get(id)
    if (url !== undefined) {
      URL.revokeObjectURL(url)
      ownedUrlsRef.current.delete(id)
    }
  }, [])

  const handleRecord = useCallback(async () => {
    if (recording) return
    setRecording(true)
    for (const chunk of TRANSCRIPT_CHUNKS) {
      await sleep(TRANSCRIPT_STEP_MS)
      if (cancelledRef.current) return
      composerRef.current?.insertText(chunk)
    }
    setRecording(false)
    composerRef.current?.focus()
  }, [recording])

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const files = event.clipboardData.files
      if (files.length === 0) return
      event.preventDefault()
      addFiles(Array.from(files))
    },
    [addFiles],
  )

  const handleSubmit = useCallback(
    async ({ text, attachments: sent }: ComposerSubmit): Promise<void> => {
      const shouldFail = failNext
      setSending(true)
      setFailNext(false)
      await sleep(700)
      setSending(false)
      const attachmentNote = sent.length > 0 ? ` (+${sent.length} attachment(s))` : ''
      if (shouldFail) {
        setLog((prev) => [`✕ send rejected: "${text}"${attachmentNote}`, ...prev])
        throw new Error('Simulated send failure')
      }
      // A successful send never restores — the submitted attachments are genuinely gone, so this is
      // safe to revoke now (unlike the optimistic clear, which might still be undone by a rejection).
      for (const attachment of sent) {
        const url = ownedUrlsRef.current.get(attachment.id)
        if (url !== undefined) {
          URL.revokeObjectURL(url)
          ownedUrlsRef.current.delete(attachment.id)
        }
      }
      setLog((prev) => [`✓ sent: "${text}"${attachmentNote}`, ...prev])
    },
    [failNext],
  )

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Composer</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Left/right slots, attachments, paste-to-attach, an async <code>onSubmit</code> with
          optimistic-clear-then-restore-on-rejection, and a draft that survives a page reload (
          <code>draftKey="agent-composer-demo"</code>). Type something, reload the page (F5), and it
          comes back.
        </Text>
      </div>

      <Paper p="sm">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
          Try the caret behaviour
        </Text>
        <Text size="sm">
          Type a sentence, click into the middle of it to place the caret, then hit the mic — the
          transcript inserts word-by-word exactly where the caret sits, splitting whatever text was
          on either side. Click somewhere else first (or never focus the box) and record again: the
          chunks append at the end instead, per <code>ComposerHandle.insertText</code>'s documented
          fallback.
        </Text>
      </Paper>

      <Group gap="sm" align="center">
        <Switch
          label="Fail the next send"
          checked={failNext}
          onChange={(event) => setFailNext(event.currentTarget.checked)}
        />
        {sending && (
          <Badge color="blue" variant="light">
            sending…
          </Badge>
        )}
        {recording && (
          <Badge color="red" variant="light">
            recording…
          </Badge>
        )}
      </Group>

      {attachments.length > 0 && (
        <Group gap={6} wrap="wrap">
          {attachments.map((attachment) => (
            <Badge
              key={attachment.id}
              variant="outline"
              color="gray"
              rightSection={
                <CloseButton
                  size={14}
                  onClick={() => removeAttachment(attachment.id)}
                  aria-label={`Remove ${attachment.name}`}
                  title="Remove attachment"
                />
              }
            >
              {attachment.name} · {formatSize(attachment.size)}
            </Badge>
          ))}
        </Group>
      )}

      <Paper p="sm">
        <Composer
          ref={composerRef}
          draftKey="agent-composer-demo"
          placeholder="Type a message, paste a file, or attach one — then reload the page…"
          leftSection={
            <VoiceRecordButton recording={recording} onClick={() => void handleRecord()} />
          }
          rightSection={
            <FileButton onChange={(files) => addFiles(files)} multiple>
              {(props) => (
                <ActionIcon
                  {...props}
                  variant="light"
                  size={42}
                  radius="md"
                  aria-label="Attach files"
                >
                  <IconPaperclip />
                </ActionIcon>
              )}
            </FileButton>
          }
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onPaste={handlePaste}
          onSubmit={handleSubmit}
        />
      </Paper>

      <Paper p="sm">
        <Group gap={6} mb="xs">
          <IconSparkle />
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            Send log
          </Text>
        </Group>
        {log.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nothing sent yet.
          </Text>
        ) : (
          <List size="sm" spacing={4}>
            {log.map((line, index) => (
              <List.Item key={`${index}-${line}`}>
                <Text
                  size="xs"
                  ff="monospace"
                  c={line.startsWith('✕') ? VX.badSolid : VX.goodSolid}
                >
                  {line}
                </Text>
              </List.Item>
            ))}
          </List>
        )}
      </Paper>
    </Stack>
  )
}
