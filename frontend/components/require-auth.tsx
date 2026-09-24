"use client"

import { CalendarDays } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuth } from "@/components/auth-provider"

/** Full-screen placeholder while the session is checked or the redirect happens. */
export function AuthLoading({ label = "Checking your session…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
      <span
        className="flex size-12 animate-pulse items-center justify-center rounded-full text-white"
        style={{
          backgroundImage:
            "linear-gradient(135deg, var(--canva-teal), var(--canva-blue) 45%, var(--canva-violet))",
        }}
        aria-hidden
      >
        <CalendarDays className="size-5" />
      </span>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )
}

/** Renders its children only for a signed-in user; everyone else goes to the login page. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === "signedOut") router.replace("/")
  }, [status, router])

  if (status !== "signedIn") {
    return <AuthLoading label={status === "loading" ? undefined : "Redirecting to sign in…"} />
  }
  return <>{children}</>
}
