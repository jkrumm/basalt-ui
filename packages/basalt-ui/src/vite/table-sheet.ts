/**
 * The table tier sheet `basalt()` adds to an app: a module that imports `basalt-ui/table` gets
 * `import 'basalt-ui/table.css'` appended, so the app never imports it. Its own module so a bundle
 * built without Vite (the quality matrix's `Bun.build`) applies the same rule.
 */
/** An app module's import of the table subpath (static, dynamic or re-export), not `table.css`. */
const TABLE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]basalt-ui\/table['"]/
const TABLE_SHEET_IMPORT = /['"]basalt-ui\/table\.css(?:\?[^'"]*)?['"]/
const TABLE_SHEET = "\nimport 'basalt-ui/table.css';\n"
const SCRIPT_ID = /\.[cm]?[jt]sx?$/

/** The module's code with the tier sheet imported, or null when it needs no change. */
export function withTableSheet(code: string, id: string): string | null {
  if (id.includes('/node_modules/') || !SCRIPT_ID.test(id.split('?')[0] ?? id)) return null
  if (!TABLE_IMPORT.test(code) || TABLE_SHEET_IMPORT.test(code)) return null
  return code + TABLE_SHEET
}
