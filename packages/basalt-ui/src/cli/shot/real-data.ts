/** Flags that point `shot` at a real, authenticated app: seeded localStorage and a proxied API. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ShotError } from './playwright'

export type ApiRoute = { prefix: string; origin: string }
export type Pair = readonly [name: string, value: string]
export type Source = { env: Readonly<Record<string, string | undefined>>; cwd: string }

/** `<name>=<value>` split at the first `=`; errors name the flag, never the text (it may hold a secret). */
function splitPair(flag: string, raw: string): Pair {
  const at = raw.indexOf('=')
  if (at <= 0) throw new ShotError(`--${flag} expects <name>=<value>`)
  return [raw.slice(0, at), raw.slice(at + 1)]
}

/** `@env:NAME` or `@file:path`: a secret never sits in argv, so there is no literal form. */
function resolveValue(flag: string, raw: string, src: Source): string {
  const [, kind, ref = ''] = /^@(env|file):(.*)$/s.exec(raw) ?? []
  let value: string | undefined
  if (kind === 'env') value = Object.hasOwn(src.env, ref) ? src.env[ref] : undefined
  else if (kind === 'file') {
    try {
      value = readFileSync(resolve(src.cwd, ref), 'utf8').trim()
    } catch {
      throw new ShotError(`--${flag}: cannot read @file:${ref}`)
    }
  } else throw new ShotError(`--${flag} takes @env:NAME or @file:path, never a literal`)
  if (!value) throw new ShotError(`--${flag}: ${raw} is empty`)
  return value
}

export const parseStorage = (list: readonly string[], src: Source): Pair[] =>
  list.map((raw) => {
    const [key, value] = splitPair('local-storage', raw)
    return [key, resolveValue('local-storage', value, src)]
  })

const NOT_FORWARDED = new Set(['host', 'origin', 'referer', 'connection', 'content-length'])
const HEADER_NAME = /^[!#$%&'*+.^_`|~\w-]+$/
const HEADER_VALUE = /^[\t\x20-\x7e]*$/

/** `--header` pairs: a valid, forwardable name and a value that cannot split the request. */
export const parseHeaders = (list: readonly string[], src: Source): Pair[] =>
  list.map((raw) => {
    const [name, value] = splitPair('header', raw)
    if (!HEADER_NAME.test(name) || NOT_FORWARDED.has(name.toLowerCase()))
      throw new ShotError(`--header ${name}: not a header shot can send`)
    const resolved = resolveValue('header', value, src)
    if (!HEADER_VALUE.test(resolved))
      throw new ShotError(`--header ${name}: value has characters a header cannot carry`)
    return [name, resolved]
  })

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** `--api <prefix>=<origin>`; with any secret configured (`--header`, `--local-storage`), a remote origin must be https. */
export function parseApi(list: readonly string[], secrets: boolean): ApiRoute[] {
  return list.map((raw) => {
    const [given, target] = splitPair('api', raw)
    const prefix = given.replace(/\/+$/, '')
    if (!prefix.startsWith('/'))
      throw new ShotError('--api prefix must start with "/" and name a path, not "/"')
    let url: URL
    try {
      url = new URL(target ?? '')
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
    } catch {
      throw new ShotError('--api <prefix>=<origin>: origin must be an http(s) URL')
    }
    if (secrets && url.protocol !== 'https:' && !LOOPBACK.has(url.hostname))
      throw new ShotError(
        `--api ${prefix}: with a secret configured (--header, --local-storage) the origin must be https (loopback excepted)`,
      )
    return { prefix, origin: url.origin }
  })
}

const NOT_RETURNED = ['content-encoding', 'content-length', 'transfer-encoding']
const READ_ONLY = new Set(['GET', 'HEAD'])
/** A status that means the page shows something other than the app's data: a redirect, a missing resource, a failure, a refusal. */
const UNTRUSTED = (status: number): boolean =>
  status >= 500 ||
  (status >= 300 && status < 400) ||
  status === 401 ||
  status === 403 ||
  status === 404
const TIMEOUT_MS = 20_000

export type ApiProxy = {
  handle: (req: Request) => Promise<Response | null>
  /** The calls since the last drain that make a board untrustworthy: a 3xx, 401, 403, 404, 5xx or no answer. */
  drain: () => string[]
}

/**
 * The static server's API hook: a GET/HEAD under a prefix goes to `<origin><path>?<query>` with the
 * `--header` values added, except on a navigation; any other method is a 405 unless `allowWrites`.
 * Anything else is null (served from `--dist`). Every non-2xx or failed call is logged by method,
 * path and status or error class, never a header or a query.
 */
export function apiProxy(
  api: readonly ApiRoute[],
  headers: readonly Pair[],
  opts: { log: (line: string) => void; allowWrites?: boolean; timeoutMs?: number },
): ApiProxy {
  let problems: string[] = []
  const handle = async (req: Request): Promise<Response | null> => {
    const url = new URL(req.url)
    const route = api.find(
      (r) => url.pathname === r.prefix || url.pathname.startsWith(r.prefix + '/'),
    )
    if (!route) return null
    // Method, prefix and depth only: path segments can hold identifiers, so they never reach a log.
    const depth = url.pathname.slice(route.prefix.length).split('/').filter(Boolean).length
    const label = `${req.method} ${route.prefix} +${depth}`
    if (!opts.allowWrites && !READ_ONLY.has(req.method)) {
      opts.log(`[shot] api ${label} blocked: read-only run (--api-allow-writes lifts it)`)
      return new Response('read-only', { status: 405 })
    }
    const out = new Headers()
    for (const [name, value] of req.headers) if (!NOT_FORWARDED.has(name)) out.set(name, value)
    const navigating =
      req.headers.get('sec-fetch-mode') === 'navigate' ||
      req.headers.get('sec-fetch-dest') === 'document'
    if (!navigating) for (const [name, value] of headers) out.set(name, value)
    try {
      const res = await fetch(route.origin + url.pathname + url.search, {
        method: req.method,
        headers: out,
        redirect: 'manual',
        signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
        ...(READ_ONLY.has(req.method) ? {} : { body: await req.arrayBuffer() }),
      })
      if (!res.ok) opts.log(`[shot] api ${label} → ${res.status}`)
      if (UNTRUSTED(res.status)) problems.push(`${label} ${res.status}`)
      const back = new Headers(res.headers)
      for (const name of NOT_RETURNED) back.delete(name)
      return new Response(res.body, { status: res.status, headers: back })
    } catch (error) {
      const kind = error instanceof Error ? error.name : 'Error'
      opts.log(`[shot] api ${label} failed: ${kind}`)
      problems.push(`${label} ${kind}`)
      return new Response('proxy error', { status: 502 })
    }
  }
  return {
    handle,
    drain: () => {
      const seen = problems
      problems = []
      return seen
    },
  }
}

/** The page global the seed script reports through: `origin`, or the keys it could not set. */
export const SEED_FLAG = '__shotSeedFailed'

/** The init script that seeds localStorage, only on `origin` and only for an absent key (a token the app rotates survives), before any page script runs. */
export const seedScript = (entries: readonly Pair[], origin: string): string =>
  `(()=>{if(location.origin!==${JSON.stringify(origin)}){globalThis.${SEED_FLAG}='origin';return}` +
  `const f=[];for(const [k,v] of ${JSON.stringify(entries)}){try{if(localStorage.getItem(k)===null)localStorage.setItem(k,v)}catch{f.push(k)}}` +
  `if(f.length)globalThis.${SEED_FLAG}=f.join(',')})()`
