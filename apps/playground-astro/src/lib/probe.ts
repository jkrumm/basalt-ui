import { createElement } from 'react'
import type { ComponentType } from 'react'
import { renderToReadableStream } from 'react-dom/server'

/** The outcome of rendering one demo on the server, the way the Astro React renderer does (a stream). */
export type SsrProbe = {
  /** The shell rendered: a static page gets HTML. */
  ok: boolean
  /** The error that stopped the shell (the build would fail on a hydrating island). */
  error?: string
  /** Errors inside a Suspense boundary: the server sent the fallback and left that part to the client. */
  recovered: string[]
}

const message = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split('\n')[0]?.slice(0, 300) ?? ''

/** The section's `data-ssr`: the shell rendered, rendered with a part left to the client, or failed. */
export const state = (p: SsrProbe): 'ok' | 'partial' | 'fail' =>
  !p.ok ? 'fail' : p.recovered.length ? 'partial' : 'ok'

/** The section's `data-ssr-error`: the first error the server render met. */
export const detail = (p: SsrProbe): string => p.error ?? p.recovered[0] ?? ''

/** Renders the demo to completion on the server and reports whether a static page would carry it. */
export async function probe(Demo: ComponentType): Promise<SsrProbe> {
  const recovered: string[] = []
  try {
    const stream = await renderToReadableStream(createElement(Demo), {
      onError: (error) => {
        recovered.push(message(error))
      },
    })
    await stream.allReady
    await new Response(stream).text()
    return { ok: true, recovered }
  } catch (error) {
    return { ok: false, error: message(error), recovered }
  }
}
