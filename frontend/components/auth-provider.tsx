"use client"

import { useQueryClient } from "@tanstack/react-query"
import { WebStorageStateStore } from "oidc-client-ts"
import {
  AuthProvider as OidcAuthProvider,
  useAuth as useOidcAuth,
  type AuthProviderProps,
} from "react-oidc-context"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { syncMe } from "@/lib/api"
import {
  authConfig,
  authority,
  getPostLogoutRedirectUri,
  getRedirectUri,
  isAuthConfigured,
  signOutRedirect,
} from "@/lib/auth"

export type AuthUser = {
  sub: string
  email?: string
  name?: string
  profile?: Record<string, unknown>
}

type AuthState =
  | { status: "loading"; user: null; isAuthenticated: false; isLoading: true }
  | { status: "signedOut"; user: null; isAuthenticated: false; isLoading: false }
  | { status: "signedIn"; user: AuthUser; isAuthenticated: true; isLoading: false }

export type AuthContextValue = AuthState & {
  oidcUser: ReturnType<typeof useOidcAuth>["user"]
  signinRedirect: ReturnType<typeof useOidcAuth>["signinRedirect"]
  removeUser: ReturnType<typeof useOidcAuth>["removeUser"]
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  error?: Error
}

const AuthContext = createContext<AuthContextValue | null>(null)

function InnerAuthProvider({ children }: { children: React.ReactNode }) {
  const oidcAuth = useOidcAuth()
  const queryClient = useQueryClient()
  const syncedSub = useRef<string | null>(null)

  const signOut = useCallback(async () => {
    queryClient.clear()
    syncedSub.current = null
    await signOutRedirect(oidcAuth)
  }, [oidcAuth, queryClient])

  const refresh = useCallback(async () => {
    // If needed, oidc-client-ts silently renews or gets user
    if (oidcAuth.isAuthenticated && oidcAuth.user) {
      const sub = oidcAuth.user.profile.sub
      if (syncedSub.current !== sub && oidcAuth.user.id_token) {
        syncedSub.current = sub
        syncMe(oidcAuth.user.id_token).catch((err) =>
          console.warn("Profile sync failed:", err)
        )
      }
    }
  }, [oidcAuth.isAuthenticated, oidcAuth.user])

  useEffect(() => {
    if (oidcAuth.isAuthenticated && oidcAuth.user) {
      const sub = oidcAuth.user.profile.sub
      if (syncedSub.current !== sub && oidcAuth.user.id_token) {
        syncedSub.current = sub
        syncMe(oidcAuth.user.id_token).catch((err) =>
          console.warn("Profile sync failed:", err)
        )
      }
    } else if (!oidcAuth.isLoading && !oidcAuth.isAuthenticated) {
      syncedSub.current = null
    }
  }, [oidcAuth.isAuthenticated, oidcAuth.user, oidcAuth.isLoading])

  const state = useMemo((): AuthState => {
    if (oidcAuth.isLoading) {
      return {
        status: "loading",
        user: null,
        isAuthenticated: false,
        isLoading: true,
      }
    }
    if (oidcAuth.isAuthenticated && oidcAuth.user) {
      const profile = oidcAuth.user.profile as Record<string, unknown>
      const email =
        typeof profile.email === "string"
          ? profile.email
          : typeof profile["cognito:username"] === "string"
          ? profile["cognito:username"]
          : undefined
      const name = typeof profile.name === "string" ? profile.name : undefined

      return {
        status: "signedIn",
        user: {
          sub: typeof profile.sub === "string" ? profile.sub : String(profile.sub ?? ""),
          email,
          name,
          profile,
        },
        isAuthenticated: true,
        isLoading: false,
      }
    }
    return {
      status: "signedOut",
      user: null,
      isAuthenticated: false,
      isLoading: false,
    }
  }, [oidcAuth.isLoading, oidcAuth.isAuthenticated, oidcAuth.user])

  const value = useMemo(
    (): AuthContextValue => ({
      ...state,
      oidcUser: oidcAuth.user,
      signinRedirect: oidcAuth.signinRedirect,
      removeUser: oidcAuth.removeUser,
      signOut,
      refresh,
      error: oidcAuth.error,
    }),
    [state, oidcAuth.user, oidcAuth.signinRedirect, oidcAuth.removeUser, signOut, refresh, oidcAuth.error]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const oidcConfig: AuthProviderProps = useMemo(() => {
    const redirectUri = getRedirectUri()
    const postLogoutUri = getPostLogoutRedirectUri()

    return {
      authority,
      client_id: authConfig.clientId,
      redirect_uri: redirectUri,
      post_logout_redirect_uri: postLogoutUri,
      response_type: "code",
      scope: "openid email profile",
      automaticSilentRenew: true,
      userStore:
        typeof window !== "undefined"
          ? new WebStorageStateStore({ store: window.localStorage })
          : undefined,
      onSigninCallback: () => {
        if (typeof window !== "undefined") {
          window.history.replaceState({}, document.title, window.location.pathname)
          window.location.replace("/")
        }
      },
    }
  }, [])

  if (!isAuthConfigured) {
    // Unconfigured fallback
    const fallbackValue: AuthContextValue = {
      status: "signedOut",
      user: null,
      isAuthenticated: false,
      isLoading: false,
      oidcUser: null,
      signinRedirect: async () => {},
      removeUser: async () => {},
      signOut: async () => {},
      refresh: async () => {},
      error: undefined,
    }
    return (
      <AuthContext.Provider value={fallbackValue}>{children}</AuthContext.Provider>
    )
  }

  // During SSR or pre-mount, render children safely wrapped in AuthContext
  if (!mounted) {
    return (
      <AuthContext.Provider value={AUTH_FALLBACK}>
        {children}
      </AuthContext.Provider>
    )
  }

  return (
    <OidcAuthProvider {...oidcConfig}>
      <InnerAuthProvider>{children}</InnerAuthProvider>
    </OidcAuthProvider>
  )
}

/** Safe default returned during SSR / before the client mounts. */
const AUTH_FALLBACK: AuthContextValue = {
  status: "loading",
  user: null,
  isAuthenticated: false,
  isLoading: true,
  oidcUser: null,
  signOut: async () => {},
  refresh: async () => {},
  signinRedirect: async () => {},
  removeUser: async () => {},
  error: undefined,
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  // During SSR or static prerendering there is no provider — return a safe
  // loading state so pages don't crash at build time.
  return context ?? AUTH_FALLBACK
}
