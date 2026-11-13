/**
 * `basalt-ui/lint` — the basalt oxlint JS plugin (tooling, no app bundle). Peers: none.
 *
 * The single aggregator of rule families: each family declares its ids in its own module and adds
 * one import and one entry to the families list here, one per line. Merging rejects an id declared
 * twice and a total above the ceiling. The subpath exports the plugin alone (no rule API is
 * public); package tooling reads the merged table off it through the factory module.
 */
import { createPlugin } from './factory'
import type { RuleTable } from './rule-table'
import { mergeTables } from './rule-table'
import { CLASS_RULES } from './rules/class/table'
import { importBoundaryRules } from './rules/structure/import-boundary'
import { primitiveBypassRules } from './rules/structure/primitive-bypass'

/** The rule families, one per line; a family adds its import and its entry and nothing else. */
const FAMILIES: readonly RuleTable[] = [CLASS_RULES, importBoundaryRules, primitiveBypassRules]

/** The plugin oxlint loads through `jsPlugins: ["basalt-ui/lint"]`; rules report as `basalt/<id>`. */
const plugin = createPlugin(mergeTables(FAMILIES))

// oxlint-disable-next-line import/no-default-export -- oxlint loads a JS plugin's default export
export default plugin
