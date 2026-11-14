// Copied by make-oracle.ts into a scratch directory that has @mantine/core installed, and run there:
// `bun mantine-render.tsx`. Reads theme.json and sigs.tsx from its own directory, writes markup.html.
import { Box, Center, Flex, Group, MantineProvider, SimpleGrid, Stack, Text } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { sigs } from './sigs.tsx'

void [Box, Center, Flex, Group, SimpleGrid, Stack, Text]
const theme = JSON.parse(readFileSync(new URL('./theme.json', import.meta.url), 'utf8'))
const html = renderToStaticMarkup(
  <MantineProvider theme={theme} forceColorScheme="light">
    {sigs.map((s, i) => (
      <section key={i} data-sig={i} className="host">
        {s}
      </section>
    ))}
  </MantineProvider>,
)
writeFileSync(new URL('./markup.html', import.meta.url), html)
