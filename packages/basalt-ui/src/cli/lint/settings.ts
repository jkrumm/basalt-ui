/**
 * The hook entries basalt registers in `.claude/settings.json` and the merge that adds them
 * (skills-agent-layer 4.2). The file is consumer-owned JSON: a basalt entry is the one whose command
 * names `.basalt/hook.mjs`, it is added or replaced in place, and every other byte stays as written,
 * which is why the merge splices text instead of re-serialising. Unparseable JSON is never written.
 */

export const SHIM = '.basalt/hook.mjs'
export const SETTINGS_PATH = '.claude/settings.json'

/** The settings event each shim argument is registered under, and the tool matcher it carries. */
const EVENTS = [
  ['PostToolUse', 'post-edit', 'Edit|Write|MultiEdit'],
  ['Stop', 'stop', undefined],
  ['PreToolUse', 'pre-edit', 'Edit|Write|MultiEdit'],
] as const

/** A missing or failing shim exits 2 and says so: the bare `node` form fails open. */
export const hookCommand = (arg: string): string =>
  `node "$CLAUDE_PROJECT_DIR/${SHIM}" ${arg}; s=$?; case $s in 0|2) exit $s;; esac; ` +
  "echo 'basalt hook: the shim did not run (exit '$s'). Run bun install, then basalt-ui doctor.' >&2; exit 2"

type Entry = { matcher?: string; hooks: { type: 'command'; command: string }[] }

/** Event name to the one entry basalt registers under it. */
export function basaltEntries(): Record<string, Entry> {
  return Object.fromEntries(
    EVENTS.map(([event, arg, matcher]) => [
      event,
      {
        ...(matcher === undefined ? {} : { matcher }),
        hooks: [{ type: 'command', command: hookCommand(arg) }],
      },
    ]),
  )
}

/** The `hooks` object of a settings file holding only the basalt entries. */
export const hooksObject = (): Record<string, Entry[]> =>
  Object.fromEntries(Object.entries(basaltEntries()).map(([event, entry]) => [event, [entry]]))

export type MergeResult = { text: string } | { error: string }

// ── a scanner over text that already parsed as JSON ─────────────────────────────────────────────

type Span = { start: number; end: number }
type Member = Span & { key: string; valueStart: number }

const skipSpace = (t: string, i: number): number => {
  let at = i
  while (/\s/.test(t[at] ?? '')) at += 1
  return at
}

/** The end (exclusive) of the value starting at `i`. */
function valueEnd(t: string, i: number): number {
  const first = t[i]
  if (first === '"') {
    let at = i + 1
    while (t[at] !== '"') at += t[at] === '\\' ? 2 : 1
    return at + 1
  }
  if (first === '{' || first === '[') {
    let depth = 0
    let at = i
    for (; at < t.length; at += 1) {
      const c = t[at]
      if (c === '"') at = valueEnd(t, at) - 1
      else if (c === '{' || c === '[') depth += 1
      else if (c === '}' || c === ']') {
        depth -= 1
        if (depth === 0) return at + 1
      }
    }
    return at
  }
  let at = i
  while (at < t.length && !/[\s,}\]]/.test(t[at] ?? '')) at += 1
  return at
}

/** The members of the object starting at `open`, or the elements of the array starting there. */
function children(t: string, open: number): Member[] {
  const object = t[open] === '{'
  const out: Member[] = []
  let at = skipSpace(t, open + 1)
  while (t[at] !== '}' && t[at] !== ']') {
    const start = at
    let key = ''
    if (object) {
      const keyEnd = valueEnd(t, at)
      key = JSON.parse(t.slice(at, keyEnd)) as string
      at = skipSpace(t, skipSpace(t, keyEnd) + 1)
    }
    const end = valueEnd(t, at)
    out.push({ start, end, key, valueStart: at })
    at = skipSpace(t, end)
    if (t[at] === ',') at = skipSpace(t, at + 1)
  }
  return out
}

/** Indentation unit of the file: the first indented line sits one level down, else two spaces. */
const unitOf = (t: string): string => /\n([ \t]+)\S/.exec(t)?.[1] ?? '  '

/** `value` pretty-printed to sit at nesting `depth`. */
const render = (value: unknown, unit: string, depth: number): string =>
  JSON.stringify(value, null, unit).replaceAll('\n', `\n${unit.repeat(depth)}`)

/** Appends `text` as the last child of the container at `open`, `depth` levels down. */
function append(t: string, open: number, text: string, unit: string, depth: number): string {
  const kids = children(t, open)
  const close = valueEnd(t, open) - 1
  const pad = `\n${unit.repeat(depth + 1)}`
  const last = kids.at(-1)
  if (last === undefined) {
    return `${t.slice(0, open + 1)}${pad}${text}\n${unit.repeat(depth)}${t.slice(close)}`
  }
  return `${t.slice(0, last.end)},${pad}${text}${t.slice(last.end)}`
}

const mixed = (entry: unknown): boolean => {
  const hooks = (entry as { hooks?: { command?: unknown }[] } | null)?.hooks
  return (
    !Array.isArray(hooks) ||
    hooks.some((h) => typeof h?.command !== 'string' || !h.command.includes(SHIM))
  )
}

/**
 * `existing` with the basalt entries added or replaced; a text with every entry current comes back
 * unchanged. A hand-merged entry that holds a basalt command beside a foreign one is left whole and
 * ours is appended, so no foreign command is ever dropped.
 */
export function mergeSettings(existing: string | null): MergeResult {
  const entries = basaltEntries()
  if (existing === null || existing.trim() === '') {
    return { text: `${JSON.stringify({ hooks: hooksObject() }, null, 2)}\n` }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(existing)
  } catch {
    return { error: `${SETTINGS_PATH} is not valid JSON` }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { error: `${SETTINGS_PATH} is not a JSON object` }
  }
  const unit = unitOf(existing)
  let t = existing
  for (const [event, entry] of Object.entries(entries)) {
    const root = skipSpace(t, 0)
    const hooks = children(t, root).find((m) => m.key === 'hooks')
    if (hooks === undefined) {
      t = append(t, root, `"hooks": ${render({ [event]: [entry] }, unit, 1)}`, unit, 0)
      continue
    }
    if (t[hooks.valueStart] !== '{') return { error: `${SETTINGS_PATH} "hooks" is not an object` }
    const list = children(t, hooks.valueStart).find((m) => m.key === event)
    if (list === undefined) {
      t = append(t, hooks.valueStart, `"${event}": ${render([entry], unit, 2)}`, unit, 1)
      continue
    }
    if (t[list.valueStart] !== '[')
      return { error: `${SETTINGS_PATH} hooks.${event} is not an array` }
    const own = children(t, list.valueStart).find((el) => {
      const text = t.slice(el.start, el.end)
      return text.includes(SHIM) && !mixed(JSON.parse(text))
    })
    if (own === undefined) {
      t = append(t, list.valueStart, render(entry, unit, 3), unit, 2)
    } else if (JSON.stringify(JSON.parse(t.slice(own.start, own.end))) !== JSON.stringify(entry)) {
      t = `${t.slice(0, own.start)}${render(entry, unit, 3)}${t.slice(own.end)}`
    }
  }
  return { text: t }
}
