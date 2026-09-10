"use client"

import { useState } from "react"

import { AppHeader } from "@/components/app-header"
import { CreateMeetingDialog } from "@/components/create-meeting-dialog"
import { MeetingList } from "@/components/meeting-list"
import { useMeetings } from "@/hooks/use-meetings"
import { formatLongDate } from "@/lib/datetime"

export function TodayPage({ initialDialogOpen = false }: { initialDialogOpen?: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(initialDialogOpen)
  const { data } = useMeetings()

  const count = data?.items.length ?? 0

  return (
    <>
      <AppHeader onCreate={() => setDialogOpen(true)} />

      <main className="mx-auto max-w-3xl px-4 pt-10 pb-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-gradient-canva text-4xl font-bold tracking-tight sm:text-5xl">
              Today
            </h1>
            {data ? (
              <p className="text-muted-foreground mt-2 text-base">{formatLongDate(data.date)}</p>
            ) : null}
          </div>
          {data ? (
            <span className="tint-violet inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-semibold tabular-nums">
              {count} {count === 1 ? "meeting" : "meetings"}
            </span>
          ) : null}
        </div>

        <MeetingList onCreate={() => setDialogOpen(true)} />
      </main>

      <CreateMeetingDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
