import { FILE_WAIVABLE, directiveId, isKnown2xId, resolveIds } from './idmap.ts'
import type { Lane } from './idmap.ts'

/** The shortest string accepted as a written reason, as in the 2.x guard: excludes a stray separator. */
const MIN_REASON_LENGTH = 4

export type Site = {
  /** 1-based line the 2.x annotation starts on. */
  readonly line: number
  readonly file: boolean
  readonly ids: readonly string[]
  readonly reason: string
}

export type Worklisted = { readonly line: number; readonly reason: string; readonly text: string }

export type TransformResult = {
  readonly text: string
  readonly rewritten: readonly Site[]
  readonly worklist: readonly Worklisted[]
  /** File-level sites rewritten: each needs its path in `manifest.deepRender` before v3 honours it. */
  readonly deepRenderCandidates: readonly Site[]
}

const START = /(\/\/+|\/\*+)[ \t]*theme-allow(-file)?(?![\w-])/

type Parsed = { ids: string[]; unknown: string | null; reason: string }

/** `theme-allow [<id>[, <id>]…] [<separator>] <reason>`, the 2.x grammar (src/guard/index.ts). */
function parseBody(body: string): Parsed {
  const ids: string[] = []
  let unknown: string | null = null
  let rest = body.replace(/^[\s,]+/, '')
  let inIdSlot = true
  for (;;) {
    const m = /^(?:basalt\/)?([a-z][a-z0-9-]*)(?=$|[\s,:—–])/.exec(rest)
    const id = m?.[1]
    if (m === null || id === undefined) break
    if (!isKnown2xId(id)) {
      if (inIdSlot) unknown = id
      break
    }
    ids.push(id)
    const after = rest.slice(m[0].length)
    rest = after.replace(/^[\s,]+/, '')
    inIdSlot = /^\s*,/.test(after)
  }
  const reason = rest
    .replace(/^(?:—|–|-{1,2}|:)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { ids, unknown, reason }
}

type Extent = {
  /** Index of the last line of the comment. */
  end: number
  /** Comment body after the token, continuation lines joined. */
  body: string
  /** Text before the comment opener on its first line. */
  before: string
  /** Text after the comment closer on its last line (block comments). */
  after: string
}

function readExtent(lines: readonly string[], i: number, m: RegExpExecArray): Extent {
  const first = lines[i] ?? ''
  const before = first.slice(0, m.index)
  const afterToken = first.slice(m.index + m[0].length)
  const standalone = /^\s*\{?\s*$/.test(before)
  if (m[1]?.startsWith('//')) {
    let end = i
    const parts = [afterToken]
    if (standalone) {
      while (end + 1 < lines.length) {
        const next = lines[end + 1] ?? ''
        const c = /^\s*\/\/+\s?(.*)$/.exec(next)
        if (c === null || START.test(next) || /^\s*\/\/\s*(?:oxlint|eslint|stylelint)-/.test(next))
          break
        parts.push(c[1] ?? '')
        end++
      }
    }
    return { end, body: parts.join(' '), before, after: '' }
  }
  const parts: string[] = []
  let end = i
  let tail = afterToken
  for (;;) {
    const close = tail.indexOf('*/')
    if (close >= 0) {
      parts.push(tail.slice(0, close))
      return { end, body: parts.join(' '), before, after: tail.slice(close + 2) }
    }
    parts.push(tail)
    end++
    if (end >= lines.length)
      return { end: i, body: afterToken, before, after: '\u0000unterminated' }
    tail = (lines[end] ?? '').replace(/^\s*\*+ ?/, '')
  }
}

const indentOf = (line: string): string => /^\s*/.exec(line)?.[0] ?? ''

/**
 * Rewrite every 2.x `theme-allow` annotation of one file to the v3 native directive, or put it on
 * the worklist untouched. A site with no reason, an unknown or unmappable kind, an unsupported
 * placement, or a file-level directive that v3 would refuse, is never rewritten and never given a
 * reason. Idempotent: a rewritten site no longer carries the token.
 */
export function transformWaivers(source: string, opts: { lane: Lane }): TransformResult {
  const { lane } = opts
  const lines = source.split('\n')
  const out: string[] = []
  const rewritten: Site[] = []
  const worklist: Worklisted[] = []
  const deepRenderCandidates: Site[] = []
  const block = lane === 'css'

  const wrap = (text: string, braces: boolean): string => {
    const c = block || braces ? `/* ${text} */` : `// ${text}`
    return braces ? `{${c}}` : c
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const m = START.exec(line)
    if (m === null) {
      out.push(line)
      continue
    }
    const keep = (reason: string, end: number): void => {
      worklist.push({ line: i + 1, reason, text: line.trim().slice(0, 140) })
      for (let k = i; k <= end; k++) out.push(lines[k] ?? '')
      i = end
    }
    const ext = readExtent(lines, i, m)
    const isFile = m[2] === '-file'
    const standalone = /^\s*\{?\s*$/.test(ext.before)
    if (ext.after === '\u0000unterminated') {
      keep('unterminated block comment', i)
      continue
    }
    if (ext.after.trim() !== '' && ext.after.trim() !== '}') {
      keep('unsupported placement: code follows the comment on its line', ext.end)
      continue
    }
    const braces = standalone && ext.before.includes('{')
    const parsed = parseBody(ext.body)
    if (parsed.unknown !== null) {
      keep(`unknown kind \`${parsed.unknown}\`: it waives nothing in 2.x either`, ext.end)
      continue
    }
    if (parsed.ids.length === 0) {
      keep('bare waiver: names no rule id, so there is nothing to map', ext.end)
      continue
    }
    if (parsed.reason.length < MIN_REASON_LENGTH) {
      keep('no reason: v3 requires `-- <why>`; the tool never invents one', ext.end)
      continue
    }
    const resolved = resolveIds(parsed.ids, lane)
    if (!resolved.ok) {
      keep(resolved.reason, ext.end)
      continue
    }
    const site: Site = { line: i + 1, file: isFile, ids: resolved.ids, reason: parsed.reason }
    const names = resolved.ids.map((id) => directiveId(id, lane)).join(', ')
    if (isFile) {
      if (!standalone || !resolved.ids.every((id) => FILE_WAIVABLE.has(id))) {
        keep(
          `file-level directive for ${names}: v3 allows it only for ${[...FILE_WAIVABLE].join(', ')} on a manifest.deepRender path; fix at source or waive per line`,
          ext.end,
        )
        continue
      }
      out.push(
        `${indentOf(line)}/* ${lane === 'css' ? 'stylelint' : 'oxlint'}-disable ${names} -- ${parsed.reason} */`,
      )
      rewritten.push(site)
      deepRenderCandidates.push(site)
      i = ext.end
      continue
    }
    const tool = lane === 'css' ? 'stylelint' : 'oxlint'
    const directive = `${tool}-disable-next-line ${names} -- ${parsed.reason}`
    if (standalone) {
      out.push(`${indentOf(line)}${wrap(directive, braces)}`)
    } else {
      // Trailing: the directive moves to the line above, the code keeps its line.
      const code = ext.before.replace(/\s+$/, '')
      out.push(`${indentOf(line)}${wrap(directive, false)}`)
      out.push(code + (ext.after.trim() === '}' ? '}' : ''))
    }
    rewritten.push(site)
    i = ext.end
  }
  return { text: out.join('\n'), rewritten, worklist, deepRenderCandidates }
}

/** Lane by extension; `null` for a file the tool does not read. */
export function laneOf(file: string): Lane | null {
  if (/\.(?:css|scss|pcss)$/.test(file)) return 'css'
  if (/\.(?:[cm]?[jt]s|[jt]sx)$/.test(file) && !file.endsWith('.d.ts')) return 'ts'
  return null
}
