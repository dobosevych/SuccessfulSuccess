"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Hub } from "aws-amplify/utils"
import { fetchAuthSession, signOut as amplifySignOut } from "aws-amplify/auth"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { syncMe } from "@/lib/api"
import { authErrorMessage, configureAuth, isAuthConfigured } from "@/lib/auth"

export type AuthUser = {
  sub: string
  email?: string
  name?: string
}

type AuthState =
  | { status: "loading"; user: null }
  | { status: "signedOut"; user: null }
  | { status: "signedIn"; user: AuthUser }

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Reads who is signed in from the ID token; null when nobody is. */
async function loadUser(): Promise<{ user: AuthUser; idToken: string } | null> {
  try {
    const { tokens } = await fetchAuthSession()
    const idToken = tokens?.idToken
    const claims = idToken?.payload
    if (!idToken || !claims?.sub) return null
    return {
      idToken: idToken.toString(),
      user: {
        sub: String(claims.sub),
        email: typeof claims.email === "string" ? claims.email : undefined,
        name: typeof claims.name === "string" ? claims.name : undefined,
      },
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: "loading", user: null })

  // The sub whose profile was already stored this page load.
  const syncedSub = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    const loaded = await loadUser()
    if (!loaded) {
      setState({ status: "signedOut", user: null })
      return
    }
    setState({ status: "signedIn", user: loaded.user })
    // Keep the users table current (email, name, provider, last login). Not
    // critical to the page, so a failure is only logged.
    if (syncedSub.current !== loaded.user.sub) {
      syncedSub.current = loaded.user.sub
      syncMe(loaded.idToken).catch((error) => console.warn("Profile sync failed", error))
    }
  }, [])

  useEffect(() => {
    if (!isAuthConfigured) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no pool, so nobody can be signed in
      setState({ status: "signedOut", user: null })
      return
    }
    configureAuth()
    void refresh()

    return Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
        case "signInWithRedirect":
          // Another user's meetings must never show from the cache.
          queryClient.clear()
          void refresh()
          break
        case "signedOut":
        case "tokenRefresh_failure":
          queryClient.clear()
          syncedSub.current = null
          setState({ status: "signedOut", user: null })
          break
        case "signInWithRedirect_failure":
          toast.error("Google sign-in failed. Please try again.")
          break
      }
    })
  }, [queryClient, refresh])

  const signOut = useCallback(async () => {
    try {
      await amplifySignOut()
    } catch (error) {
      toast.error(authErrorMessage(error))
    }
  }, [])

  const value = useMemo(() => ({ ...state, refresh, signOut }), [state, refresh, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>")
  return context
}
