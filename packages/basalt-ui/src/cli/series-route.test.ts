/**
 * The one consumer route for app series colors, built the way the README documents it in a fixture
 * app: `init` seeds `src/basalt.tokens.ts`, the app writes its pairs there, `tokens:css --extra` emits
 * the variables, and the stylesheet entry imports them. A chart takes the pair; an HTML mark takes the
 * `groupTokens` ref, which must resolve to a custom property that sheet declares for both schemes.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import type { SeriesColor } from '../charts/contract'
import { groupTokens } from '../tokens'
import { init } from './init'
import { tokensCss } from './tokens-css'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const put = (dir: string, path: string, content: string): void => {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), content)
}
const read = (dir: string, path: string): string => readFileSync(join(dir, path), 'utf8')

/** The fixture app: a repo with the stock Vite config and stylesheet, then `init --profile app`. */
async function fixtureApp(): Promise<string> {
  const dir = mkdtempSync(resolve(tmpdir(), 'basalt-series-route-'))
  dirs.push(dir)
  mkdirSync(join(dir, '.git'))
  put(dir, 'package.json', JSON.stringify({ name: 'fixture', devDependencies: {} }))
  put(dir, 'bun.lock', '')
  put(
    dir,
    'vite.config.ts',
    "import react from '@vitejs/plugin-react'\nexport default { plugins: [react()] }\n",
  )
  put(dir, 'src/index.css', "@import 'tailwindcss';\n")
  const saved = { log: console.log, error: console.error }
  console.log = console.error = () => {}
  try {
    const code = await init(['--profile', 'app', '--root', 'src'], dir, {
      run: () => true,
      doctor: async () => 0,
    })
    expect(code).toBe(0)
  } finally {
    Object.assign(console, saved)
  }
  return dir
}

const SERIES_FILE = `export default {
  series: {
    app: {
      sessions: { light: '#2871c7', dark: '#5190f7' },
      churn: { light: '#af293e', dark: '#e46360' },
    },
  },
} as const
`

describe('the one series route', () => {
  it('init seeds the file, emits its sheet and imports it in the stylesheet entry', async () => {
    const dir = await fixtureApp()
    expect(read(dir, 'src/basalt.tokens.ts')).toContain('export default')
    expect(read(dir, 'src/index.css')).toContain("@import './basalt.tokens.css';")
    const manifest = JSON.parse(read(dir, '.basalt/manifest.json'))
    expect(manifest.extra).toBe('src/basalt.tokens.ts')
  })

  it('a groupTokens ref of the authored file resolves to a declared custom property', async () => {
    const dir = await fixtureApp()
    put(dir, 'src/basalt.tokens.ts', SERIES_FILE)
    const regenerate = ['--extra', 'src/basalt.tokens.ts', '--out', 'src/basalt.tokens.css']
    expect(tokensCss(regenerate, dir)).toBe(0)

    const { default: tokens } = (await import(join(dir, 'src/basalt.tokens.ts'))) as {
      default: { series: { app: Record<'sessions' | 'churn', SeriesColor> } }
    }
    // A chart series takes the pair as its `color`.
    const pair = tokens.series.app.sessions
    expect(pair).toEqual({ light: '#2871c7', dark: '#5190f7' })

    // An HTML mark takes the ref; the sheet declares that property once per scheme, with the pair's values.
    const ref = groupTokens('app', tokens.series.app).sessions
    const name = /^var\((--basalt-[\w-]+)\)$/.exec(ref)?.[1]
    expect(name).toBe('--basalt-app-sessions')
    const css = read(dir, 'src/basalt.tokens.css')
    expect(css).toContain(`${name}: ${pair.light};`)
    expect(css).toContain(`${name}: ${pair.dark};`)
    const sides = css.split(`${name}:`).length - 1
    expect(sides).toBeGreaterThanOrEqual(2)

    // Every key of the group is declared, and the sheet is what the manifest row would re-emit.
    for (const key of Object.keys(tokens.series.app)) {
      expect(css).toContain(`--basalt-app-${key}:`)
    }
    expect(tokensCss([...regenerate, '--check'], dir)).toBe(0)
  })
})
