// Blocks: see ../structure-rest/colour-literal.tsx.

// @invalid
import { evaluate } from '@mdx-js/mdx'

// @invalid
import { run as execute } from '@mdx-js/mdx'

// @invalid
import { evaluate } from 'next-mdx-remote/rsc'

// @invalid
import * as mdx from '@mdx-js/mdx'
const mod = await mdx.evaluate(source, runtime)

// @invalid
import { compile } from '@mdx-js/mdx'
const code = String(await compile(source, { outputFormat: 'function-body' }))
const run = new Function(code)

// @invalid
import { MDXRemote } from 'next-mdx-remote/rsc'

// @invalid
import { serialize } from 'next-mdx-remote'

// @invalid
import * as mdx from '@mdx-js/mdx'
const code = mdx.compileSync(source)
const out = Function(String(code))

// @valid
import { createProcessor } from '@mdx-js/mdx'

// @valid
import { evaluate } from './evaluate'

// @invalid
const { evaluate } = await import('@mdx-js/mdx')

// @valid
import { compile } from '@mdx-js/mdx'
const code = String(await compile(source))
writeFileSync(out, code)
