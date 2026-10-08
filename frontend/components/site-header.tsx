"use client"

import { CalendarDays } from "lucide-react"
import Link from "next/link"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"

export function SiteHeader({
  href = "/",
  children,
}: {
  href?: string
  children?: React.ReactNode
}) {
  const { user, isAuthenticated, isLoading, signOut } = useAuth()
  const email = user?.email

  return (
    <header className="bg-background/70 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href={href} className="flex items-center gap-2.5 font-bold tracking-tight">
          <span
            className="flex size-9 items-center justify-center rounded-full text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--canva-teal), var(--canva-blue) 45%, var(--canva-violet))",
            }}
          >
            <CalendarDays className="size-4.5" aria-hidden />
          </span>
          <span className="hidden text-[0.95rem] sm:inline">SuccessfulSuccess</span>
        </Link>

        {children}

        <div className="ml-auto flex items-center gap-3">
          {!isLoading && isAuthenticated && email ? (
            <>
              <span className="text-muted-foreground hidden text-sm font-medium sm:inline">
                {email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void signOut()}
              >
                Sign Out
              </Button>
            </>
          ) : !isLoading && !isAuthenticated ? (
            <Button size="sm" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export { SiteHeader as Header }
