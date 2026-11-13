/**
 * WebKit lane (quality-contract Q6): the layout subset and axe on Playwright's WebKit with an iPhone
 * and a desktop Safari descriptor, over the exemplar's routes. Cells, checks and offender fixtures
 * live in `packages/basalt-ui/tests/quality/webkit`. Route findings are recorded in the detail JSON
 * and the summary (the lane is not gating on them until a device runner exists); a control that does
 * not do its job fails the lane.
 *
 * It grades the matrix harness's own bundle of the exemplar, not `ctx.baseUrl` / `ctx.routes`: the Vite
 * dist carries no theme script (`data-theme` stays unset), so a scheme-dependent print or WebKit result
 * on it would not describe the exemplar. `--dist` and `--routes` therefore do not apply to this lane.
 */
import { join } from 'node:path'
import { routePaths } from '../../packages/basalt-ui/tests/quality/matrix/routes'
import { sharedExemplar } from '../../packages/basalt-ui/tests/quality/print/boot'
import {
  DESCRIPTORS,
  launchWebkit,
  runWebkitControls,
  webkitCell,
} from '../../packages/basalt-ui/tests/quality/webkit/webkit'
import type { Finding } from '../../packages/basalt-ui/tests/quality/webkit/webkit'
import type { Lane } from './types'

const FIXTURES = join(
  import.meta.dirname,
  '../../packages/basalt-ui/tests/quality/webkit/offenders',
)

export const webkit: Lane = async () => {
  const exemplar = await sharedExemplar()
  const routes = routePaths()
  const browser = await launchWebkit()
  const findings: Finding[] = []
  let controls: Awaited<ReturnType<typeof runWebkitControls>>
  try {
    controls = await runWebkitControls(browser, (name) =>
      Bun.file(join(FIXTURES, `${name}.html`)).text(),
    )
    for (const descriptor of DESCRIPTORS) {
      for (const route of routes) {
        findings.push(...(await webkitCell(browser, descriptor, exemplar.origin, route)))
      }
    }
  } finally {
    await browser.close()
  }

  const blind = controls.filter((c) => !c.ok)
  if (blind.length > 0) {
    throw new Error(
      `webkit lane: ${blind.length} control(s) wrong: ${blind.map((c) => `${c.offender}: ${c.detail}`).join(' | ')}`,
    )
  }
  const byCheck = (name: string): number => findings.filter((f) => f.check === name).length
  return {
    lane: 'webkit',
    summary: [
      { metric: 'descriptors', value: DESCRIPTORS.join(', ') },
      { metric: 'cells', value: routes.length * DESCRIPTORS.length },
      {
        metric: 'cells with findings',
        value: new Set(findings.map((f) => `${f.descriptor} ${f.route}`)).size,
      },
      ...['axe', 'overflow', 'textSpacing', 'inputFloor'].map((name) => ({
        metric: `findings: ${name}`,
        value: byCheck(name),
      })),
      { metric: 'controls ok', value: `${controls.length - blind.length}/${controls.length}` },
    ],
    detail: { findings, controls },
  }
}
