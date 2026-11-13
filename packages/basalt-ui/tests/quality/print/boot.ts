/**
 * The exemplar the print and WebKit lanes grade: the matrix harness's bundle of the playground (theme
 * script in the head, the package through its built `dist`), booted once per process and shared by
 * both lanes. Left up until the process exits: `make evidence` ends with `process.exit`.
 */
import { bootMatrix } from '../matrix/harness'
import type { MatrixHarness } from '../matrix/harness'

let booted: Promise<MatrixHarness> | undefined

export function sharedExemplar(): Promise<MatrixHarness> {
  booted ??= bootMatrix().then((harness) => {
    if (harness === null) throw new Error('quality lanes: no Google Chrome to boot the exemplar')
    return harness
  })
  return booted
}
