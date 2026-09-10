"use client"

import { AlertCircle, CalendarPlus } from "lucide-react"

import { MeetingCard } from "@/components/meeting-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useMeetings } from "@/hooks/use-meetings"

export function MeetingList({ onCreate }: { onCreate: () => void }) {
  const { data, isPending, isError, error, refetch } = useMeetings()

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading meetings">
        {[0, 1, 2].map((index) => (
          <Card key={index}>
            <CardContent className="space-y-3 py-6">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden />
        <AlertTitle>Could not load meetings</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{error instanceof Error ? error.message : "Unknown error."}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (data.items.length === 0) {
    return (
      <Card className="border-2 border-dashed border-border bg-card/60 shadow-none">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <span
            className="flex size-14 items-center justify-center rounded-full text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--canva-teal), var(--canva-blue) 45%, var(--canva-violet))",
            }}
          >
            <CalendarPlus className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-bold">No meetings today</p>
            <p className="text-muted-foreground text-sm">
              Your day is clear. Schedule something when you are ready.
            </p>
          </div>
          <Button onClick={onCreate}>Schedule one</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {data.items.map((meeting, index) => (
        <MeetingCard key={meeting.id} meeting={meeting} index={index} />
      ))}
    </div>
  )
}
