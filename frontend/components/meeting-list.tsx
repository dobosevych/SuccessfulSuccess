"use client"

import { AlertCircle, CalendarDays, CalendarPlus } from "lucide-react"

import { MeetingCard } from "@/components/meeting-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useMeetings } from "@/hooks/use-meetings"
import type { Meeting } from "@/lib/types"

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"

/** Shown while the first request for the day's meetings is in flight. */
function LoadingScreen() {
  return (
    <div role="status" aria-live="polite" className="space-y-8">
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="relative flex size-16 items-center justify-center">
          <span
            className="absolute inset-0 animate-spin rounded-full [animation-duration:1.4s]"
            style={{
              background:
                "conic-gradient(from 0deg, var(--canva-teal), var(--canva-blue), var(--canva-violet), var(--canva-pink), transparent 85%)",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))",
            }}
            aria-hidden
          />
          <span
            className="flex size-11 animate-pulse items-center justify-center rounded-full text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--canva-teal), var(--canva-blue) 45%, var(--canva-violet))",
            }}
            aria-hidden
          >
            <CalendarDays className="size-5" />
          </span>
        </span>
        <div>
          <p className="text-lg font-bold">Loading your meetings…</p>
          <p className="text-muted-foreground text-sm">Fetching today&apos;s schedule.</p>
        </div>
      </div>

      <div className={GRID} aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Card key={index}>
            <CardContent className="space-y-3 py-6">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <div className="flex -space-x-2 pt-1">
                {[0, 1, 2].map((avatar) => (
                  <Skeleton key={avatar} className="ring-card size-8 rounded-full ring-2" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function MeetingList({
  onCreate,
  onView,
  onEdit,
  onDelete,
}: {
  onCreate: () => void
  onView: (meeting: Meeting) => void
  onEdit: (meeting: Meeting) => void
  onDelete: (meeting: Meeting) => void
}) {
  const { data, isPending, isError, error, refetch } = useMeetings()

  if (isPending) {
    return <LoadingScreen />
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
    <div className={GRID}>
      {data.items.map((meeting, index) => (
        <MeetingCard
          key={meeting.id}
          meeting={meeting}
          index={index}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
