import './styles/index.css'

import { SlidersHorizontal } from 'lucide-react'
import { useEffect } from 'react'

import { AppSidebar } from '@/components/features/AppSidebar.tsx'
import { Breadcrumbs } from '@/components/features/Breadcrumbs.tsx'
import { dataChart, dataChart2, dataChart3, dataChart4 } from '@/components/features/data.ts'
import { MetricsCards } from '@/components/features/MetricsCards.tsx'
import { BarChart } from '@/components/tremor/BarChart.tsx'
import { ComboChart } from '@/components/tremor/ComboChart.tsx'
import { ConditionalBarChart } from '@/components/tremor/ConditionalBarChart.tsx'
import {
  CustomTooltip,
  CustomTooltip2,
  CustomTooltip3,
  CustomTooltip4,
} from '@/components/tremor/CustomTooltips.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/tremor/Select.tsx'
import { SidebarProvider, SidebarTrigger } from '@/components/tremor/Sidebar.tsx'
import { TabNavigation, TabNavigationLink } from '@/components/tremor/TabNavigation.tsx'
import { Button } from '@/components/ui/button.tsx'
import { formatters } from '@/lib/utils.ts'
import { initTheme } from '@/stores/theme.ts'

const navigation = [
  { name: 'Overview', href: '/dashboard' },
  { name: 'Monitoring', href: '/dashboard#monitoring' },
  { name: 'Audits', href: '/dashboard#audits' },
]

