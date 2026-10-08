"use client"

import { CalendarDays, ArrowRight, ShieldCheck, Zap, Users } from "lucide-react"
import Link from "next/link"

import { useAuth } from "@/components/auth-provider"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  const { user, isAuthenticated, isLoading } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span
              className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--canva-teal), var(--canva-blue) 45%, var(--canva-violet))",
              }}
            >
              <CalendarDays className="size-7" aria-hidden />
            </span>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Today&apos;s meetings, simplified.
            </h1>
            <p className="text-muted-foreground mt-4 text-lg">
              Manage your schedule, track participants, and organize your day effortlessly with AWS
              Cognito-backed secure authentication.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {!isLoading && isAuthenticated ? (
                <>
                  <Button size="lg" asChild className="gap-2 font-semibold">
                    <Link href="/today">
                      Go to Meetings <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button size="lg" asChild className="gap-2 font-semibold">
                    <Link href="/login">
                      Sign In with Cognito <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-3">
            <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
              <CardHeader>
                <div className="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-xl">
                  <ShieldCheck className="size-5" />
                </div>
                <CardTitle className="text-lg">Cognito Managed Login</CardTitle>
                <CardDescription>
                  Enterprise authentication with OpenID Connect, OAuth2 code flow, and self-service registration.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
              <CardHeader>
                <div className="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-xl">
                  <Zap className="size-5" />
                </div>
                <CardTitle className="text-lg">Serverless &amp; Fast</CardTitle>
                <CardDescription>
                  Powered by AWS Lambda function URLs and Aurora Serverless v2 PostgreSQL.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
              <CardHeader>
                <div className="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-xl">
                  <Users className="size-5" />
                </div>
                <CardTitle className="text-lg">User Isolation</CardTitle>
                <CardDescription>
                  Each user account sees and manages only their own scheduled meetings.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}
