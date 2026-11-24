import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SiteRelease } from "basalt-ui/static";

// The build runs from apps/marketing (the Dockerfile and `bun run build`); the bundled page has no source URL to go by.
const CHANGELOG = join(process.cwd(), "../../packages/basalt-ui/CHANGELOG.md");

/** A commit line of the generated changelog without its trailing commit link, its markdown marks and its scope bold. */
const plain = (line: string): string =>
  line
    .replace(/\s*\(\[[0-9a-f]{7,}\]\([^)]*\)\)\s*$/, "")
    .replaceAll("`", "")
    .replaceAll("**", "");

/**
 * The newest `count` releases of the package's CHANGELOG.md (semantic-release's format: a `#` or `##`
 * heading per version with its compare link and day, a `###` group per kind, a `*` line per commit).
 */
export function releases(count: number): SiteRelease[] {
  const found: SiteRelease[] = [];
  let release: SiteRelease | undefined;
  let items: string[] | undefined;
  for (const line of readFileSync(CHANGELOG, "utf8").split("\n")) {
    const heading = /^#{1,2} \[?([\w.-]+)\]?(?:\(([^)]*)\))? \((\d{4}-\d{2}-\d{2})\)/.exec(line);
    if (heading !== null) {
      if (found.length === count) break;
      release = {
        version: heading[1] ?? "",
        date: heading[3] ?? "",
        ...(heading[2] && { href: heading[2] }),
        groups: [],
      };
      found.push(release);
      items = undefined;
      continue;
    }
    const group = /^### (.+)/.exec(line);
    if (group !== null && release !== undefined) {
      items = [];
      (release.groups as { label: string; items: string[] }[]).push({
        label: group[1] ?? "",
        items,
      });
      continue;
    }
    if (line.startsWith("* ") && items !== undefined) items.push(plain(line.slice(2)));
  }
  return found;
}
