---
source: basalt-ui
description: The adapter batteries — query, forms, commands, table, content, agent. Use the shipped seam.
paths:
  - 'src/**'
  - 'apps/**/src/**'
  - '**/vite.config.ts'
---

<!-- basalt:coverage -->
<!-- GENERATED from src/surfaces.ts — `bun scripts/check-coverage.ts --write`. Do not hand-edit. -->
<!-- backed by: guard kinds — none · oxlint rules — basalt/agent-no-raw-usechat, basalt/ai-sdk-major, basalt/forms-field-key, basalt/query-fn-unwrap -->
<!-- not guarded: — -->
<!-- /basalt:coverage -->

# Basalt Batteries

Every peer is optional; install it before importing its subpath.

## Query

- Wrap every `queryFn` response in `unwrap()`; it throws on the error branch and on `null` data. [basalt/query-fn-unwrap]
- Build the client with `createBasaltRouter` (extend via its `query:` option); never construct a second `QueryClient`. [type createBasaltRouter]

## Forms

- A field is two calls: `key={fieldKey(form, path)}` and `{...inputProps(form, path)}`, from `basalt-ui/forms`. [basalt/forms-field-key]
- `useBasaltForm` takes a Standard Schema validator, not a `ZodSchema`. [type useBasaltForm]

## Table

- Tables are `BasaltDataTable` with the `createColumnHelper` from `basalt-ui/table`. [type BasaltDataTable]

## Content

- Render model or agent output with `contentTrust="untrusted"`; `streaming` is a rendering mode, not a trust claim. [type Markdown]

## Agent

- Chat uses `basalt-ui/agent` (`useAgentThreadRuns`, `ThreadFeed`, `Composer`); never `useChat` or `Chat` from `@ai-sdk/react`. [basalt/agent-no-raw-usechat]
- Keep `ai` and `@ai-sdk/*` on one major across packages. [basalt/ai-sdk-major]
- End every switch over `AgentPart` with `default: return part satisfies never`. [type AgentPart]
- An intentional `ai` major split is waived with `basalt-agent-allow`, never `theme-allow`. [basalt/ai-sdk-major]
