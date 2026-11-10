/**
 * AI contract: the public types of `partView`, `defineBlock` and `defineCatalog`. Types only,
 * no value symbols. Pinned by `check-contract-frozen`; a change needs a
 * `chore: contract amendment` commit. Sketched in docs/v3/concepts/ai-mdx.md section 4 (the
 * `basalt-ui/ai` block). `CatalogLike` lives in `src/core/ports.ts`.
 */
import type { FC, ReactNode } from 'react'
import type { Box, Phase } from '../core/ports'

// ---- Schema ---------------------------------------------------------------------------------

// Mirrors the Standard Schema spec (and `src/register.ts`) so any schema library's result unifies;
// declared here because a pinned contract cannot import 2.x implementation files.
export type SchemaIssue = {
  readonly message: string
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined
}

export type StandardSchemaV1<Input = unknown, Output = Input> = {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown,
    ) =>
      | { readonly value: Output; readonly issues?: undefined }
      | { readonly issues: readonly SchemaIssue[] }
      | Promise<
          | { readonly value: Output; readonly issues?: undefined }
          | { readonly issues: readonly SchemaIssue[] }
        >
    readonly types?: { readonly input: Input; readonly output: Output } | undefined
  }
}

/** The validated output type of a schema. */
export type Infer<S extends StandardSchemaV1> = NonNullable<S['~standard']['types']>['output']

// ---- Parts and events -----------------------------------------------------------------------

// minimal; concept elides it. Every `ai` `UIMessage['parts']` member must be assignable (spike P4).
export type MessagePart =
  | { type: 'text'; text: string; state?: 'streaming' | 'done' }
  | { type: 'reasoning'; text: string; state?: 'streaming' | 'done' }
  | {
      type: `tool-${string}`
      toolCallId: string
      state: string
      input?: unknown
      output?: unknown
      errorText?: string
    }
  | {
      type: 'dynamic-tool'
      toolName: string
      toolCallId: string
      state: string
      input?: unknown
      output?: unknown
      errorText?: string
    }
  | { type: 'file'; mediaType: string; url: string; filename?: string }
  | { type: 'step-start' }
  | { type: `data-${string}`; id?: string; data: unknown }

// minimal; concept elides it
export type BlockEvent = { block: string; type: string; payload?: unknown }

export type ToolView = {
  state: 'pending' | 'running' | 'awaiting-approval' | 'done' | 'error' | 'denied'
  name: string
  args: unknown
  result?: unknown
  error?: string
}

/** `contentTrust` is pinned to `'untrusted'`. */
export type PartViewOptions = {
  settled?: boolean
  catalog?: Catalog
  toolRenderers?: Record<string, (v: ToolView) => ReactNode>
  onBlockEvent?(e: BlockEvent): void
}

// ---- Blocks and catalog ---------------------------------------------------------------------

/** The `defineBlock` argument. */
export type DefineBlockOptions<S extends StandardSchemaV1> = {
  name: string
  description: string
  props: S
  /** Always enforced; a default applies when omitted. */
  limits?: { maxBytes: number; maxDepth: number }
  sample: readonly Infer<S>[]
  render: (p: Infer<S>, box: Box) => ReactNode
  /** Escape rung: a layout block composing several composites; single composites own their phase heights. */
  reserve?: number
}

/** Product of `defineBlock`; exposes name, props (the schema) and sample. */
export type Block<S extends StandardSchemaV1 = StandardSchemaV1> = Omit<
  DefineBlockOptions<S>,
  'render'
> & {
  // a method, so a `Block<ZodObject>` is assignable to `Block` in `defineCatalog`
  render(p: Infer<S>, box: Box): ReactNode
}

// minimal; concept elides it
export type Resolved = { name: string; props: unknown }

export type BlockComponentProps = {
  spec: unknown
  phase: Phase
  onEvent?: (e: BlockEvent) => void
}

/** `Block` wraps the boundary, the composite's phase skeleton and a quiet "could not be displayed". */
export type Catalog = {
  blocks: readonly Block[]
  /** The error text is model-readable and ends in advice. */
  validate(x: unknown): { ok: true; block: Resolved } | { ok: false; error: string }
  Block: FC<BlockComponentProps>
}
