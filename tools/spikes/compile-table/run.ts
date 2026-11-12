/**
 * Spike Q3 (docs/v3/concepts/quality-contract.md section 10 Q3). Throwaway harness, no tests.
 *
 * Builds `lib/entry.tsx` (the v3 `./table` composite plus a windowed body) twice with tsdown, with
 * and without the React Compiler (babel-plugin-react-compiler 1.0.0, target 19), bundles one 10k-row
 * fixture against each build and drives it in real Chrome: click a sort header, wait two animation
 * frames, 1 warm-up and 11 measured runs, the median is the arm's number. Two sort columns alternate
 * so every click is a real re-sort. `gainPct` = (off - on) / off x 100.
 *
 *   virtual10k  the shipping path (windowed body); the verdict reads it
 *   dom10k      10k rows in the DOM; diagnostic only, the forbidden case
 *
 * A spread ((max - min) / median) above 20% on either virtual arm reruns that measurement once; still
 * above 20% voids the run: exit 1, no verdict. The uncompiled lane is the table test suite with no
 * compiler in the loop. Prints ONE JSON object on stdout; exit 0 means the harness ran, not that
 * the hypothesis held. Progress goes to stderr.
 */
import { loadavg } from 'node:os'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser } from 'playwright-core'

type Arm = 'on' | 'off'
type Case = 'virtual' | 'dom'

const ROOT = import.meta.dir
const REPO = resolve(ROOT, '../../..')
const RUNS = 11
const SPREAD_LIMIT = 20
const GATE_PCT = 25
// Every timed click is `Name` on a table last sorted by `Amount`, so each run does the same re-sort;
// an untimed `Amount` click puts it back.
const TIMED = 'Name'
const RESET = 'Amount'

const log = (msg: string): void => {
  process.stderr.write(`${msg}\n`)
}
const r2 = (n: number): number => Math.round(n * 100) / 100
const median = (xs: number[]): number => {
  const s = xs.toSorted((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2
}
const spreadPct = (xs: number[]): number => ((Math.max(...xs) - Math.min(...xs)) / median(xs)) * 100

const CSS = `
*{box-sizing:border-box}
body{margin:0;font:14px/1.4 system-ui,sans-serif;color:#222;background:#fff}
.scroller{height:480px;overflow:auto;width:900px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
tr{height:32px}
th,td{padding:0 8px;text-align:left;overflow:hidden;white-space:nowrap}
`

async function sh(cmd: string[], cwd: string): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, COMPILER: '' },
  })
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { code, out: out + err }
}

async function buildArm(arm: Arm): Promise<string> {
  const built = Bun.spawn(['bunx', 'tsdown'], {
    cwd: ROOT,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { ...process.env, COMPILER: arm },
  })
  const code = await built.exited
  if (code !== 0)
    throw new Error(`tsdown ${arm} failed: ${await new Response(built.stderr).text()}`)
  const out = await Bun.build({
    entrypoints: [resolve(ROOT, 'fixture/app.tsx')],
    target: 'browser',
    minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'lib',
        setup(build) {
          build.onResolve({ filter: /^lib$/ }, () => ({
            path: resolve(ROOT, `dist/${arm}/entry.js`),
          }))
        },
      },
    ],
  })
  if (!out.success) throw new Error(`fixture build failed: ${out.logs.join('\n')}`)
  const first = out.outputs[0]
  if (first === undefined) throw new Error('fixture build produced no output')
  return first.text()
}

async function measure(browser: Browser, baseUrl: string, arm: Arm, kase: Case): Promise<number[]> {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
  await page.goto(`${baseUrl}/${arm}/?mode=${kase}`)
  await page.waitForSelector('th button')
  const sort = (h: string): Promise<number> =>
    page.evaluate(
      (x) => (window as never as { sortOnce(h: string): Promise<number> }).sortOnce(x),
      h,
    )
  const run = async (): Promise<number> => {
    await sort(RESET)
    return sort(TIMED)
  }
  await run() // warm-up
  const samples: number[] = []
  for (let i = 1; i <= RUNS; i++) samples.push(r2(await run()))
  await page.close()
  return samples
}

