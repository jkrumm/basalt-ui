Das ist ein sehr solider und sauberer Plan, der die Stärken von `release-it`, GitHub Actions und Bun kombiniert, ohne unnötige Komplexität.

Hier ist die finale, präzise Zusammenfassung und Konfiguration basierend auf deinen Anpassungen:

### 1. Identität & Paket
- **Name:** **Basalt UI**
- **NPM Paket:** **`basalt-ui`** (Unscoped, unter deinem User `jkrumm`)
- **Installation:** `npm install basalt-ui`
- **Lizenz:** Apache 2.0
- **Domain:** `basalt-ui.com` (Landing Page & Docs)
- **GitHub:** `jkrumm/basalt-ui`

### 2. Architektur (Bun Monorepo)
Bun Workspaces sind flexibel. Du kannst `apps` und `packages` nutzen, solange sie in der `package.json` unter `workspaces` definiert sind.

**Ordnerstruktur:**
```bash
basalt/
├── .github/
│   └── workflows/
│       └── publish.yml       # Deine Action
├── apps/                     # (Optionaler Ordnername, technisch auch "packages")
│   └── web/                  # Astro Landing Page
├── packages/
│   └── basalt-ui/            # Das npm Package
├── package.json              # Root Config ("workspaces": ["packages/*", "apps/*"])
├── .releaserc.js             # Release-it Config
└── bun.lockb
```

### 3. Der Release-Workflow (Trunk-Based)

**Der Flow:**
1.  **Entwicklung:** Du committest linear auf `main` (Trunk-Based).
2.  **Lokaler Release:** Wenn du bereit bist, führst du `bun run release` aus.
    *   `release-it` berechnet die neue Version basierend auf Commits (Conventional Commits).
    *   Es aktualisiert `package.json` & generiert `CHANGELOG.md` (gefiltert nach Pfad `packages/basalt-ui`).
    *   Es erstellt einen Git Commit & Git Tag.
    *   Es pusht alles zu GitHub und erstellt ein **GitHub Release**.
3.  **Deployment (CI):** GitHub Actions erkennt das neue **Release** und führt `bun publish` aus.

***

### 4. Konfigurationen

#### **A. Root `package.json`**
```json
{
  "name": "basalt-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "release": "release-it"
  },
  "devDependencies": {
    "release-it": "^17.0.0",
    "@release-it/conventional-changelog": "^8.0.0"
  }
}
```

#### **B. `.releaserc.js` (Im Root)**
Hier ist deine gewünschte Konfiguration mit Pfad-Filterung und ohne NPM-Publish (das macht die Action):

