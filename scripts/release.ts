import prompts from 'prompts'
// @ts-expect-error - release-it types are incorrect, works fine at runtime with Bun
import release from 'release-it'

// 1. Ask for Title & Version Mode
const response = await prompts([
  {
    type: 'text',
    name: 'title',
    message: 'Enter release title (optional):',
  },
  {
    type: 'select',
    name: 'increment',
    message: 'Select version increment:',
    choices: [
      { title: '🚀 Auto (Recommended based on commits)', value: 'auto' },
      { title: '🛠️  Patch (fix)', value: 'patch' },
      { title: '✨ Minor (feat)', value: 'minor' },
      { title: '💥 Major (breaking)', value: 'major' },
      { title: '📝 Custom Version', value: 'custom' },
    ],
    initial: 0,
  },
  {
    // Only show if "Custom" was picked
    type: (prev) => (prev === 'custom' ? 'text' : null),
    name: 'customVersion',
    message: 'Enter new version number (e.g. 1.2.0):',
    validate: (value: string) => (value ? true : 'Version is required'),
  },
])

// 2. Handle Cancellation (Ctrl+C)
if (!response.increment) {
  process.exit(0)
}

// 3. Determine the increment value
// If 'auto' is selected, pass undefined so release-it uses its conventional-changelog calculation
const increment =
  response.increment === 'auto'
    ? undefined
    : response.increment === 'custom'
      ? response.customVersion
      : response.increment

// 4. Build releaseName template
// biome-ignore lint/suspicious/noTemplateCurlyInString: release-it template syntax
const releaseName = response.title ? `v\${version} - ${response.title}` : 'v${version}'

// 5. Run release-it
try {
  await release({
    increment,
    github: {
      releaseName,
    },
  })
} catch {
  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.log('Release cancelled or failed.')
  // release-it logs errors automatically, exit silently
  process.exit(1)
}
