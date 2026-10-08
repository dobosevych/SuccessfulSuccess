"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const auth = useAuth()
  const router = useRouter()
  const hasTriggered = useRef(false)

  useEffect(() => {
    if (auth.isLoading) return

    if (auth.isAuthenticated) {
      router.replace("/")
      return
    }

    if (!hasTriggered.current) {
      hasTriggered.current = true
      void auth.signinRedirect?.()
    }
  }, [auth.isLoading, auth.isAuthenticated, auth, router])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-24">
      <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-muted-foreground text-sm font-medium">Redirecting to sign in...</p>
    </div>
  )
}

