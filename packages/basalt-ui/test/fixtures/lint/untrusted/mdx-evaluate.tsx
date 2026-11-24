// Blocks: see ../structure-rest/color-literal.tsx.

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
const run = new Function('return 1')

// @invalid
import { MDXRemote } from 'next-mdx-remote/rsc'

// @invalid
import { serialize } from 'next-mdx-remote'

// @invalid
import * as mdx from '@mdx-js/mdx'
const code = mdx.compileSync(source)
const out = Function('return 1')

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

// @invalid
import { MDXRemote } from 'next-mdx-remote-client'

// @invalid
import { MDXRemote } from 'next-mdx-remote-client/rsc'

// @invalid
const mod = await import('next-mdx-remote-client/csr')

// @valid
import { other } from 'next-mdx-remote-clients'

// @invalid
import { getMDXComponent } from 'mdx-bundler/client'

// @valid
import { bundleMDX } from 'mdx-bundler'

// @invalid
const out = new Function(code)()

// @invalid
const out = Function('props', props.source)

// @invalid
const out = eval(props.source)

// @valid
const out = eval('1 + 1')

// @valid
const out = new Function('a', 'b', 'return a + b')
