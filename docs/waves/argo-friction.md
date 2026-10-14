# argo friction ledger

Every place argo hits basalt-ui during its 2.0 migration and the loop after it (`PLAN.md` W12–W14).
argo never works around basalt: a row here blocks its argo step until a basalt-ui 2.x minor fixes it.
The W14 loop takes the open rows in batches.

Severity: **blocker** (argo cannot proceed), **workaround** (argo could proceed only by working around
basalt; it does not), **papercut** (proceeds, but the API, doc, lint message or skill misled).

| #   | argo wave / step | What argo hit | Workaround NOT taken | Severity | basalt-ui fix (PR, version) | Status |
| --- | ---------------- | ------------- | -------------------- | -------- | --------------------------- | ------ |
