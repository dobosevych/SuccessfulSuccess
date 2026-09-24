"use client"

import { useState } from "react"

import { AppHeader } from "@/components/app-header"
import { DeleteMeetingDialog } from "@/components/delete-meeting-dialog"
import { MeetingDetailsDialog } from "@/components/meeting-details-dialog"
import { MeetingFormDialog } from "@/components/meeting-form-dialog"
import { MeetingList } from "@/components/meeting-list"
import { useMeetings } from "@/hooks/use-meetings"
import { formatLongDate } from "@/lib/datetime"
import type { Meeting } from "@/lib/types"

/** Which dialog is open. The form doubles as "create" (no meeting) and "edit". */
type DialogState =
  | { kind: "none" }
  | { kind: "form"; meeting?: Meeting }
  | { kind: "details"; meeting: Meeting }
  | { kind: "delete"; meeting: Meeting }

export function TodayPage({ initialDialogOpen = false }: { initialDialogOpen?: boolean }) {
  const [dialog, setDialog] = useState<DialogState>(
    initialDialogOpen ? { kind: "form" } : { kind: "none" },
  )
  // Kept after closing so dialogs keep their content during the close animation.
  const [selected, setSelected] = useState<Meeting>()
  const [editing, setEditing] = useState<Meeting>()
  const { data } = useMeetings()

  const count = data?.items.length ?? 0
  // Details show the freshest copy from the list, e.g. right after an edit.
  const current = data?.items.find((item) => item.id === selected?.id) ?? selected

  const open = (next: DialogState) => {
    if (next.kind !== "none") setSelected(next.meeting)
    if (next.kind === "form") setEditing(next.meeting)
    setDialog(next)
  }
  const close = () => setDialog({ kind: "none" })

  const onCreate = () => open({ kind: "form" })
  const onView = (meeting: Meeting) => open({ kind: "details", meeting })
  const onEdit = (meeting: Meeting) => open({ kind: "form", meeting })
  const onDelete = (meeting: Meeting) => open({ kind: "delete", meeting })

  return (
    <>
      <AppHeader onCreate={onCreate} />

      <main className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-6 lg:px-8">
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

        <MeetingList onCreate={onCreate} onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </main>

      <MeetingFormDialog
        open={dialog.kind === "form"}
        onOpenChange={(isOpen) => !isOpen && close()}
        meeting={editing}
      />
      <MeetingDetailsDialog
        open={dialog.kind === "details"}
        onOpenChange={(isOpen) => !isOpen && close()}
        meeting={current}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      <DeleteMeetingDialog
        open={dialog.kind === "delete"}
        onOpenChange={(isOpen) => !isOpen && close()}
        meeting={current}
      />
    </>
  )
}
