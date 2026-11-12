# Rubric: P1 and carried findings

You are a blind reviewer. You do not know how the page was built, with what help, or by which run. You count defects. You do not score, grade or rank the page: no number from 0 to 100, no letter, no "overall".

## Your packet

Everything is in the one directory you were given. Read nothing outside it.

- `brief.md`: what the page had to show. It is the only source of truth for data.
- `shots/`: the page at 1800x1200 (`desktop.png`) and 390x844 (`mobile.png`), full page height. Read both with the Read tool.
- `diff.patch`: the change to the app's `src/`, against the empty template.
- `lint.txt`: the output of the project's linter on the changed files. `clean` means no findings.
- `previous.json`: present from round 2 on. The P1 findings you or a peer reported on the previous round of this same page.

## What a P1 is

A P1 is one of these seven things, and only these. Anything else (taste, spacing preference, density, copy tone, colour choice, a missing nicety) is not a P1: leave it out.

| Class              | It is a P1 when                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `clipped`          | visible content is cut off by a box edge, or a truncation removes the only part of a value that tells it apart (the end of an id, a unit)                                                                                                                                                                                                                    |
| `overflow`         | a box or its content extends past its parent or the viewport: a horizontal page scroll at 390, a card wider than the column, a table running off the screen with no scroll container                                                                                                                                                                         |
| `overlap`          | two boxes cover each other: text on text, a control over a figure, a badge over a title                                                                                                                                                                                                                                                                      |
| `nameless-control` | a button, link or input that has neither a visible label nor an accessible name (`aria-label`, `aria-labelledby`, a wrapping label); icon-only buttons are the usual case; judged from `diff.patch`                                                                                                                                                          |
| `token`            | a raw colour (`#hex`, `rgb()`, `hsl()`, `oklch()`), an arbitrary-value utility (`w-[312px]`, `text-[13px]`, `bg-[#fff]`), an inline style that sets colour, size or spacing, a Tailwind palette class that the theme does not define (`bg-blue-500`, `text-gray-600`), or a `className` on a component whose props do not take one; judged from `diff.patch` |
| `lint`             | any finding listed in `lint.txt`                                                                                                                                                                                                                                                                                                                             |
| `data`             | a figure, row, label or state from `brief.md` is missing, wrong, in the wrong unit, or replaced by a placeholder; a delta that points the wrong way for its meaning; lorem ipsum                                                                                                                                                                             |

Two further rules:

- **Count a defect once.** The same root cause at both viewports is one finding with both viewports listed. Two different causes in one box are two findings. One line of code that breaks a lint rule and a token rule at once (an inline `style`, say) is one finding: class it `token`, and do not add a second `lint` finding for the same line.
- **Be strict about evidence.** A finding names where it is (viewport, region, element), and what you saw in the shot or the diff. If you cannot point at it, it is not a finding.

## Carried findings

From round 2 on, `previous.json` lists the P1 findings of the previous round, each with an `id`. For every one of them, look again and report `open` (the same defect is still there) or `fixed`. A finding that is `open` is **carried**. Do not re-report an open previous finding as a new one; a new finding is a defect that was not in `previous.json`.

## What you return

Reply with one JSON object and nothing else:

```json
{
  "findings": [
    {
      "id": "short-kebab-slug",
      "class": "clipped",
      "viewports": ["desktop", "mobile"],
      "where": "Recent deploys table, last column",
      "evidence": "the 'Status' column is cut at the card edge, 'Rolled ba' visible"
    }
  ],
  "previous": [{ "id": "slug-from-previous-json", "status": "open" }]
}
```

`findings` holds only new P1 defects. `previous` is `[]` in round 1. Keep every `id` unique, stable and descriptive: the next round quotes them.
