/**
 * One fixture for both candidates: a 390-wide chat page, a seeded history with one image that has
 * not loaded yet, and one assistant message that grows for 90 s as streamed markdown (heading,
 * paragraph, list, paragraph, code, repeat). The candidate only supplies `Scroller` and `Item`.
 * Synthetic text only. The harness drives it through `window.__fixture`.
 */
import { useEffect, useState } from 'react'
import type { ComponentType, JSX, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

type Kind = 'h' | 'p' | 'ul' | 'pre'
type Block = { kind: Kind; words: string[]; quota: number }

const WORDS = (
  'ledger signal harbor quartz meadow relay anchor copper lantern vector orchard timber ' +
  'margin cipher ember glacier pillar thread canvas summit fabric beacon cobalt drift ' +
  'garnet hollow ivory juniper kernel lattice mosaic nimbus onyx prism quill raven spruce'
).split(' ')

const PLAN: readonly { kind: Kind; quota: number }[] = [
  { kind: 'h', quota: 6 },
  { kind: 'p', quota: 55 },
  { kind: 'ul', quota: 36 },
  { kind: 'p', quota: 45 },
  { kind: 'pre', quota: 30 },
]

const STREAM_MS = 90_000
const TICK_MS = 100

let seed = 7
const rand = (): number => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const word = (): string => WORDS[Math.floor(rand() * WORDS.length)] ?? 'ledger'
const sentence = (n: number): string => Array.from({ length: n }, word).join(' ')

type Message = { id: string; role: 'user' | 'assistant'; text?: string; image?: boolean }

const HISTORY: readonly Message[] = [
  { id: 'm0', role: 'user', text: sentence(14) },
  { id: 'm1', role: 'assistant', text: `${sentence(40)}.\n\n${sentence(34)}.` },
  { id: 'm2', role: 'user', text: sentence(10) },
  { id: 'm3', role: 'assistant', text: sentence(28), image: true },
  { id: 'm4', role: 'user', text: sentence(18) },
]

declare global {
  interface Window {
    __fixture: {
      start: () => void
      loadImage: () => void
      reflowAt: number | null
      mark: () => void
      peak: () => number
    }
  }
}

function gapPx(): number {
  const el = document.querySelector('[data-scroller]')
  return el ? el.scrollHeight - el.scrollTop - el.clientHeight : Number.NaN
}

function renderBlock(block: Block, i: number): JSX.Element {
  const text = block.words.join(' ')
  if (block.kind === 'h') return <h3 key={i}>{text}</h3>
  if (block.kind === 'p') return <p key={i}>{text}</p>
  if (block.kind === 'ul') {
    const items: string[] = []
    for (let n = 0; n < block.words.length; n += 9)
      items.push(block.words.slice(n, n + 9).join(' '))
    return (
      <ul key={i}>
        {items.map((t, n) => (
          <li key={n}>{t}</li>
        ))}
      </ul>
    )
  }
  const lines: string[] = []
  for (let n = 0; n < block.words.length; n += 5)
    lines.push(`  ${block.words.slice(n, n + 5).join('_')}`)
  return (
    <pre key={i}>
      <code>{lines.join('\n')}</code>
    </pre>
  )
}

function App({
  Scroller,
  Item,
}: {
  Scroller: ComponentType<{ children: ReactNode }>
  Item: ComponentType<{ id: string; children: ReactNode }>
}): JSX.Element {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined)

  useEffect(() => {
    let timer = 0
    let peak = 0
    let frame = 0
    const track = (): void => {
      const g = gapPx()
      if (Number.isFinite(g)) peak = Math.max(peak, g)
      frame = requestAnimationFrame(track)
    }
    frame = requestAnimationFrame(track)
    window.__fixture = {
      reflowAt: null,
      mark: () => {
        peak = 0
      },
      peak: () => peak,
      loadImage: () => setImageSrc(`/late.svg?t=${Date.now()}`),
      start: () => {
        const t0 = performance.now()
        let planIndex = 0
        const next: Block[] = []
        timer = window.setInterval(() => {
          if (performance.now() - t0 >= STREAM_MS) {
            window.clearInterval(timer)
            return
          }
          const n = rand() < 0.5 ? 1 : 2
          for (let k = 0; k < n; k++) {
            let cur = next[next.length - 1]
            if (!cur || cur.words.length >= cur.quota) {
              const spec = PLAN[planIndex % PLAN.length]
              planIndex += 1
              if (!spec) return
              cur = { kind: spec.kind, words: [], quota: spec.quota }
              next.push(cur)
            }
            cur.words.push(word())
          }
          setBlocks(next.map((b) => ({ ...b, words: [...b.words] })))
        }, TICK_MS)
      },
    }
    return () => {
      window.clearInterval(timer)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="page">
      <header>Thread</header>
      <Scroller>
        {HISTORY.map((m) => (
          <Item key={m.id} id={m.id}>
            <div className={m.role}>
              {m.text?.split('\n\n').map((t, i) => (
                <p key={i}>{t}</p>
              ))}
              {m.image ? (
                <img
                  alt=""
                  src={imageSrc}
                  onLoad={() => {
                    window.__fixture.reflowAt = Date.now()
                  }}
                />
              ) : null}
            </div>
          </Item>
        ))}
        <Item id="stream">
          <div className="assistant" aria-busy="true">
            {blocks.map(renderBlock)}
          </div>
        </Item>
      </Scroller>
      <footer>
        <input aria-label="Message" placeholder="Message" />
      </footer>
    </div>
  )
}

export function mount(
  Scroller: ComponentType<{ children: ReactNode }>,
  Item: ComponentType<{ id: string; children: ReactNode }>,
): void {
  const host = document.getElementById('app')
  if (!host) throw new Error('#app missing')
  createRoot(host).render(<App Scroller={Scroller} Item={Item} />)
}
