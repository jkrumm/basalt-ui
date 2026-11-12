/**
 * `basalt-ui/stylelint` — the closed D0 stylelint preset (tooling, no app bundle). The default export
 * is the config an app extends. The CLI renders the same config to `.stylelintrc.basalt.json` through
 * `./render`, which is internal (the public value-symbol budget has no room for it).
 * Peers: stylelint 18, postcss-html.
 */
import { stylelintConfig } from './render'

// oxlint-disable-next-line import/no-default-export -- stylelint reads the default export of an `extends` module
export default stylelintConfig()
