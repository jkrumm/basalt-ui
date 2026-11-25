import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

import { declarations, offPalette } from "./docs-palette";

const bridge = readFileSync(
  new URL("../../../packages/basalt-ui/src/css/starlight.css", import.meta.url),
  "utf8",
);

// Every token the shipped sheets declare: a bridge value naming anything else paints as unset.
const cssDir = new URL("../../../packages/basalt-ui/src/css/", import.meta.url);
const shipped = readdirSync(cssDir)
  .filter((name) => name.endsWith(".css") && name !== "starlight.css")
  .map((name) => readFileSync(new URL(name, cssDir), "utf8"));

// Fixtures need literal hex colors; building them keeps the color-literal lint about the site's own code.
const hex = (digits: string): string => `#${digits}`;
const WHITE = hex("fff");
const SLATE = hex("24292e");
const NAVY = hex("123456");
const TOKENS = ":root { --basalt-ink: 1; --basalt-inset: 1 }";
const check = (sheets: string[]): string[] => offPalette(sheets, [TOKENS]);

describe("declarations", () => {
  test("marks what sits inside an @layer block, however deep", () => {
    const found = declarations(
      `@layer a, b; @layer a { @media (min-width: 50em) { :root { --x: ${WHITE} } } } :root { --y: var(--basalt-ink); --z: url("data:image/svg+xml;utf8,<svg/>") }`,
    );
    expect(found).toEqual([
      { prop: "--x", value: WHITE, layered: true },
      { prop: "--y", value: "var(--basalt-ink)", layered: false },
      { prop: "--z", value: 'url("data:image/svg+xml;utf8,<svg/>")', layered: false },
    ]);
  });
});

describe("offPalette", () => {
  test("a layered default is fine once an unlayered rule maps it to a token", () => {
    expect(
      check([
        `@layer starlight { :root { --sl-color-white: ${WHITE} } }`,
        ":root { --sl-color-white: var(--basalt-ink) }",
      ]),
    ).toEqual([]);
  });

  test("a layered color nothing overrides is a finding", () => {
    expect(check([`@layer starlight { :root { --sl-color-white: ${WHITE} } }`])).toEqual([
      `--sl-color-white: ${WHITE} (color literal)`,
    ]);
  });

  test("an Expressive Code color counts by its value, a size does not", () => {
    const layered = `@layer ec { .expressive-code { --ec-codeBg: ${SLATE}; --ec-brdWd: 1px } }`;
    expect(check([layered])).toEqual([`--ec-codeBg: ${SLATE} (color literal)`]);
    expect(check([layered, ".expressive-code { --ec-codeBg: var(--basalt-inset) }"])).toEqual([]);
  });

  test("an override that is itself a literal or a named color still fails", () => {
    expect(
      check([
        ":root { --sl-color-text: hsl(var(--sl-hue), 10%, 20%) }",
        ".expressive-code { --ec-tm-lineMarkerLabelCol: white }",
      ]),
    ).toEqual([
      "--sl-color-text: hsl(var(--sl-hue), 10%, 20%) (color literal, unknown variable --sl-hue)",
      "--ec-tm-lineMarkerLabelCol: white (color literal)",
    ]);
  });

  test("a chain through another variable resolves only when that one reaches a token", () => {
    const ok = ":root { --sl-color-a: var(--basalt-ink); --sl-color-b: var(--sl-color-a) }";
    expect(check([ok])).toEqual([]);
    const bad = `:root { --sl-color-a: ${NAVY}; --sl-color-b: var(--sl-color-a) }`;
    expect(check([bad])).toEqual([
      `--sl-color-a: ${NAVY} (color literal)`,
      "--sl-color-b: var(--sl-color-a) (color literal)",
    ]);
  });

  test("a token nothing declares is a finding", () => {
    expect(
      check([":root { --sl-color-a: var(--basalt-ink); --sl-color-b: var(--basalt-nope) }"]),
    ).toEqual(["--sl-color-b: var(--basalt-nope) (undefined token --basalt-nope)"]);
  });

  test("an icon data URI is no color", () => {
    expect(check([".x { --ec-frm-copyIcon: url(\"data:image/svg+xml,stroke='black'\") }"])).toEqual(
      [],
    );
  });
});

describe("basalt-ui/starlight.css", () => {
  test("maps every variable it declares to a token", () => {
    expect(offPalette([bridge], shipped)).toEqual([]);
  });

  test("names only tokens the shipped sheets declare", () => {
    const declared = new Set(shipped.flatMap(declarations).map((d) => d.prop));
    const named = new Set(bridge.match(/--basalt-[\w-]+/g));
    expect([...named].filter((name) => !declared.has(name))).toEqual([]);
  });

  test("declares the colors Starlight ships in light and dark, unlayered", () => {
    const props = new Set(
      declarations(bridge)
        .filter((d) => !d.layered)
        .map((d) => d.prop),
    );
    for (const prop of [
      "--sl-color-white",
      "--sl-color-black",
      "--sl-color-accent",
      "--sl-color-text-accent",
      "--sl-color-bg",
      "--sl-color-hairline",
      "--ec-codeBg",
      "--ec-frm-frameBoxShdCssVal",
    ]) {
      expect(props.has(prop)).toBe(true);
    }
  });
});
