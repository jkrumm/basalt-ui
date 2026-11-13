/**
 * Print lane (quality-contract section 4, row `print`; Q6 sibling): every playground route in the
 * print medium as an A4 PDF, plus the seeded offenders as negative controls. The route cells, the
 * offender fixtures and the assertions live in `packages/basalt-ui/tests/quality/print`.
 *
 * Fails when a route breaks a print assertion, or when a control does not do its job (an offender
 * that passes, the clean page that fails), so a silently blind assertion cannot report green.
 */
import { join } from 'node:path'
import { sharedExemplar } from '../../packages/basalt-ui/tests/quality/print/boot'
import { classifyPrint, KNOWN_PRINT } from '../../packages/basalt-ui/tests/quality/print/known'
import type { KnownPrint } from '../../packages/basalt-ui/tests/quality/print/known'
import { printRoute, runControls } from '../../packages/basalt-ui/tests/quality/print/print'
import { routePaths } from '../../packages/basalt-ui/tests/quality/matrix/routes'
import type { Lane } from './types'

const FIXTURES = join(import.meta.dirname, '../../packages/basalt-ui/tests/quality/print/offenders')

export const print: Lane = async ({ openBrowser }) => {
  const exemplar = await sharedExemplar()
  const routes = routePaths()
  const browser = await openBrowser()
  const cells: Array<{ route: string; pages: number; failures: string[] }> = []
  let controls: Awaited<ReturnType<typeof runControls>>
  try {
    const context = await browser.newContext({ locale: 'en-US', reducedMotion: 'reduce' })
    controls = await runControls(await context.newPage(), (name) =>
      Bun.file(join(FIXTURES, `${name}.html`)).text(),
    )
    await context.close()
    for (const route of routes) {
      const routeContext = await browser.newContext({ locale: 'en-US', reducedMotion: 'reduce' })
      try {
        const report = await printRoute(await routeContext.newPage(), exemplar.origin, route)
        cells.push({ route, ...report })
      } finally {
        await routeContext.close()
      }
    }
  } finally {
    await browser.close()
  }

  const used = new Set<KnownPrint>()
  const unexpected = cells.flatMap((c) => {
    const split = classifyPrint(c.route, c.failures)
    for (const entry of split.matched) used.add(entry)
    return split.unexpected.length > 0 ? [{ ...c, failures: split.unexpected }] : []
  })
  const stale = KNOWN_PRINT.filter((k) => !used.has(k)).map((k) => `${k.route} ${String(k.item)}`)
  const blind = controls.filter((c) => !c.ok)
  const failing = cells.filter((c) => c.failures.length > 0)
  if (blind.length > 0) {
    throw new Error(
      `print lane: ${blind.length} control(s) wrong: ${blind.map((c) => `${c.offender}: ${c.detail}`).join(' | ')}`,
    )
  }
  if (stale.length > 0) {
    throw new Error(`print lane: known findings that no longer match: ${stale.join(', ')}`)
  }
  if (unexpected.length > 0) {
    throw new Error(
      `print lane: ${unexpected.length} route(s) fail:\n${unexpected
        .map((c) => `  ${c.route} (${c.pages} pages)\n    ${c.failures.slice(0, 8).join('\n    ')}`)
        .join('\n')}`,
    )
  }
  return {
    lane: 'print',
    summary: [
      { metric: 'routes', value: cells.length },
      { metric: 'routes with findings (known)', value: failing.length },
      { metric: 'known findings', value: cells.reduce((n, c) => n + c.failures.length, 0) },
      { metric: 'pages (all routes)', value: cells.reduce((sum, c) => sum + c.pages, 0) },
      { metric: 'controls ok', value: `${controls.length - blind.length}/${controls.length}` },
    ],
    detail: { cells, controls },
  }
}
