import { generateRouteTree } from './src/codegen'

await generateRouteTree(import.meta.dirname, './src/route-tree.gen.ts')
process.stderr.write('wrote src/route-tree.gen.ts\n')
