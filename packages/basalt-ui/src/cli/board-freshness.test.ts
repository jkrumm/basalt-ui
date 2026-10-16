import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  BOARD_NOTICE,
  designLoopLines,
  playwrightVersion,
  staleBoardNotice,
} from './board-freshness'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'board-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function put(rel: string, content: string, mtimeSec?: number): void {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
  if (mtimeSec !== undefined) utimesSync(abs, mtimeSec, mtimeSec)
}
const lastShot = (atSec: number): void =>
  put('.basalt/shots/last.json', JSON.stringify({ at: new Date(atSec * 1000).toISOString() }))

describe('staleBoardNotice', () => {
  it('is silent without UI files', () => {
    put('src/data.ts', '', 2000)
    expect(staleBoardNotice(dir, ['src'])).toBeNull()
  })
  it('notices a UI file newer than last.json', () => {
    put('src/app.tsx', '', 3000)
    lastShot(2000)
    expect(staleBoardNotice(dir, ['src'])).toBe(BOARD_NOTICE)
  })
  it('notices UI files when no board exists', () => {
    put('src/app.css', '', 3000)
    expect(staleBoardNotice(dir, ['src'])).toBe(BOARD_NOTICE)
  })
  it('is silent when last.json is newer', () => {
    put('src/app.tsx', '', 1000)
    lastShot(2000)
    expect(staleBoardNotice(dir, ['src'])).toBeNull()
  })
  it('is silent when last.json is exactly as new as the newest UI file', () => {
    put('src/app.tsx', '', 2000)
    lastShot(2000)
    expect(staleBoardNotice(dir, ['src'])).toBeNull()
  })
  it('treats corrupt JSON as no board', () => {
    put('src/app.tsx', '', 1000)
    put('.basalt/shots/last.json', '{nope')
    expect(staleBoardNotice(dir, ['src'])).toBe(BOARD_NOTICE)
  })
  it.each([['{}'], ['{"at":5}'], ['{"at":"not a date"}'], ['null'], ['[]']])(
    'treats %s as no board',
    (body) => {
      put('src/app.tsx', '', 1000)
      put('.basalt/shots/last.json', body)
      expect(staleBoardNotice(dir, ['src'])).toBe(BOARD_NOTICE)
    },
  )
  it('is silent when the roots dir is missing', () => {
    expect(staleBoardNotice(dir, ['nope'])).toBeNull()
  })
  it('reports unknown (the notice) when the walk cap is hit, even next to a fresh board', () => {
    put('src/a.tsx', '', 1000)
    put('src/b.tsx', '', 1000)
    put('src/c.tsx', '', 1000)
    lastShot(2000)
    expect(staleBoardNotice(dir, ['src'], 2)).toBe(BOARD_NOTICE)
    expect(staleBoardNotice(dir, ['src'], 4)).toBeNull()
  })
  it('does not count non-UI files against the cap: a big non-UI tree stays silent beside a fresh board', () => {
    put('src/a.tsx', '', 1000)
    for (let i = 0; i < 20; i++) put(`src/data/f${i}.json`, '')
    lastShot(2000)
    expect(staleBoardNotice(dir, ['src'], 3)).toBeNull()
  })
  it('marks the scan unknown on a non-ENOENT readdir error', () => {
    put('src', '') // a FILE where the root dir should be: ENOTDIR, not ENOENT
    lastShot(2000)
    expect(staleBoardNotice(dir, ['src'])).toBe(BOARD_NOTICE)
  })
  it('skips node_modules and dist', () => {
    put('src/node_modules/x/a.tsx', '', 3000)
    put('src/dist/a.css', '', 3000)
    expect(staleBoardNotice(dir, ['src'])).toBeNull()
  })
})

describe('playwrightVersion', () => {
  it('reports the resolved version', () => {
    expect(playwrightVersion(dir, () => ({ version: '1.64.1' }))).toBe('1.64.1')
  })
  it('falls back to playwright-core', () => {
    const load = (id: string) => {
      if (id.startsWith('playwright-core')) return { version: '1.63.0' }
      throw new Error('missing')
    }
    expect(playwrightVersion(dir, load)).toBe('1.63.0')
  })
  it('is null when absent', () => {
    expect(
      playwrightVersion(dir, () => {
        throw new Error('missing')
      }),
    ).toBeNull()
  })
})

describe('designLoopLines', () => {
  const absent = () => null
  it('emits the notice and the missing-Playwright line', () => {
    const lines = designLoopLines(dir, ['src'], { notice: () => BOARD_NOTICE, playwright: absent })
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('UI changed since the last board')
    expect(lines[1]).toContain('bun add -d playwright')
  })
  it('says "version unknown" instead of printing the placeholder', () => {
    const [line] = designLoopLines(dir, ['src'], { notice: absent, playwright: () => 'unknown' })
    expect(line).toBe('  ✓ playwright resolves (version unknown; optional: basalt-ui shot)')
  })
  it('emits only the pass line when fresh and Playwright resolves', () => {
    expect(designLoopLines(dir, ['src'], { notice: absent, playwright: () => '1.64.1' })).toEqual([
      '  ✓ playwright resolves (1.64.1; optional: basalt-ui shot)',
    ])
  })
})
