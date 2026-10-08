"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

export default function AuthCallbackPage() {
  const auth = useAuth()
  const router = useRouter()
  const processed = useRef(false)

  useEffect(() => {
    if (auth.isAuthenticated) {
      if (!processed.current) {
        processed.current = true
        router.replace("/")
      }
    } else if (auth.error) {
      console.error("Authentication error during callback:", auth.error)
      if (!processed.current) {
        processed.current = true
        router.replace("/")
      }
    }
  }, [auth.isAuthenticated, auth.error, router])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-24">
      <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-muted-foreground text-sm font-medium">Completing sign in...</p>
    </div>
  )
}

