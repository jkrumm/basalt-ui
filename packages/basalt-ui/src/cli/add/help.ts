/** `basalt-ui add --help`; `docs/add.md` is generated from it (`renderAddDoc`) and a test pins the two. */

export const ADD_HELP = `Usage: basalt-ui add <block>… [--dir <path>] [--app <root>]
       basalt-ui add --list

Copies a block, a product-shaped page the package ships as source, into the app. The app owns the
copy and edits it; sync carries the block's upstream changes into it with a three-way merge.

add <block> writes:
  <root>/blocks/<block>/<file>             every file of the block, byte for byte
  .basalt/base/<root-dashed>/blocks/<block>/<file>  the merge base sync merges against
  .basalt/manifest.json                    ejected["<root>#block:<block>"] = { origin: "block", path, files, fromVersion, seedDigest }
and prints the block's ports (the props and exports the app wires) and any peer it imports that
package.json does not declare. A block imports only published basalt-ui specifiers, its peers and its
own files, so it compiles where it lands. Its data comes in through those ports; nothing is fetched.

--list            One line per shipped block: name, archetype, summary.
--dir <path>      Installs into <path> (relative to where you run it) instead of <root>/blocks/<block>.
                  One block per run.
--app <root>      Required when the manifest declares 2+ roots; names one of them.

sync merges a block whose shipped files changed, file by file: an unedited file takes the new
bytes, an edited one is merged three ways (diff3 markers on a conflict, exit 1, the base advanced),
a new file is added, a file the block dropped stays in the app untracked, a file you deleted stays
deleted. Blocks do not count against the ejects ceiling.

Exits 1, writing nothing, when: a flag is unknown; a name is not a shipped block or is already
added in the root; any target file exists (add never overwrites: move it away or pass --dir).

A block that two apps run unchanged is promoted to a composite on an npm subpath.
`

export function renderAddDoc(): string {
  return `# basalt-ui add\n\nGenerated from \`basalt-ui add --help\`; edit \`src/cli/add/help.ts\`.\n\n\`\`\`text\n${ADD_HELP}\`\`\`\n`
}
