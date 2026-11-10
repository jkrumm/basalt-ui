import { Button, Stack } from '@mantine/core'
import { Section } from 'basalt-ui'
import { Markdown } from 'basalt-ui/content'
import { useEffect, useRef, useState } from 'react'

const fence = (info: string, code: string) => `\`\`\`${info}\n${code}\n\`\`\``

// A GFM table, a fence, a `javascript:` link (rendered without a destination) and an off-origin
// image (alt text only): the untrusted policy shown visually.
const PIPELINE_MARKDOWN = `| Stage | Latency |
| --- | --- |
| Ingest | 40ms |
| Serve | 8ms |

${fence('ts', 'export const loadStage = (name: string) => db.query(name)')}

See the [runbook](/docs/runbook) or a [bad link](javascript:alert(1)).

![Untrusted image](https://evil.example.com/tracker.png)
`

// A bold word streams in unclosed; the repair keeps the tail renderable until it closes.
const STREAM_FIXTURE = `The renderer repairs **unclosed formatting** as each chunk arrives.

${fence('ts', 'export const retry = (n: number) => n - 1')}

The stream finished cleanly.
`

function StreamingDemo() {
  const [text, setText] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopStream = () => {
    if (timerRef.current === null) return
    clearInterval(timerRef.current)
    timerRef.current = null
  }

  const replay = () => {
    stopStream()
    setText('')
    let cursor = 0
    timerRef.current = setInterval(() => {
      cursor += 8
      setText(STREAM_FIXTURE.slice(0, cursor))
      if (cursor >= STREAM_FIXTURE.length) stopStream()
    }, 40)
  }

  useEffect(() => stopStream, [])

  return (
    <>
      <Button onClick={replay} variant="default" size="xs">
        Replay stream
      </Button>
      <Markdown contentTrust="untrusted" streaming>
        {text}
      </Markdown>
    </>
  )
}

export function ContentSection() {
  return (
    <Stack gap="md">
      <Section title="Markdown" subtitle="Untrusted document and a streamed reply.">
        <Stack gap="md">
          <Markdown contentTrust="untrusted">{PIPELINE_MARKDOWN}</Markdown>
          <StreamingDemo />
        </Stack>
      </Section>
    </Stack>
  )
}
