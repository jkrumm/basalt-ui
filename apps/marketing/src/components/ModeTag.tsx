import { Lozenge } from "basalt-ui/ui/badge";
import type { ReactElement } from "react";

const MODE = {
  static: { tone: "good", word: "Static", hint: "HTML and CSS only" },
  enhanced: { tone: "info", word: "Enhanced", hint: "works as HTML, a script adds behavior" },
  island: { tone: "neutral", word: "Island", hint: "needs its script" },
} as const;

/** The mark a part of a guide carries: what it ships to the reader. Rendered to HTML, no directive. */
export function ModeTag({ mode }: { mode: keyof typeof MODE }): ReactElement {
  const { tone, word, hint } = MODE[mode];
  return (
    <Lozenge tone={tone} title={hint}>
      {word}
    </Lozenge>
  );
}
