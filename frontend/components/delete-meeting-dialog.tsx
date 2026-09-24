"use client"

import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDeleteMeeting } from "@/hooks/use-meetings"
import type { Meeting } from "@/lib/types"

export function DeleteMeetingDialog({
  meeting,
  open,
  onOpenChange,
}: {
  meeting?: Meeting
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const deleteMeeting = useDeleteMeeting()

  const onConfirm = async () => {
    if (!meeting) return
    try {
      await deleteMeeting.mutateAsync(meeting.id)
      toast.success("Meeting deleted")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the meeting.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete this meeting?</DialogTitle>
          <DialogDescription>
            &ldquo;{meeting?.name}&rdquo; and its participant list will be removed. This
            can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleteMeeting.isPending}
          >
            {deleteMeeting.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
