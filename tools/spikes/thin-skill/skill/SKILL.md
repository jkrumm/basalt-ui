---
name: basalt-design
description: Build or restyle a page in a basalt-ui app: pick the composite, read its generated doc, compose with theme tokens, then check the page at 1800 and 390 before calling it done.
when_to_use: The user asks for a dashboard, list, detail or settings page, or says a UI looks inconsistent or generic.
---

Method only. Props live in the generated docs (`node_modules/basalt-ui/docs/<name>.md`) and the shipped `.d.ts`; this file never restates them. Draft for the thin-skill spike.

## Steps

1. **Question first.** Before any code, write three lines in your head or your reply: who opens this page, the one question it answers, the figures that answer it. A page that cannot name its question is a list of boxes.
2. **Pick the part, then read its doc.** Headline figure with change and verdict: `StatCard` from `basalt-ui/cards`. Rows of records: `Table` from `basalt-ui/ui/table`. Labelled inputs: `Field`, `FieldLabel`, `FieldDescription`, `FieldError` from `basalt-ui/ui/field` around an `Input`. Actions: `Button`. Status words: `Lozenge`; counts: `CountBadge`. Open `node_modules/basalt-ui/docs/<name>.md` for the part you use before you write its props. A figure that fits no part is reported to the user, not faked with a hand-built box.
3. **Compose with tokens only.** Colours, radii, type sizes and shadows come from the theme utilities (`bg-card`, `text-muted-foreground`, `border-border`, `rounded-card`, `text-sm`, `shadow-card`). The theme removes the default Tailwind palette, so `bg-blue-500` produces nothing. Spacing uses the 4 px scale. No hex, no `[...]` arbitrary values, no inline `style` for colour or size. Never pass `className` to a part that does not take one; wrap it in your own layout element instead.
4. **Layout answers the question.** Lead with the figures, then the evidence (table or list), then the actions. Page title names the subject and its scope ("Engineering overview, October"), followed by one sentence that carries a live number. Grids use `grid-cols-1` on phones and `md:` and `xl:` steps up (breakpoints are 840 and 1200). Read `anti-defaults.md` before round 1.
5. **Check before you stop.** Build (`bun run build`) and typecheck (`bun run typecheck`). Then read your own page at 1800 wide and at 390 wide against `anti-defaults.md`: every figure from the brief is on the page, nothing is cut, nothing wider than 390, every icon-only control has an `aria-label`, every input has a label. Fix at the source, rebuild, look again.
