import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { BOARD_NOTICE, playwrightVersion, staleBoardNotice } from './board-freshness'

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
