/** SSR gate: importing the module starts no timer or fetch, and nothing runs before a subscribe. */
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { createChannel } from '../../../src/core/channel'

const src = join(import.meta.dir, '../../../src')

describe('SSR', () => {
  test('importing the module starts no timer, interval or fetch', async () => {
    const probe = `
      let n = 0
      for (const k of ['setTimeout', 'setInterval', 'fetch', 'queueMicrotask']) {
        const real = globalThis[k]
        globalThis[k] = (...a) => { n++; return real(...a) }
      }
      const m = await import(${JSON.stringify(join(src, 'index.ts'))}).catch(() => null)
      const c = await import(${JSON.stringify(join(src, 'core/channel.ts'))})
      const u = await import(${JSON.stringify(join(src, 'core/use-now.ts'))})
      const ch = c.createChannel({ url: '/x' })
      ch.store.getSnapshot(); ch.store.getServerSnapshot()
      console.log(JSON.stringify({ n, createChannel: typeof c.createChannel, useNow: typeof u.useNow }))
    `
    const proc = Bun.spawn(['bun', '-e', probe], { stdout: 'pipe', stderr: 'pipe', cwd: src })
    const out = await new Response(proc.stdout).text()
    expect(JSON.parse(out.trim().split('\n').at(-1)!)).toEqual({
      n: 0,
      createChannel: 'function',
      useNow: 'function',
    })
  })

  test('createChannel alone opens nothing; the server snapshot is one constant', () => {
    let fetched = 0
    const real = globalThis.fetch
    globalThis.fetch = (() => {
      fetched++
      return real('about:blank')
    }) as unknown as typeof fetch
    try {
      const channel = createChannel({ url: '/never' })
      const a = channel.store.getServerSnapshot()
      expect(channel.store.getServerSnapshot()).toBe(a)
      expect(a).toEqual({ status: 'idle', attempt: 0 })
      expect(channel.store.getSnapshot().status).toBe('idle')
      expect(fetched).toBe(0)
    } finally {
      globalThis.fetch = real
    }
  })

  test('createChannel without url or transport throws at once', () => {
    expect(() => createChannel({})).toThrow('url')
  })
})
