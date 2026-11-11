/**
 * The eject header, line 1 of every ejected file (docs/v3/ARCHITECTURE.md 4.2):
 * `// basalt:ejected <name>@<version> <why>`. `sync` strips it before the three-way merge, because
 * left on line 1 it conflicts with any upstream edit there, and writes it back after.
 */

const HEADER = /^\/\/ basalt:ejected ([a-z][a-z0-9-]*)@(\S+)(?: (.*))?$/

export type Header = { name: string; version: string; reason: string }

export function ejectHeader(name: string, version: string, reason: string): string {
  return `// basalt:ejected ${name}@${version} ${reason}`
}

/** The fields of a header line, or null when the line is not one. */
export function parseHeader(line: string): Header | null {
  const match = HEADER.exec(line.replace(/\r$/, ''))
  if (match === null) return null
  return { name: match[1] ?? '', version: match[2] ?? '', reason: match[3] ?? '' }
}

/** Line 1 split off when it is a header; otherwise `header` is null and `body` is the whole text. */
export function stripHeader(text: string): { header: string | null; body: string } {
  const newline = text.indexOf('\n')
  const first = newline === -1 ? text : text.slice(0, newline)
  if (parseHeader(first) === null) return { header: null, body: text }
  return { header: first, body: newline === -1 ? '' : text.slice(newline + 1) }
}

export function withHeader(header: string, body: string): string {
  return `${header}\n${body}`
}