function App() {
  useEffect(() => {
    const cleanup = initTheme()
    return cleanup
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex min-h-svh w-full flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
          <SidebarTrigger className="-ml-1" />
          <div className="mr-2 h-4 w-px bg-gray-200 dark:bg-gray-800" />
          <Breadcrumbs />
        </header>
        <main className="flex-1 overflow-scroll bg-white h-screen dark:bg-gray-900">
          <div className="p-4 sm:p-6">
            <MetricsCards />
          </div>
          <TabNavigation className="mt-6 gap-x-4 px-4 sm:px-6">
            {navigation.map((item) => (
              <TabNavigationLink key={item.name} asChild active={item.name === 'Overview'}>
                <a href={item.href}>{item.name}</a>
              </TabNavigationLink>
            ))}
          </TabNavigation>
          <section aria-label="App Monitoring">
            <div className="flex flex-col items-center justify-between gap-2 p-6 sm:flex-row">
              <Select defaultValue="365-days">
                <SelectTrigger className="py-1.5 sm:w-44">
                  <SelectValue placeholder="Assigned to..." />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="30-days">Last 30 days</SelectItem>
                  <SelectItem value="90-days">Last 90 days</SelectItem>
                  <SelectItem value="180-days">Last 180 days</SelectItem>
                  <SelectItem value="365-days">Last 365 days</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="w-full gap-2 py-1.5 text-base sm:w-fit sm:text-sm"
              >
                <SlidersHorizontal
                  className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
                  aria-hidden="true"
                />
                Report Filters
              </Button>
            </div>
            <dl className="grid grid-cols-1 gap-x-14 gap-y-10 border-t border-gray-200 p-6 md:grid-cols-2 dark:border-gray-800">
              <div className="flex flex-col justify-between p-0">
                <div>
                  <dt className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Inherent risk
                  </dt>
                  <dd className="mt-0.5 text-sm/6 text-gray-500 dark:text-gray-500">
                    Risk scenarios over time grouped by risk level
                  </dd>
                </div>
                <BarChart
                  data={dataChart}
                  index="date"
                  categories={['Current year', 'Same period last year']}
                  colors={['blue', 'lightBlue']}
                  yAxisWidth={45}
                  customTooltip={CustomTooltip}
                  yAxisLabel="Number of inherent risks"
                  barCategoryGap="20%"
                  valueFormatter={(value) => formatters.unit(value)}
                  className="mt-4 hidden h-60 md:block"
                />
                <BarChart
                  data={dataChart}
                  index="date"
                  categories={['Current year', 'Same period last year']}
                  colors={['blue', 'lightGray']}
                  showYAxis={false}
                  customTooltip={CustomTooltip}
                  barCategoryGap="20%"
                  className="mt-4 h-60 md:hidden"
                />
              </div>
              <div className="flex flex-col justify-between">
                <div>
                  <dt className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Quote-to-Deal ratio
                  </dt>
                  <dd className="mt-0.5 text-sm/6 text-gray-500 dark:text-gray-500">
                    Number of quotes compared to total deal size for given month
                  </dd>
                </div>
                <ComboChart
                  data={dataChart2}
                  index="date"
                  enableBiaxial={true}
                  barSeries={{
                    categories: ['Quotes'],
                    yAxisLabel: 'Number of quotes / Deal size ($)',
                    valueFormatter: (value) =>
                      formatters.currency({ number: value, maxFractionDigits: 0 }),
                  }}
                  lineSeries={{
                    categories: ['Total deal size'],
                    colors: ['lightGray'],
                    showYAxis: false,
                  }}
                  customTooltip={CustomTooltip2}
                  className="mt-4 hidden h-60 md:block"
                />
                <ComboChart
                  data={dataChart2}
                  index="date"
                  enableBiaxial={true}
                  barSeries={{
                    categories: ['Quotes'],
                    showYAxis: false,
                  }}
                  lineSeries={{
                    categories: ['Total deal size'],
                    colors: ['lightGray'],
                    showYAxis: false,
                  }}
                  customTooltip={CustomTooltip2}
                  className="mt-4 h-60 md:hidden"
                />
              </div>
              <div className="flex flex-col justify-between">
                <div>
                  <dt className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    ESG impact
                  </dt>
                  <dd className="mt-0.5 text-sm/6 text-gray-500 dark:text-gray-500">
                    Evaluation of addressed ESG criteria in biddings over time
                  </dd>
                </div>
                <BarChart
                  data={dataChart3}
                  index="date"
                  categories={['Addressed', 'Unrealized']}
                  colors={['emerald', 'lightEmerald']}
                  customTooltip={CustomTooltip3}
                  type="percent"
                  yAxisWidth={55}
                  yAxisLabel="% of criteria addressed"
                  barCategoryGap="30%"
                  className="mt-4 hidden h-60 md:block"
                />
                <BarChart
                  data={dataChart3}
                  index="date"
                  categories={['Addressed', 'Unrealized']}
                  colors={['emerald', 'lightEmerald']}
                  customTooltip={CustomTooltip3}
                  showYAxis={false}
                  type="percent"
                  barCategoryGap="30%"
                  className="mt-4 h-60 md:hidden"
                />
              </div>
              <div className="flex flex-col justify-between">
                <div>
                  <dt className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Bidder density
                  </dt>
                  <dd className="mt-0.5 text-sm/6 text-gray-500 dark:text-gray-500">
                    Competition level measured by number and size of bidders over time
                  </dd>
                </div>
                <ConditionalBarChart
                  data={dataChart4}
                  index="date"
                  categories={['Density']}
                  colors={['orange']}
                  customTooltip={CustomTooltip4}
                  valueFormatter={(value) => formatters.percentage({ number: value, decimals: 0 })}
                  yAxisWidth={55}
                  yAxisLabel="Competition density (%)"
                  barCategoryGap="30%"
                  className="mt-4 hidden h-60 md:block"
                />
                <ConditionalBarChart
                  data={dataChart4}
                  index="date"
                  categories={['Density']}
                  colors={['orange']}
                  customTooltip={CustomTooltip4}
                  valueFormatter={(value) => formatters.percentage({ number: value, decimals: 0 })}
                  showYAxis={false}
                  barCategoryGap="30%"
                  className="mt-4 h-60 md:hidden"
                />
              </div>
            </dl>
          </section>
        </main>
      </div>
    </SidebarProvider>
  )
}

export default App