type Pair = { on: number[]; off: number[] }

async function pair(browser: Browser, baseUrl: string, kase: Case): Promise<Pair> {
  const off = await measure(browser, baseUrl, 'off', kase)
  const on = await measure(browser, baseUrl, 'on', kase)
  return { on, off }
}

const gainOf = (p: Pair): number => ((median(p.off) - median(p.on)) / median(p.off)) * 100
const worstSpread = (p: Pair): number => Math.max(spreadPct(p.on), spreadPct(p.off))

async function main(): Promise<void> {
  const bundles: Record<Arm, string> = { off: await buildArm('off'), on: await buildArm('on') }
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url)
      const arm: Arm = url.pathname.startsWith('/on') ? 'on' : 'off'
      if (url.pathname.endsWith('/app.js'))
        return new Response(bundles[arm], { headers: { 'content-type': 'text/javascript' } })
      return new Response(
        `<!doctype html><html><head><meta charset="utf-8"><title>${arm}</title><style>${CSS}</style></head><body><div id="app"></div><script type="module" src="/${arm}/app.js"></script></body></html>`,
        { headers: { 'content-type': 'text/html' } },
      )
    },
  })
  const baseUrl = `http://localhost:${server.port}`
  const browser = await chromium.launch({
    channel: 'chrome',
    // Two animation frames at 60 Hz are ~33 ms of vsync wait, which hides a 5 ms render; frames
    // that run as fast as the work allows leave the work as the number.
    args: ['--disable-frame-rate-limit', '--disable-gpu-vsync'],
  })
  try {
    const version = browser.version()
    const loadAvg1m = r2(loadavg()[0] ?? 0)
    log(`load ${loadAvg1m}, Chrome ${version}`)

    let virtual = await pair(browser, baseUrl, 'virtual')
    let rerun = false
    if (worstSpread(virtual) > SPREAD_LIMIT) {
      log(`virtual spread ${r2(worstSpread(virtual))}% > ${SPREAD_LIMIT}%: rerun once`)
      rerun = true
      virtual = await pair(browser, baseUrl, 'virtual')
    }
    log(`virtual10k on ${r2(median(virtual.on))} off ${r2(median(virtual.off))}`)
    const dom = await pair(browser, baseUrl, 'dom')
    log(`dom10k on ${r2(median(dom.on))} off ${r2(median(dom.off))}`)

    log('uncompiled lane: bun test packages/basalt-ui/src/table')
    const lane = await sh(['bun', 'test', 'packages/basalt-ui/src/table'], REPO)
    const uncompiledLaneGreen = lane.code === 0

    const spread = r2(worstSpread(virtual))
    const gainPct = r2(gainOf(virtual))
    const voided = spread > SPREAD_LIMIT
    const verdict =
      !voided && gainPct >= GATE_PCT && uncompiledLaneGreen ? 'Q3: PASS' : 'Q3: REFUTED'
    const result = {
      virtual10k: {
        sortMsOn: r2(median(virtual.on)),
        sortMsOff: r2(median(virtual.off)),
        gainPct,
        spreadPct: spread,
        spreadPctOn: r2(spreadPct(virtual.on)),
        spreadPctOff: r2(spreadPct(virtual.off)),
        samplesOn: virtual.on,
        samplesOff: virtual.off,
      },
      dom10k: {
        diagnostic: 'forbidden case, not a gate',
        sortMsOn: r2(median(dom.on)),
        sortMsOff: r2(median(dom.off)),
        gainPct: r2(gainOf(dom)),
        spreadPctOn: r2(spreadPct(dom.on)),
        spreadPctOff: r2(spreadPct(dom.off)),
        samplesOn: dom.on,
        samplesOff: dom.off,
      },
      loadAvg1m,
      uncompiledLaneGreen,
      rerun,
      chrome: version,
      ...(voided ? { voided: true } : { verdict }),
      ...(uncompiledLaneGreen ? {} : { laneTail: lane.out.slice(-1500) }),
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (voided) process.exitCode = 1
  } finally {
    await browser.close()
    server.stop(true)
  }
}

await main()
