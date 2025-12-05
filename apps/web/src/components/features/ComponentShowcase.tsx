import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ComponentShowcase() {
  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Forms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 max-w-md">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Enter your name" />
            </div>
            <Button>Submit</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="h-20 rounded bg-background border" />
              <p className="text-sm">Background</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded bg-primary" />
              <p className="text-sm">Primary</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded bg-muted" />
              <p className="text-sm">Muted</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded bg-border border" />
              <p className="text-sm">Border</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
