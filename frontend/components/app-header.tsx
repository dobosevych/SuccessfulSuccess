"use client"

import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SiteHeader } from "@/components/site-header"
import { useMeetings } from "@/hooks/use-meetings"
import { formatTimeRange } from "@/lib/datetime"

export function AppHeader({ onCreate }: { onCreate: () => void }) {
  // Same query key as the list, so a newly created meeting shows up here too.
  const { data } = useMeetings()
  const meetings = data?.items ?? []

  return (
    <SiteHeader href="/today">
      <NavigationMenu className="ml-auto">
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>
              Today
              {meetings.length > 0 ? (
                <Badge variant="secondary" className="ml-2 tabular-nums">
                  {meetings.length}
                </Badge>
              ) : null}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ScrollArea className="h-fit max-h-80 w-72">
                <ul className="p-2">
                  {meetings.length === 0 ? (
                    <li className="text-muted-foreground p-3 text-sm">
                      No meetings today.
                    </li>
                  ) : (
                    meetings.map((meeting) => (
                      <li key={meeting.id}>
                        <NavigationMenuLink asChild>
                          <a
                            href={`#meeting-${meeting.id}`}
                            className="hover:bg-accent block rounded-2xl p-2.5 transition-colors"
                          >
                            <span className="text-muted-foreground font-mono text-xs tabular-nums">
                              {formatTimeRange(meeting.starts_at, meeting.ends_at)}
                            </span>
                            <span className="block truncate text-sm font-medium">
                              {meeting.name}
                            </span>
                          </a>
                        </NavigationMenuLink>
                      </li>
                    ))
                  )}
                </ul>
              </ScrollArea>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      <Button onClick={onCreate} size="sm">
        <Plus className="size-4" aria-hidden />
        <span className="hidden sm:inline">New meeting</span>
      </Button>
    </SiteHeader>
  )
}
