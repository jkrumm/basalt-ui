/**
 * The expression app's navigation: ONE typed `defineNav` declaration, handed to `AppShell nav={NAV}` in
 * `routes/__root.tsx`. The index is the first destination; every scenario of `SCENARIO_INFO` follows, so the
 * command palette (`Mod+K`, the rail's search row) finds a scenario by its title. Pure data: this file imports
 * nothing from `routes/`.
 */
import { linkOptions } from '@tanstack/react-router'
import { defineNav } from 'basalt-ui/router'
import { FlaskConical, ListTree } from 'lucide-react'
import { SCENARIO_INFO } from '../scenarios/scenario-info'

export const NAV = defineNav({
  sections: [
    {
      id: 'index',
      label: 'Index',
      items: [
        {
          id: 'home',
          label: 'Scenarios',
          icon: ListTree,
          mobile: 'tab',
          link: linkOptions({ to: '/scenarios' }),
        },
      ],
    },
    {
      id: 'scenarios',
      label: 'Expression scenarios',
      collapsible: true,
      items: SCENARIO_INFO.map(({ id, title }) => ({
        id: `scenario-${id}`,
        label: title,
        icon: FlaskConical,
        link: linkOptions({ to: '/scenarios/$name', params: { name: id } }),
      })),
    },
  ],
})
