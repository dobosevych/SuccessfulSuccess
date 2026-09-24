"use client"

import { useRef } from "react"
import { CalendarDays, Clock, Mail, MapPin, Pencil, Trash2, Users } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  formatDuration,
  formatLongDate,
  formatTimeRange,
  initials,
} from "@/lib/datetime"
import type { Meeting } from "@/lib/types"

export function MeetingDetailsDialog({
  meeting,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  meeting?: Meeting
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (meeting: Meeting) => void
  onDelete: (meeting: Meeting) => void
}) {
  const editRef = useRef<HTMLButtonElement>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {meeting ? (
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-lg"
          // Focus Edit rather than the first button, so Enter never starts a delete.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            editRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">{meeting.name}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
              <span className="tint-violet inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-semibold tabular-nums">
                <Clock className="size-3.5" aria-hidden />
                {formatTimeRange(meeting.starts_at, meeting.ends_at)}
              </span>
              <span className="tint-teal inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                {formatDuration(meeting.starts_at, meeting.ends_at)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <dl className="grid gap-3 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="text-muted-foreground size-4" aria-hidden />
              <dt className="sr-only">Date</dt>
              <dd>{formatLongDate(meeting.starts_at)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="text-muted-foreground size-4" aria-hidden />
              <dt className="sr-only">Location</dt>
              <dd className={meeting.location ? undefined : "text-muted-foreground"}>
                {meeting.location ?? "No location"}
              </dd>
            </div>
          </dl>

          {meeting.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{meeting.description}</p>
          ) : null}

          <Separator />

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4" aria-hidden />
              Participants
              <span className="text-muted-foreground font-normal tabular-nums">
                {meeting.participants.length}
              </span>
            </h3>
            {meeting.participants.length === 0 ? (
              <p className="text-muted-foreground text-sm">No participants yet.</p>
            ) : (
              <ul className="space-y-2">
                {meeting.participants.map((participant) => (
                  <li key={participant.id} className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {initials(participant.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{participant.name}</p>
                      {participant.email ? (
                        <a
                          href={`mailto:${participant.email}`}
                          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 truncate text-xs"
                        >
                          <Mail className="size-3" aria-hidden />
                          {participant.email}
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <DialogFooter>
            <Button variant="destructive" onClick={() => onDelete(meeting)}>
              <Trash2 aria-hidden />
              Delete
            </Button>
            <Button ref={editRef} onClick={() => onEdit(meeting)}>
              <Pencil aria-hidden />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
