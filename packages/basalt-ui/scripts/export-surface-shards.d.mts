/** Published subpath (`.`, `./tokens`, …) → sorted value export names. */
export type ShardSurface = Record<string, string[]>

export function shardName(subpath: string): string
export function shardFile(subpath: string): string
export function subpathOfShardFile(file: string): string | undefined
export function parseShards(files: Iterable<readonly [file: string, text: string]>): ShardSurface
export function readShards(dir: string): ShardSurface
export function serializeShard(names: readonly string[]): string
export function diffShards(expected: ShardSurface, actual: ShardSurface): string[]
