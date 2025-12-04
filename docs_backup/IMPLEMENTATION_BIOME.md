Yes, you can absolutely set up Biome this way.

In a Bun monorepo, you can centralize Biome entirely at the root so that your workspace packages have no `biome.json` files and no `devDependencies` related to Biome in their `package.json`.

Here is how to achieve a "clean" publishable package setup:

### 1. Install Biome Only at the Root
Run this command from your monorepo root. This adds Biome to your root `devDependencies` but leaves your workspaces untouched.

```bash
bun add --dev --exact @biomejs/biome
```

### 2. Create the Root Configuration
Initialize the configuration at the root:
```bash
bunx @biomejs/biome init
```

This creates a `biome.json` in your root folder. Because Biome's CLI automatically looks up the directory tree to find a configuration file, this single file will govern all your workspaces.[1][2]

### 3. Keep Your Workspace "Clean"
To ensure your publishable package remains clean, you simply **do nothing** inside `packages/your-library`.

*   **No `biome.json`:** You do not need to create this file in the workspace. Biome will find the root one.
*   **No Dependencies:** You do not need to add `@biomejs/biome` to the workspace's `package.json`.
*   **Publishing:** When you run `bun publish` from inside `packages/your-library`, it bundles only the files in that directory. Since the config and dev dependencies are at the root, they will be completely excluded from the published artifact.

### 4. How to Run Commands
You have two options for running Biome, both of which keep the child package clean:

**Option A: Run from Root (Recommended)**
You can check specific workspaces using file paths.
```bash
# Check the specific package
bunx @biomejs/biome check packages/your-library

# Check everything
bunx @biomejs/biome check .
```

**Option B: Run from Workspace**
Even if you are inside the workspace directory, you can run Biome. It will traverse up to the root to find the config and the binary.
```bash
cd packages/your-library
# Uses the root installation to check the current directory
bunx @biomejs/biome check .
```

### Summary of File Structure
Your setup will look like this, ensuring the `packages/ui-lib` you publish has zero traces of Biome:

```text
my-monorepo/
├── package.json        <-- Contains "@biomejs/biome" in devDependencies
├── biome.json          <-- Global config (rules, ignores, formatting)
├── bun.lockb
└── packages/
    └── ui-lib/         <-- Your publishable package
        ├── package.json    <-- CLEAN: No biome dep, no scripts needed
        └── src/
            └── index.ts
```

**Tip:** If you need to ignore specific build folders in your workspace (like `dist` or `build`), add them to the `files.ignore` section of your **root** `biome.json`.
```json
{
  "files": {
    "ignore": ["packages/*/dist", "packages/*/build"]
  }
}
```

[1](https://biomejs.dev/guides/big-projects/)
[2](https://github.com/biomejs/biome/issues/1556)
[3](https://bun.com/docs/guides/install/workspaces)
[4](https://github.com/biomejs/biome/issues/4414)
[5](https://betterstack.com/community/guides/scaling-nodejs/biome-eslint/)
[6](https://bun.com/docs/pm/workspaces)
[7](https://github.com/biomejs/biome/discussions/6966)
[8](https://dev.to/vikkio88/monorepo-with-bun-474n)
[9](https://nx.dev/blog/integrate-biome-in-20-minutes)
[10](https://marketplace.visualstudio.com/items?itemName=fronterior.biome-monorepo)
[11](https://github.com/biomejs/biome-vscode/issues/410)
[12](https://biomejs.dev/linter/)
[13](https://stackoverflow.com/questions/77925349/how-to-prevent-biome-from-linting-a-build-directory-inside-a-monorepo)
[14](https://turborepo.com/docs/guides/tools/biome)
[15](https://dev.to/rezaowliaei/simplifying-code-quality-with-a-unified-biome-configuration-jah)
[16](https://biomejs.dev/reference/configuration/)
[17](https://docs.sharingexcess.com/docs/developers/monorepo)
[18](https://biomejs.dev/guides/configure-biome/)
[19](https://www.npmjs.com/package/@empjs/biome-config?activeTab=readme)
[20](https://github.com/biomejs/biome-vscode/discussions/426)