import './src/setup'
import { runCases } from './src/cases'

// Entry for the scratch copy installed against router 1.170.38 (run.ts spawns it there).
process.stdout.write(`${JSON.stringify(await runCases())}\n`)
