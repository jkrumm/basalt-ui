/**
 * `basalt-ui/content` — `Markdown`, the one renderer for model and author text. The trust prop is
 * required; the untrusted arm shows no images and accepts no sanitize or rehype plugin additions.
 * Needs react-markdown, remark-gfm, rehype-sanitize and remend (all imported statically).
 */
export { Markdown } from './markdown'
export type { MarkdownProps } from './markdown'
