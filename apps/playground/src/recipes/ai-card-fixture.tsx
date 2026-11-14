/**
 * The ai-card recipe (docs/v3/concepts/ai-mdx.md row 15, P7 extended) mounted as the playground
 * file exports it, over a `fetch` the page controls. `window.aiCard` opens the response, pushes
 * text deltas as the AI SDK's SSE protocol and ends it, so the layout test can hold the card in
 * `loading`, `streaming` and `settled` and measure it in each.
 */
import { createRoot } from 'react-dom/client'
import { AiCard } from './ai-card'

type Control = { open(): Promise<void>; push(text: string): void; end(): void }

const encoder = new TextEncoder()
let controller: ReadableStreamDefaultController<Uint8Array> | undefined
let respond: ((r: Response) => void) | undefined
let requested: () => void = () => {}
const asked = new Promise<void>((resolve) => (requested = resolve))

// Replaces `fetch` before the card mounts: `useCompletion` reads it when it sends.
window.fetch = (() =>
  new Promise<Response>((resolve) => {
    respond = resolve
    requested()
  })) as unknown as typeof fetch

const frame = (data: unknown): Uint8Array => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

const control: Control = {
  async open() {
    await asked
    const stream = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) })
    respond?.(new Response(stream, { headers: { 'content-type': 'text/event-stream' } }))
  },
  push: (delta) => controller?.enqueue(frame({ type: 'text-delta', id: 't', delta })),
  end() {
    controller?.enqueue(encoder.encode('data: [DONE]\n\n'))
    controller?.close()
  },
}

const host = document.getElementById('root')
if (!host) throw new Error('fixture host is missing #root')
document.body.classList.add('bg-background')
createRoot(host).render(
  <div className="w-full max-w-md p-4">
    <AiCard api="/summary" prompt="Summarise the week." />
  </div>,
)

;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
;(window as unknown as { aiCard: Control }).aiCard = control
