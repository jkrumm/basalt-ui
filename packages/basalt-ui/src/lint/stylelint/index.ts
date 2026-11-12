/**
 * `basalt-ui/stylelint` — the closed D0 stylelint preset (tooling, no app bundle). The default export
 * is the config an app extends; `renderStylelintConfig` produces the `.stylelintrc.basalt.json` text.
 * Peers: stylelint 18, postcss-html.
 */
import { stylelintConfig } from './render'

export { renderStylelintConfig } from './render'

// oxlint-disable-next-line import/no-default-export -- stylelint reads the default export of an `extends` module
export default stylelintConfig()
