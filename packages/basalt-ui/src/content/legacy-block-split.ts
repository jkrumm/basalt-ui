/**
 * blockSplit — a pure, fence-aware, blank-line block lexer (docs/CONTENT-SPEC.md §2/§6).
 *
 * Splits a markdown string into top-level blocks for streaming memoization: every block except
 * the last is referentially stable across re-renders (`React.memo` skips them), so only the
 * in-flight tail block re-renders per streamed token (see `./markdown.tsx`).
 *
 * Rules (deliberately pragmatic, not a full CommonMark tokenizer):
 *  - Split on blank-line boundaries.
 *  - Never split inside a fenced code block (``` or ~~~, any info string). A fence closes at a
 *    line starting with at least as many of the SAME fence character as opened it (CommonMark's
 *    closing-fence length rule, without validating the rest of the line).
 *  - List continuation: a blank line followed by an indented line (≥2 spaces) or a line starting
 *    a list item (`-`/`*`/`1.`) does NOT split — the blank line(s) stay attached to the block
 *    that is still accumulating, so a list with blank-line-separated items stays one block.
 *  - Every other consecutive non-blank line (tables, blockquotes, paragraphs) stays together
 *    automatically — there is no blank line to trigger a split.
 *
 * Blocks retain their raw text verbatim (including blank/trailing lines), so
 * `blockSplit(input).join('') === input` always holds.
 */

const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})/
const LIST_CONTINUATION_RE = /^(?: {2,}|[-*]\s|\d+[.)]\s)/

type FenceOpen = { char: string; len: number }

function matchFenceOpen(line: string): FenceOpen | null {
  const match = FENCE_OPEN_RE.exec(line)
  if (!match?.[1]) return null
  const marker = match[1]
  return { char: marker[0] as string, len: marker.length }
}

function closesFence(line: string, fence: FenceOpen): boolean {
  const trimmed = line.replace(/^ {0,3}/, '')
  const runRe = fence.char === '`' ? /^`+/ : /^~+/
  const run = runRe.exec(trimmed)?.[0]
  return run !== undefined && run.length >= fence.len
}

function isBlank(line: string): boolean {
  return line.trim() === ''
}

/** Splits `markdown` into top-level blocks. See module doc for the rules. */
export function blockSplit(markdown: string): string[] {
  if (markdown === '') return []

  // Split AFTER every newline so each entry keeps its own line terminator — reconstructing via
  // `.join('')` is then lossless by construction, which is what the join-invariant test asserts.
  const lines = markdown.split(/(?<=\n)/)
  const blocks: string[] = []
  let current: string[] = []
  let fence: FenceOpen | null = null

  let i = 0
  while (i < lines.length) {
    const line = lines[i] as string

    if (fence !== null) {
      current.push(line)
      if (closesFence(line, fence)) fence = null
      i++
      continue
    }

    const fenceOpen = matchFenceOpen(line)
    if (fenceOpen) {
      current.push(line)
      fence = fenceOpen
      i++
      continue
    }

    if (isBlank(line)) {
      let j = i
      while (j < lines.length && isBlank(lines[j] as string)) j++
      const blankLines = lines.slice(i, j)
      const nextLine = j < lines.length ? (lines[j] as string) : undefined

      current.push(...blankLines)
      if (nextLine !== undefined && LIST_CONTINUATION_RE.test(nextLine)) {
        // Continuation — keep accumulating into the same block.
        i = j
        continue
      }

      // Boundary — trailing blank line(s) close out the block that was accumulating.
      blocks.push(current.join(''))
      current = []
      i = j
      continue
    }

    current.push(line)
    i++
  }

  if (current.length > 0) blocks.push(current.join(''))
  return blocks
}
