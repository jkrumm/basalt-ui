import { Card, CardContent } from '@/components/ui/card'

export interface ColorInfo {
  name: string
  variable: string
  class: string
  usage?: string
}

export interface ColorSection {
  category: string
  description: string
  colors: ColorInfo[]
}

interface ColorPaletteProps {
  section: ColorSection
  columns?: 3 | 4 | 5
}

export function ColorPalette({ section, columns = 4 }: ColorPaletteProps) {
  const gridCols = {
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  }[columns]

  return (
    <Card>
      <CardContent>
        <h3 className="mb-2 font-bold">{section.category}</h3>
        <p className="text-small text-muted-foreground mb-4">{section.description}</p>

        {/* Gradient visualization */}
        <div className="overflow-hidden rounded-lg border">
          <div className="flex h-20">
            {section.colors.map((color) => (
              <div key={color.variable} className={`${color.class} flex-1`} />
            ))}
          </div>
          <div className={`grid ${gridCols} gap-2 p-4 bg-muted/30`}>
            {section.colors.map((color) => (
              <div key={color.variable}>
                <p className="font-bold mt-0 mb-0">{color.name}</p>
                <code className="font-mono text-xs text-muted-foreground block mt-2">
                  {color.variable}
                </code>
                {color.usage && (
                  <p className="text-caption mb-0 mt-2 text-muted-foreground leading-tight">
                    {color.usage}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
