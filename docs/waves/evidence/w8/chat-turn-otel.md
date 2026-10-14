# W8 — one chat turn's OTel trace

Lane `chat-turn-trace` (`scripts/evidence/chat-turn-trace.ts`), `LABEL=w8-after`. The playground is built
with `VITE_TELEMETRY=1`; `telemetry.ts` maps each `BasaltEvent` to a span; the in-process OTLP receiver
collects them. Starts are relative to the first span of the run. Raw detail: `.evidence/w8-after/chat-turn-trace.json`.

## OK turn (`/` → `/agent` → Stream → send)

| #   | Span             | start   | duration  | failed |
| --- | ---------------- | ------- | --------- | ------ |
| 1   | `route.navigate` | 0 ms    | 146.3 ms  | no     |
| 2   | `route.navigate` | 1343 ms | 33.6 ms   | no     |
| 3   | `chat.turn`      | 1482 ms | 5860.6 ms | no     |

`route.navigate` #1 (initial load) and #2 (the click to `/agent`, immediately before the turn):

| Attribute           | #1            | #2           |
| ------------------- | ------------- | ------------ |
| `basalt.route.id`   | `/dashboard/` | `/agent`     |
| `basalt.route.from` | `` (empty)    | `/dashboard` |
| `url.path`          | `/dashboard`  | `/agent`     |

`chat.turn` (ok):

| Attribute               | Value                                                       |
| ----------------------- | ----------------------------------------------------------- |
| `basalt.chat.thread_id` | `stream-demo`                                               |
| `basalt.chat.ttft_ms`   | 29                                                          |
| `basalt.chat.parts`     | 4 (reasoning, text, tool, text — deltas of one block merge) |
| `basalt.chat.status`    | `done`                                                      |

Span status is unset. `exception.type` / `basalt.error.kind` are absent, as the types require for `failed: false`.

## Forced failure (`/agent?fail=1`)

The demo's `failingTransport` streams three deltas, then throws an error carrying `statusCode: 500`
(AI SDK `APICallError` shape). One span, no `route.navigate` before it in this run (direct load of
`/agent?fail=1` so the param survives; the route span is covered by the ok run above).

| Attribute               | Value                                 |
| ----------------------- | ------------------------------------- |
| name / failed           | `chat.turn` / yes (span status ERROR) |
| duration                | 149.2 ms                              |
| `basalt.chat.thread_id` | `stream-demo`                         |
| `basalt.chat.ttft_ms`   | 41                                    |
| `basalt.chat.parts`     | 1                                     |
| `basalt.chat.status`    | `error`                               |
| `exception.type`        | `Error`                               |
| `basalt.error.kind`     | `http`                                |

`kind: 'http'` comes from `toAgentError` reading `statusCode`; the status itself and the error message
are deliberately not on the span (events carry ids, hashes, counts, durations only).

## Join key (V2-SPEC § 7 Open)

`chat.turn` is emitted after the turn settles, so it cannot parent the chat `fetch` span. The join is
`basalt.chat.thread_id` (`stream-demo` above), which the server-side span (argo's
`hermes.stream-lifecycle`) must carry under the same value. The playground mock has no server, so the
join is shown by the attribute, not by a cross-service query. Time-window correlation works as a fallback:
`chat.turn` start + duration brackets the stream.

The `otel` lane is unchanged: it navigates only, so a `spans.chat.turn` row there would be a constant 0.
