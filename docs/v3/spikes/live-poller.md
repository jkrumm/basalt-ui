# Spike: central poller versus per-observer timers (P1)

Six observers on one query key, each with `refetchInterval`, do not multiply fetches on Query 5.104.1 (argo's locked version) or 5.107.1: arm A starts exactly 1 fetch per interval, the same as the central poller. The multiplication argo's `gym.ts` documents does not occur; `liveQuery` returns `refetchInterval` as a function and the poller is not built.

Harness: `bun tools/spikes/live-poller/run.ts` (one JSON object on stdout, always exit 0). Concept: `docs/v3/concepts/live-realtime.md` section 7 P1, section 8 L2.

## Question

Do N observers of one query key, each carrying `refetchInterval`, start N staggered fetches per interval, as `apps/dashboard/src/lib/queries/gym.ts:46-52` says ("six staggered timers hitting `/gym` six times per interval instead of once")? If they do, a central poller (about 80 lines) is worth building. If extra fetches per interval are at most 1, it is dropped.

## Method

- Query: `@tanstack/query-core` 5.104.1 (argo's `bun.lock`, the lowest in the peer range `^5.104.0`) decides. 5.107.1 is the informational column. Both are exact pins in `tools/spikes/live-poller/package.json`, installed as aliases.
- Six `QueryObserver`s on one key, `staleTime` 5 s (argo's `GYM_POLL_MS`, matched to the poll), `refetchInterval` 5 s, a 300 ms virtual request. 60 s of virtual time: a fake scheduler through `timeoutManager.setTimeoutProvider` and `notifyManager.setScheduler`, `Date.now` patched. No real timer runs.
- Arm A: every observer has `refetchInterval: 5000`.
- Arm B: no observer has `refetchInterval`. A minimal central poller (about 23 lines in `run.ts`) listens for `observerAdded` / `observerRemoved` on the `QueryCache`, keeps an enabled-observer count per query hash, and runs one interval per hash that calls `refetchQueries` (focus-gated).
- `fetchesPerInterval` = fetches started in one interval across all six observers, the mean over the ten intervals from 10 s to 60 s (the first two are warmup: the last observer's first tick is at 9.7 s). `extraPerInterval` = that minus 1, a total, not per observer. `perInterval` lists all ten counts.
- Scenarios. `staggered` decides: the observers mount at 0, 1.1, 2.3, 3.1, 4.2 and 4.7 s, six distinct instants inside one interval, as a `WeightPopover` per set row mounts when the user adds a set. `staggeredConstant` returns the same payload every time. `aligned` mounts all six in one tick (the case argo's comment says collapses).
- Rule, fixed before measuring, on 5.104.1 `staggered`: `Poller: build` iff arm A `extraPerInterval` > 1 and arm B `fetchesPerInterval` is exactly 1 in every interval; else `Poller: drop`.
- One harness trap, found on the first run: Bun has no `window`, so Query's `isServer()` is true and it schedules no `refetchInterval` timer at all (arm A measured 0). The harness sets `environmentManager.setIsServer(() => false)`; the subject is the browser.

## Measurements

Run 1 and run 2 are byte-identical (`cmp`, sha256 prefix `34cc03a5f05dbb2b`). Run 1:

```json
{
  "spike": "live-poller",
  "config": {
    "observers": 6,
    "intervalMs": 5000,
    "fetchMs": 300,
    "durationMs": 60000,
    "warmupMs": 10000,
    "staggeredMountsMs": [0, 1100, 2300, 3100, 4200, 4700]
  },
  "decidedOn": "5.104.1",
  "versions": {
    "5.104.1": {
      "queryCore": "5.104.1",
      "perObserver": {
        "fetchesPerInterval": 1,
        "extraPerInterval": 0,
        "perInterval": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        "totalFetches": 12
      },
      "central": {
        "fetchesPerInterval": 1,
        "extraPerInterval": 0,
        "perInterval": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        "totalFetches": 13
      },
      "staggeredConstant": {
        "perObserver": {
          "fetchesPerInterval": 1,
          "extraPerInterval": 0,
          "perInterval": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          "totalFetches": 12
        },
        "central": {
          "fetchesPerInterval": 1,
          "extraPerInterval": 0,
          "perInterval": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          "totalFetches": 13
        }
      },
      "aligned": {
        "perObserver": {
          "fetchesPerInterval": 1,
          "extraPerInterval": 0,
          "perInterval": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          "totalFetches": 12
        },
        "central": {
          "fetchesPerInterval": 1,
          "extraPerInterval": 0,
          "perInterval": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          "totalFetches": 13
        }
      },
      "poller": "drop"
    },
    "5.107.1": {
      "queryCore": "5.107.1",
      "perObserver": {
        "fetchesPerInterval": 1,
        "extraPerInterval": 0,
        "perInterval": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        "totalFetches": 12
      },
      "central": {
        "fetchesPerInterval": 1,
        "extraPerInterval": 0,
        "perInterval": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        "totalFetches": 13
      },
      "staggeredConstant": {
        "perObserver": {
          "fetchesPerInterval": 1,
          "extraPerInterval": 0,
          "perInterval": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          "totalFetches": 12
        },
        "central": {
          "fetchesPerInterval": 1,
          "extraPerInterval": 0,
          "perInterval": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          "totalFetches": 13
        }
      },
      "aligned": {
        "perObserver": {
          "fetchesPerInterval": 1,
          "extraPerInterval": 0,
          "perInterval": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          "totalFetches": 12
        },
        "central": {
          "fetchesPerInterval": 1,
          "extraPerInterval": 0,
          "perInterval": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          "totalFetches": 13
        }
      },
      "poller": "drop"
    }
  },
  "poller": "drop"
}
```

| Scenario (arm A / arm B) | 5.104.1 fetches per interval | 5.107.1 fetches per interval | total fetches in 60 s |
| ------------------------ | ---------------------------- | ---------------------------- | --------------------- |
| `staggered`              | 1 / 1                        | 1 / 1                        | 12 / 13               |
| `staggeredConstant`      | 1 / 1                        | 1 / 1                        | 12 / 13               |
| `aligned`                | 1 / 1                        | 1 / 1                        | 12 / 13               |

Arm A `extraPerInterval` is 0 in every scenario on both versions. No interval holds a second fetch, in warmup either: 12 fetches in 60 s is one mount fetch plus 11 interval ticks.

Why arm A does not multiply. `Query.#dispatch` calls `observer.onQueryUpdate()` on every observer of the query (`build/modern/query.js`, the `notifyManager.batch` after the reducer), and `onQueryUpdate` ends in `#updateTimers()` (`queryObserver.js:426-428` in 5.104.1; the same lines in 5.107.1), which clears the observer's interval and starts a new one. Every fetch dispatches (`fetch` on start, `success` on resolve), so all six observers re-arm at the same instant each time a result lands. Staggered phases survive only until the first shared fetch completes. A throwaway two-observer probe (not part of `run.ts`), mounted at 0 and 1.1 s: fetches start at 0, 5300, 10600, 15900 ms, one every interval plus the 300 ms latency.

## Verdict

Poller: drop

On argo's locked version arm A `extraPerInterval` is 0, not above 1, so the rule gives `drop`. Arm B holds exactly 1 in all ten intervals, so a poller would be correct and also unneeded. 5.107.1 gives the same figures, so no difference goes into Then.

## Then

- Issue 1 builds `liveQuery` with `refetchInterval` as a function (the L2 fallback) and no `observerAdded` poller, no WeakMap runtime for it, and no poller half of the "bare `new QueryClient()` has no runtime" assert. The ~80 lines come out of the section 1 target of 600.
- Cadence is `every` after the last result, not a fixed grid: with a 300 ms request the period is 5.3 s (12 fetches in 60 s, the poller's 13). The skill text for `ticker` should say "`every` after the previous result".
- Argo's `useGymSync` comment ("six staggered timers ... six times per interval") and the mount-the-poll-once rule do not hold on 5.104.1 or 5.107.1 in the measured scenarios (same options on every observer, no error, a request shorter than the interval, a visible tab). That is a finding for the argo wave (G5) and for the "polling cadence repeated" row, not something this spike changes. The comment may predate a Query release or describe an unmeasured expectation; the harness cannot tell which.
- Not measured, so not claimed: observers on one key with different `refetchInterval` values, a request slower than the interval, a hidden tab (P1b), `enabled: false` observers, and a fetch that errors. P3 (`refetchInterval` per-observer behaviour on 5.107.1 and argo's version) is the place for the first two. The concept's "least active class wins" rule stands independently.

## Affects

- `docs/v3/concepts/live-realtime.md`: section 7 P1 (answered), section 10 L2 (alternative taken), section 1 (poller+liveQuery 150 lines target, section 3 `makeQueryClient` "also installs the poller", section 4 observers paragraph that counts enabled observers for the poller). Frozen here; changed by Issue 1.
- Issue 1 (`liveQuery` + P1 spike, then poller + P1b): the poller part is dropped.
- argo `gym.ts` / `useGymSync`: a comment correction, owned by the argo wave.
