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

// @valid
import { compile } from '@mdx-js/mdx'

// @valid
import { MDXRemote } from 'next-mdx-remote/rsc'

// @valid
import { evaluate } from './evaluate'

// @invalid
const { evaluate } = await import('@mdx-js/mdx')
