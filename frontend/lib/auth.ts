import { UserManager, WebStorageStateStore } from "oidc-client-ts"

export const authConfig = {
  userPoolId:
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ??
    process.env.NEXT_PUBLIC_USER_POOL_ID ??
    "",
  clientId:
    process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ??
    process.env.NEXT_PUBLIC_CLIENT_ID ??
    process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID ??
    "",
  domainPrefix:
    process.env.NEXT_PUBLIC_COGNITO_DOMAIN_PREFIX ??
    process.env.NEXT_PUBLIC_DOMAIN_PREFIX ??
    "",
  domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "",
  region:
    process.env.NEXT_PUBLIC_AWS_REGION ??
    process.env.NEXT_PUBLIC_COGNITO_REGION ??
    "us-east-1",
  googleEnabled: process.env.NEXT_PUBLIC_COGNITO_GOOGLE_ENABLED === "true",
}

export function getDomainPrefix(): string {
  if (authConfig.domainPrefix) return authConfig.domainPrefix
  if (authConfig.domain) {
    const parts = authConfig.domain.replace(/^https?:\/\//, "").split(".")
    return parts[0]
  }
  return ""
}

export const isAuthConfigured = Boolean(
  authConfig.userPoolId && authConfig.clientId
)

export const authority = authConfig.userPoolId
  ? `https://cognito-idp.${authConfig.region}.amazonaws.com/${authConfig.userPoolId}`
  : ""

export function getRedirectUri(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback/`
  }
  return "http://localhost:3000/auth/callback/"
}

export function getPostLogoutRedirectUri(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/`
  }
  return "http://localhost:3000/"
}

export const userManager =
  typeof window !== "undefined" && isAuthConfigured
    ? new UserManager({
        authority,
        client_id: authConfig.clientId,
        redirect_uri: getRedirectUri(),
        post_logout_redirect_uri: getPostLogoutRedirectUri(),
        response_type: "code",
        scope: "openid email profile",
        automaticSilentRenew: true,
        userStore: new WebStorageStateStore({ store: window.localStorage }),
      })
    : null

export async function getAccessToken(): Promise<string | null> {
  if (!userManager) return null
  try {
    const user = await userManager.getUser()
    return user?.access_token ?? null
  } catch {
    return null
  }
}

export async function getIdToken(): Promise<string | null> {
  if (!userManager) return null
  try {
    const user = await userManager.getUser()
    return user?.id_token ?? null
  } catch {
    return null
  }
}

export async function signOutRedirect(authObj?: { removeUser?: () => Promise<void> }) {
  if (typeof window === "undefined") return

  try {
    if (authObj?.removeUser) {
      await authObj.removeUser()
    } else if (userManager) {
      await userManager.removeUser()
    }
  } catch (err) {
    console.error("Error removing local user:", err)
  }

  try {
    window.sessionStorage.clear()
    window.localStorage.removeItem(
      `oidc.user:${authority}:${authConfig.clientId}`
    )
  } catch {}

  const prefix = getDomainPrefix()
  const logoutUri = `${window.location.origin}/`
  const logoutUrl = `https://${prefix}.auth.${authConfig.region}.amazoncognito.com/logout?client_id=${authConfig.clientId}&logout_uri=${encodeURIComponent(
    logoutUri
  )}`

  window.location.href = logoutUrl
}

export function authErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong."
}
