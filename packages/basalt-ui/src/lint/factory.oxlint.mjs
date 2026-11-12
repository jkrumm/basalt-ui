// Runs the factory's RuleTester suites under oxlint's `plugins-dev`, which refuses Bun (it needs
// Node >= 22 raw transfer). `factory.test.ts` bundles `factory.cases.ts` and passes its path.
// Prints one JSON line `{ passed, failures }`; exit 1 on any failure or on zero cases run.
import { pathToFileURL } from 'node:url'

import { RuleTester } from 'oxlint/plugins-dev'

const { SUITES } = await import(pathToFileURL(process.argv[2]).href)

const trail = []
const failures = []
let passed = 0

RuleTester.describe = (name, fn) => {
  trail.push(name)
  try {
    fn()
  } finally {
    trail.pop()
  }
}
RuleTester.it = (name, fn) => {
  try {
    fn()
    passed += 1
  } catch (error) {
    failures.push(`${[...trail, name].join(' > ')}: ${error.message}`)
  }
}
RuleTester.itOnly = RuleTester.it

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'jsx' } } })
for (const suite of SUITES) tester.run(suite.name, suite.rule, suite.cases)

process.stdout.write(`${JSON.stringify({ passed, failures })}\n`)
process.exit(failures.length > 0 || passed === 0 ? 1 : 0)
