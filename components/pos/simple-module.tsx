import { Construction } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

export function SimpleModule({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/12 text-primary">
          <Construction className="size-7" />
        </span>
        <div className="max-w-md">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
