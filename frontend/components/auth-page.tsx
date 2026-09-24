"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Sparkles, Users, Clock } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Mode = "login" | "signup"

const formSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
})

type FormValues = z.infer<typeof formSchema>

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
    </svg>
  )
}

/** Decorative right-hand panel: a gradient canvas with floating "meeting" cards. */
function Showcase() {
  return (
    <div
      className="relative hidden overflow-hidden rounded-[2rem] lg:block"
      style={{
        backgroundImage:
          "linear-gradient(135deg, var(--canva-teal) 0%, var(--canva-blue) 45%, var(--canva-violet) 80%, var(--canva-pink) 120%)",
      }}
      aria-hidden
    >
      <div className="absolute -top-16 -left-16 size-64 rounded-full bg-white/15 blur-2xl" />
      <div className="absolute -right-10 -bottom-20 size-72 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex h-full flex-col justify-between p-10 text-white">
        <div>
          <p className="text-sm font-semibold tracking-wide text-white/80 uppercase">
            SuccessfulSuccess
          </p>
          <h2 className="mt-3 max-w-sm text-4xl leading-tight font-extrabold tracking-tight">
            Every meeting, beautifully organised.
          </h2>
        </div>

        <div className="relative h-72">
          <div className="absolute top-0 left-0 w-64 -rotate-3 rounded-3xl bg-white p-4 text-[var(--canva-ink)] shadow-2xl">
            <div className="tint-violet inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
              <Clock className="size-3.5" /> 09:30 – 10:00
            </div>
            <p className="mt-3 font-bold">Daily stand-up</p>
            <p className="text-muted-foreground text-sm">Design team · Room 3</p>
          </div>
          <div className="absolute top-24 right-0 w-60 rotate-2 rounded-3xl bg-white p-4 text-[var(--canva-ink)] shadow-2xl">
            <div className="tint-teal inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
              <Users className="size-3.5" /> 4 people
            </div>
            <p className="mt-3 font-bold">Sprint planning</p>
            <p className="text-muted-foreground text-sm">13:00 – 14:30</p>
          </div>
          <div className="absolute bottom-0 left-10 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-sm font-semibold text-[var(--canva-ink)] shadow-xl">
            <Sparkles className="size-4 text-[var(--canva-pink)]" /> 3 meetings today
          </div>
        </div>
      </div>
    </div>
  )
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("login")
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) })

  const isLogin = mode === "login"

  // Not wired to the backend yet: just acknowledge the attempt.
  const onSubmit = (values: FormValues) => {
    toast.info(
      `${isLogin ? "Log in" : "Sign up"} as ${values.email} isn't connected yet.`,
    )
  }

  const onGoogle = () => {
    toast.info("Google sign-in isn't connected yet.")
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 p-4 sm:p-6 lg:grid-cols-2 lg:p-8">
        <div className="flex flex-col">
          <div className="flex flex-1 items-center justify-center py-6">
            <div className="bg-card w-full max-w-md rounded-[2rem] border p-8 shadow-[0_24px_60px_-20px_rgba(139,61,255,0.25)] sm:p-10">
              <h1 className="text-center text-3xl font-extrabold tracking-tight">
                {isLogin ? (
                  <>
                    Log in or <span className="text-gradient-canva">sign up</span> in seconds
                  </>
                ) : (
                  <>
                    Create your <span className="text-gradient-canva">free account</span>
                  </>
                )}
              </h1>
              <p className="text-muted-foreground mt-3 text-center text-sm">
                Use your email or Google to continue with SuccessfulSuccess — it&apos;s free!
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-8 h-12 w-full gap-3 text-[0.95rem]"
                onClick={onGoogle}
              >
                <GoogleIcon />
                Continue with Google
              </Button>

              <FieldSeparator className="my-6">or</FieldSeparator>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-12"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    {...register("email")}
                  />
                  {errors.email ? (
                    <p id="email-error" className="text-destructive text-sm">
                      {errors.email.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {isLogin ? (
                      <button
                        type="button"
                        className="text-primary text-sm font-medium hover:underline"
                        onClick={() => toast.info("Password reset isn't connected yet.")}
                      >
                        Forgot password?
                      </button>
                    ) : null}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      placeholder="At least 8 characters"
                      className="h-12 pr-12"
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "password-error" : undefined}
                      {...register("password")}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1/2 right-2 -translate-y-1/2"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                  {errors.password ? (
                    <p id="password-error" className="text-destructive text-sm">
                      {errors.password.message}
                    </p>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 h-12 w-full text-[0.95rem]"
                >
                  {isLogin ? "Log in" : "Sign up"}
                </Button>
              </form>

              <p className="text-muted-foreground mt-6 text-center text-sm">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="text-primary font-semibold hover:underline"
                  onClick={() => setMode(isLogin ? "signup" : "login")}
                >
                  {isLogin ? "Sign up" : "Log in"}
                </button>
              </p>

              <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
                By continuing, you agree to the SuccessfulSuccess Terms of Use and
                acknowledge the Privacy Policy.
              </p>
            </div>
          </div>
        </div>

        <Showcase />
      </main>
    </>
  )
}
