/**
 * Prints the peer classes of `surface-gates.ts` for `pack-test.sh`, so the shell never keeps a second
 * copy of the lists that the graph-side gate asserts (they cannot drift).
 *
 * Usage: bun scripts/surface-peers.ts required   one required peer name per line
 *        bun scripts/surface-peers.ts subpath    one subpath-required peer name per line (unique)
 *        bun scripts/surface-peers.ts own        JSON `{ "basalt-ui/<subpath>": [peers] }`
 */
import { REQUIRED_PEERS, SUBPATH_REQUIRED_PEERS } from './surface-gates'

const mode = process.argv[2]
if (mode === 'required') {
  console.log(REQUIRED_PEERS.join('\n'))
} else if (mode === 'subpath') {
  console.log([...new Set(Object.values(SUBPATH_REQUIRED_PEERS).flat())].join('\n'))
} else if (mode === 'own') {
  const own = Object.entries(SUBPATH_REQUIRED_PEERS).map(
    ([subpath, peers]) => [`basalt-ui/${subpath.slice(2)}`, peers] as const,
  )
  console.log(JSON.stringify(Object.fromEntries(own)))
} else {
  console.error('usage: surface-peers.ts required|subpath|own')
  process.exit(1)
}
