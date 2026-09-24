"use client"

import { Eye, MapPin, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatTimeRange, initials } from "@/lib/datetime"
import type { Meeting } from "@/lib/types"

const MAX_AVATARS = 4

/** Canva colour-codes its cards; we rotate the same pastel tints by position. */
const TINTS = ["tint-violet", "tint-teal", "tint-pink", "tint-amber"] as const

export function MeetingCard({
  meeting,
  index = 0,
  onView,
  onEdit,
  onDelete,
}: {
  meeting: Meeting
  index?: number
  onView: (meeting: Meeting) => void
  onEdit: (meeting: Meeting) => void
  onDelete: (meeting: Meeting) => void
}) {
  const tint = TINTS[index % TINTS.length]
  const shown = meeting.participants.slice(0, MAX_AVATARS)
  const overflow = meeting.participants.length - shown.length
  const allNames = meeting.participants.map((p) => p.name).join(", ")

  return (
    <Card
      id={`meeting-${meeting.id}`}
      onClick={() => onView(meeting)}
      className="h-full cursor-pointer scroll-mt-28 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(15,16,21,0.04),0_20px_44px_-16px_rgba(139,61,255,0.28)]"
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              tint,
              "inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-semibold tabular-nums",
            )}
          >
            {formatTimeRange(meeting.starts_at, meeting.ends_at)}
          </span>
          {meeting.location ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
              <MapPin className="size-3.5" aria-hidden />
              {meeting.location}
            </span>
          ) : null}
        </div>
        {/* Menu clicks bubble through the portal in React, so stop them reaching the card. */}
        <CardAction onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${meeting.name}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onView(meeting)}>
                <Eye aria-hidden />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEdit(meeting)}>
                <Pencil aria-hidden />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(meeting)}>
                <Trash2 aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
        <CardTitle className="text-xl font-bold tracking-tight">
          {/* A real button so the card opens from the keyboard; the click bubbles to the card. */}
          <button type="button" className="text-left outline-none focus-visible:underline">
            {meeting.name}
          </button>
        </CardTitle>
        {meeting.description ? (
          <CardDescription className="line-clamp-3">{meeting.description}</CardDescription>
        ) : null}
      </CardHeader>

      <CardContent>
        {meeting.participants.length === 0 ? (
          <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <Users className="size-4" aria-hidden />
            No participants yet
          </p>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {shown.map((participant) => (
                    <Avatar
                      key={participant.id}
                      className="ring-background size-8 ring-2"
                      title={participant.name}
                    >
                      <AvatarFallback className="text-xs">
                        {initials(participant.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {overflow > 0 ? (
                    <Avatar className="ring-background size-8 ring-2">
                      <AvatarFallback className="text-xs">+{overflow}</AvatarFallback>
                    </Avatar>
                  ) : null}
                </div>
                <span className="text-muted-foreground truncate text-sm">{allNames}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{allNames}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </CardContent>
    </Card>
  )
}
