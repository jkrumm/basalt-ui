// Blocks: see ../structure-rest/colour-literal.tsx.

// @invalid
import rehypeRaw from 'rehype-raw'

// @invalid
const raw = require('rehype-raw')

// @invalid
const raw = await import('rehype-raw')

// @valid
import rehypeSanitize from 'rehype-sanitize'

// @valid
import { Markdown } from 'basalt-ui/content'

// @invalid
import remarkRehype from 'remark-rehype'
const plugins = [[remarkRehype, { allowDangerousHtml: true }]]

// @valid
import remarkRehype from 'remark-rehype'
const plugins = [[remarkRehype, { footnoteLabel: 'Notes' }]]

// @valid
import remarkRehype from 'remark-rehype'
const plugins = [[remarkRehype, { allowDangerousHtml: false }]]

// @valid
const plugins = [[other, { allowDangerousHtml: true }]]
