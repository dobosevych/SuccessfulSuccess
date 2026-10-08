/**
 * auth-page.tsx — stub kept for import compatibility.
 *
 * The sign-in flow now uses Cognito Managed Login (OIDC redirect).
 * - Clicking "Sign In" anywhere routes to /login/ which calls auth.signinRedirect().
 * - The callback returns to /auth/callback/ which then redirects to /.
 *
 * This file re-exports a no-op AuthPage that immediately redirects to /login.
 */
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { SiteHeader } from "@/components/site-header"
import { AuthLoading } from "@/components/require-auth"

export function AuthPage() {
  const { status } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === "signedIn") {
      router.replace("/today")
    } else if (status === "signedOut") {
      router.replace("/login")
    }
  }, [status, router])

  return (
    <>
      <SiteHeader />
      <AuthLoading />
    </>
  )
}
