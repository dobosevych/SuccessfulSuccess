import { Amplify } from "aws-amplify"
import { fetchAuthSession } from "aws-amplify/auth"
// Completes Google sign-in when Cognito redirects back to the app.
import "aws-amplify/auth/enable-oauth-listener"

export const authConfig = {
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "",
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "",
  // Cognito's OAuth domain, e.g. <prefix>.auth.us-east-1.amazoncognito.com
  domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "",
  googleEnabled: process.env.NEXT_PUBLIC_COGNITO_GOOGLE_ENABLED === "true",
}

export const isAuthConfigured = Boolean(authConfig.userPoolId && authConfig.clientId)

let configured = false

/** Idempotent; browser only, because the OAuth redirect URLs use the page's origin. */
export function configureAuth() {
  if (configured || !isAuthConfigured || typeof window === "undefined") return
  const home = `${window.location.origin}/`
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: authConfig.userPoolId,
        userPoolClientId: authConfig.clientId,
        loginWith: {
          email: true,
          ...(authConfig.domain
            ? {
                oauth: {
                  domain: authConfig.domain,
                  scopes: ["openid", "email", "profile"],
                  redirectSignIn: [home],
                  redirectSignOut: [home],
                  responseType: "code" as const,
                },
              }
            : {}),
        },
      },
    },
  })
  configured = true
}

/** The current access token, refreshed by Amplify when it is about to expire. */
export async function getAccessToken(): Promise<string | null> {
  if (!isAuthConfigured) return null
  configureAuth()
  try {
    const session = await fetchAuthSession()
    return session.tokens?.accessToken?.toString() ?? null
  } catch {
    return null
  }
}

/** Cognito errors carry a readable message; fall back for anything else. */
export function authErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Something went wrong."
}