Eigene Notiz: In einem anderen Projekt hatte ich die release-it und darin : "plugins": {"@release-it/conventional-changelog": { direkt in der package.json das fand ich eigentlich cleaner. 
da hatte ich auch noch folgende hooks:
```"hooks": {
"before:init": "git pull",
"after:release": [
"git pull",
"echo Successfully released ${name} v${version} to ${repo.repository}."
]
}```

```javascript
module.exports = {
  git: {
    requireBranch: 'main',
    commitMessage: 'chore: release v${version}',
    tagName: 'v${version}',
    requireCleanWorkingDir: true,
    push: true,
  },
  github: {
    release: true,
    releaseName: 'v${version}',
    // Token muss lokal als GITHUB_TOKEN env var verfügbar sein
  },
  npm: {
    publish: false, // WICHTIG: Das macht die GitHub Action
    versionArgs: ['--workspaces-update=false'], // Verhindert Probleme im Monorepo
  },
  plugins: {
    '@release-it/conventional-changelog': {
      preset: 'conventionalcommits',
      infile: 'packages/basalt-ui/CHANGELOG.md', // Changelog im Paket selbst
      gitRawCommitsOpts: {
        path: 'packages/basalt-ui' // NUR Commits, die diesen Pfad berühren
      }
    }
  },
  hooks: {
    // Sicherstellen, dass die Version im korrekten Unterordner gesetzt wird
    'before:bump': 'cd packages/basalt-ui && bun version ${version} --no-git-tag-version' 
    // Hinweis: release-it bumped normalerweise root. Da wir ein Single-Package releasen wollen, 
    // müssen wir sicherstellen, dass packages/basalt-ui/package.json die neue Version bekommt.
    // Alternativ: release-it direkt im packages/basalt-ui Ordner ausführen.
  }
};
```

*Korrektur-Hinweis:* Am einfachsten ist es oft, `release-it` **direkt im Package-Ordner** auszuführen, wenn es nur ein Paket gibt. Wenn du es vom Root ausführst, musst du sicherstellen, dass die `package.json` in `packages/basalt-ui` aktualisiert wird (siehe `hooks` oben).

Hatte auch so irgendwie dann immer schön in den Changelog und release einträgen alles nach commit art gesplittet:

```json
"plugins": {
      "@release-it/conventional-changelog": {
        "infile": "CHANGELOG.md",
        "preset": {
          "name": "conventionalcommits",
          "types": [
            {
              "type": "feat",
              "section": "Features"
            },
            {
              "type": "fix",
              "section": "Bug Fixes"
            },
            {
              "type": "docs",
              "section": "Documentation"
            },
            {
              "type": "style",
              "section": "Styling"
            },
            {
              "type": "test",
              "section": "Tests"
            },
            {
              "type": "perf",
              "section": "Performance"
            },
            {
              "type": "build",
              "section": "Build System"
            },
            {
              "type": "refactor",
              "section": "Refactor"
            },
            {
              "type": "ci",
              "section": "Continuous Integration"
            },
            {
              "type": "revert",
              "section": "Reverts"
            },
            {
              "type": "chore",
              "section": "Other Changes"
            },
            {
              "type": "wip",
              "hidden": true
            }
          ]
        }
      }
    }
```

#### **C. GitHub Action (`.github/workflows/publish.yml`)**
Deine Action sieht gut aus. Hier ist sie verfeinert für Bun Publish im Unterordner:

```yaml
name: Publish Package to npm

on:
  release:
    types: [published] # Feuert, wenn das Release in GitHub "publiziert" wird

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write # Für Provenance (optional)

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Publish to npm
        working-directory: ./packages/basalt-ui # WICHTIG: In den Ordner wechseln
        run: |
          echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" > .npmrc
          bun publish --non-interactive --access public
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Zusammenfassung

Du hast jetzt ein Setup, das:
1.  **Sauber filtert:** Nur Änderungen am Code landen im Changelog.
2.  **Automatisiert:** Keine manuellen Version-Bumps.
3.  **Sicher ist:** NPM Token lebt nur in GitHub Secrets, nicht lokal.
4.  **Informativ ist:** GitHub Releases dienen als deine "Release Notes" (npm zeigt nur die Readme).

Das ist der Weg. **Go build Basalt!** 🚀

-----

Yes, you can add a pre-commit hook that runs Biome to format and lint your staged files before they are committed.

Given your setup with Bun and Biome, the most efficient way is to use **Lefthook** or **Husky**. Lefthook is highly recommended for Bun monorepos because it is a single binary (written in Go) that is extremely fast and handles monorepo root/workspace logic natively.

Here is how to set it up at the **root** level (keeping your workspaces clean).

### Option 1: The "Cleanest" & Fastest Way (Lefthook)
Lefthook is widely preferred in the Bun ecosystem over Husky because it has no dependencies on Node.js internals and is faster.

**1. Install Lefthook at the Root**
```bash
bun add -D lefthook
```

**2. Initialize the Config**
Create a `lefthook.yml` file in your root directory:

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    biome-check:
      glob: "*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}"
      run: bunx @biomejs/biome check --write --no-errors-on-unmatched {staged_files} && git update-index --again
```

**3. Enable the Hooks**
Run this once to install the git hooks:
```bash
bunx lefthook install
```

**Why this is better:**
*   It only runs on staged files (`{staged_files}`).
*   It formats (`--write`) and lints in one pass.
*   `--no-errors-on-unmatched` prevents it from failing if you commit a file Biome doesn't care about (like a `.md` or image).
*   `git update-index --again` ensures the formatted changes are included in the commit.

***

### Option 2: The "Classic" Way (Husky + Biome Native)
If you prefer the standard Husky approach, Biome actually has a built-in flag `--staged` (since v1.7) that removes the need for `lint-staged`.

**1. Install Husky**
```bash
bun add -D husky
bunx husky init
```

**2. Configure the Hook**
Edit the `.husky/pre-commit` file to look like this:

```bash
# .husky/pre-commit
bunx @biomejs/biome check --write --staged --no-errors-on-unmatched
```

**Note:** This uses Biome's native ability to check only staged files, which is much faster and simpler than installing and configuring the separate `lint-staged` package.

### Which one should you choose?
*   **Go with Option 1 (Lefthook)** if you want the "Bun-native" feel. It's cleaner, faster, and handles monorepo file paths better if you ever decide to have complex per-workspace rules.
*   **Go with Option 2 (Husky)** if you want the absolute minimum setup and don't want to learn a new config syntax (YAML).

Both options keep your workspace packages completely empty of dependencies.

[1](https://github.com/mugencraft/turbobun)
[2](https://dev.to/rezaowliaei/simplifying-code-quality-with-a-unified-biome-configuration-jah)
[3](https://betterstack.com/community/guides/scaling-nodejs/biome-eslint/)
[4](https://github.com/John-pels/monorepo-template)
[5](https://biomejs.dev/recipes/git-hooks/)
[6](https://www.horacioh.com/writing/setup-lint-staged-on-a-monorepo/)
[7](https://marketplace.visualstudio.com/items?itemName=fronterior.biome-monorepo)
[8](https://prettier.io/docs/precommit)
[9](https://biomejs.dev/guides/big-projects/)
[10](https://bun.com/docs/runtime/bunfig)
[11](https://blog.appsignal.com/2025/05/07/migrating-a-javascript-project-from-prettier-and-eslint-to-biomejs.html)
[12](https://www.reddit.com/r/learnjavascript/comments/1nqlwpr/huskylintstaged_issues_with_monorepo/)
[13](https://www.npmjs.com/package/@aiherrera%2Fcreate-turbo)
[14](https://kittygiraudel.com/2024/06/01/from-eslint-and-prettier-to-biome/)
[15](https://github.com/lint-staged/lint-staged)
[16](https://evilmartians.com/chronicles/5-cool-and-surprising-ways-to-configure-lefthook-for-automation-joy)
[17](https://www.gjensidige.builders/_/attachment/download/0fced6b6-251b-451a-9f0b-10ace2000765:5acfdb1363e920ccc2bc4d1b75a19e36bcee1036/slides-export.pdf)
[18](https://www.youtube.com/watch?v=Kr4VxMbF3LY)
[19](https://github.com/topics/lefthook?o=desc&s=updated)

--- 

Awesome choice. Enforcing Conventional Commits makes your git history much cleaner and enables automated changelogs later.

Since you liked the previous solution, here is how to add **Commitlint** to your stack. I'll stick with the **Lefthook** approach as it's the cleanest for your Bun monorepo, but I'll also include the Husky version just in case.

### Option 1: The Lefthook Way (Recommended)
This keeps everything in your single `lefthook.yml` file.

**1. Install Commitlint**
Add the CLI and the standard config to your root:
```bash
bun add -D @commitlint/cli @commitlint/config-conventional
```

**2. Create the Commitlint Config**
Create a `commitlint.config.js` (or `.ts` if you prefer) in your root:
```javascript
export default {
  extends: ["@commitlint/config-conventional"],
};
```

**3. Update Lefthook**
Add the `commit-msg` hook to your existing `lefthook.yml`.
*Note: The variable `{1}` represents the path to the file containing the commit message.*

```yaml
# lefthook.yml

# ... your existing pre-commit config ...

commit-msg:
  commands:
    commitlint:
      run: bunx commitlint --edit {1}
```

***

### Option 2: The Husky Way
If you chose Husky earlier, here is how to add the hook.

**1. Install Commitlint**
```bash
bun add -D @commitlint/cli @commitlint/config-conventional
```

**2. Create Config**
Same as above (`commitlint.config.js`).

**3. Add the Hook**
Create (or edit) `.husky/commit-msg`:
```bash
bunx commitlint --edit $1
```
*(Make sure the file is executable: `chmod +x .husky/commit-msg`)*

### How to test it?
Try to make a commit with a "bad" message:
```bash
git commit -m "fixed stuff"
# ❌ Failed: subject may not be empty, type may not be empty
```

Now try a valid one:
```bash
git commit -m "fix: resolve login page crash"
# ✅ Success!
```

### Tip: "I don't want to remember the syntax"
If you struggle to remember whether it's `feat:` or `chore:`, you can add a helper tool called **Commitizen**.
1. Run `bun add -D commitizen cz-conventional-changelog`
2. Add this to your `package.json`:
```json
"config": {
  "commitizen": {
    "path": "./node_modules/cz-conventional-changelog"
  }
}
```
3. Now instead of `git commit`, you can run `bunx cz`, and it will give you an interactive menu to build your commit message

[1](http://lefthook.dev/examples/commitlint.html)
[2](https://github.com/evilmartians/lefthook/discussions/947)
[3](https://commitlint.js.org/guides/local-setup.html)
[4](https://evilmartians.com/chronicles/5-cool-and-surprising-ways-to-configure-lefthook-for-automation-joy)
[5](https://engineering.exile.watch/march-2024/leveraging-lefthook-to-enforce-commit-guidelines-at-exile.watch)
[6](https://github.com/oven-sh/bun/issues/10691)
[7](https://commitlint.js.org)
[8](https://blog.tericcabrel.com/apply-conventional-commit-style-on-your-project-with-commitlint/)
[9](https://theodorusclarence.com/shorts/husky-commitlint-prettier)
[10](https://www.npmjs.com/package/commitlint-config-spellbookx)
[11](https://dev.to/matteuus/how-to-prevent-bad-commits-and-test-code-with-lefthook-and-integrate-with-flutter-1ni4)
[12](https://stackoverflow.com/questions/67074097/what-is-the-correct-way-to-add-commitlint-to-the-commit-msg-hook-in-husky)
[13](https://generalistprogrammer.com/tutorials/commitlint-config-conventional-npm-package-guide)
[14](https://blog.sangeeth.dev/notes/setting-up-pre-commit-hook-with-lefthook/)
[15](https://dev.to/fellipeutaka/automating-code-patterns-with-husky-pkp)
[16](https://stackoverflow.com/questions/76094224/issue-with-commitlint-please-add-rules-to-your-commitlint-config-js-error-d)
[17](https://www.freecodecamp.org/news/how-to-use-commitlint-to-write-good-commit-messages/)
[18](https://typicode.github.io/husky/)
[19](https://github.com/oven-sh/bun/issues/6184)
[20](https://peterabraham.com/article/how-to-install-commitlint-&-husky)