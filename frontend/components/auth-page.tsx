"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  confirmResetPassword,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  signIn,
  signInWithRedirect,
  signUp,
} from "aws-amplify/auth"
import { AlertCircle, ArrowLeft, Clock, Eye, EyeOff, MailCheck, Sparkles, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useAuth } from "@/components/auth-provider"
import { AuthLoading } from "@/components/require-auth"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authConfig, authErrorMessage, configureAuth, isAuthConfigured } from "@/lib/auth"

/** Which card the page shows. `email` carries over between steps. */
type Step =
  | { kind: "signIn" }
  | { kind: "signUp" }
  | { kind: "confirmSignUp"; email: string; password: string; destination?: string }
  | { kind: "forgotPassword" }
  | { kind: "resetPassword"; email: string; destination?: string }

const email = z.email("Enter a valid email address")

// Mirrors the user pool's password policy in infra/auth.yml.
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number")

const code = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email")

const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password") })
const signUpSchema = z.object({ email, password: newPassword })
const confirmSchema = z.object({ code })
const forgotSchema = z.object({ email })
const resetSchema = z.object({ code, password: newPassword })

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-destructive text-sm">
      {message}
    </p>
  ) : null
}

function FormError({ message }: { message: string | null }) {
  return message ? (
    <div
      role="alert"
      className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-2xl px-4 py-3 text-sm"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  ) : null
}

function PasswordInput({
  id,
  autoComplete,
  invalid,
  ...props
}: React.ComponentProps<"input"> & { invalid?: boolean }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        className="h-12 pr-12"
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-1/2 right-2 -translate-y-1/2"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  )
}

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


function SignInForm({ onStep }: { onStep: (step: Step) => void }) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(signInSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const { nextStep } = await signIn({ username: values.email, password: values.password })
      if (nextStep.signInStep === "CONFIRM_SIGN_UP") {
        // Signed up earlier but never entered the code: send a fresh one.
        const { destination } = await resendSignUpCode({ username: values.email })
        onStep({ kind: "confirmSignUp", email: values.email, password: values.password, destination })
      } else if (nextStep.signInStep !== "DONE") {
        setError("This account needs a sign-in step the app does not support yet.")
      }
      // DONE: the auth provider hears about it and the page moves on to /today.
    } catch (caught) {
      setError(authErrorMessage(caught))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
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
        <FieldError id="email-error" message={errors.email?.message} />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            className="text-primary text-sm font-medium hover:underline"
            onClick={() => onStep({ kind: "forgotPassword" })}
          >
            Forgot password?
          </button>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder="Your password"
          invalid={!!errors.password}
          {...register("password")}
        />
        <FieldError id="password-error" message={errors.password?.message} />
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2 h-12 w-full text-[0.95rem]">
        {isSubmitting ? "Logging in…" : "Log in"}
      </Button>
    </form>
  )
}

function SignUpForm({ onStep }: { onStep: (step: Step) => void }) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(signUpSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const { nextStep } = await signUp({
        username: values.email,
        password: values.password,
        options: { userAttributes: { email: values.email } },
      })
      if (nextStep.signUpStep === "CONFIRM_SIGN_UP") {
        onStep({
          kind: "confirmSignUp",
          email: values.email,
          password: values.password,
          destination: nextStep.codeDeliveryDetails.destination,
        })
      } else {
        await signIn({ username: values.email, password: values.password })
      }
    } catch (caught) {
      setError(authErrorMessage(caught))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
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
        <FieldError id="email-error" message={errors.email?.message} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="8+ characters, upper & lower case, a number"
          invalid={!!errors.password}
          {...register("password")}
        />
        <FieldError id="password-error" message={errors.password?.message} />
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2 h-12 w-full text-[0.95rem]">
        {isSubmitting ? "Creating account…" : "Sign up"}
      </Button>
    </form>
  )
}

function CodeInput({ invalid, ...props }: React.ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <Input
      id="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="123456"
      maxLength={6}
      className="h-12 text-center font-mono text-lg tracking-[0.5em]"
      aria-invalid={invalid}
      aria-describedby={invalid ? "code-error" : undefined}
      {...props}
    />
  )
}

function ConfirmSignUpForm({ step }: { step: Extract<Step, { kind: "confirmSignUp" }> }) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(confirmSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await confirmSignUp({ username: step.email, confirmationCode: values.code })
      await signIn({ username: step.email, password: step.password })
    } catch (caught) {
      setError(authErrorMessage(caught))
    }
  })

  const onResend = async () => {
    try {
      await resendSignUpCode({ username: step.email })
      toast.success("We sent you a new code.")
    } catch (caught) {
      setError(authErrorMessage(caught))
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
      <div className="grid gap-2">
        <Label htmlFor="code">Verification code</Label>
        <CodeInput invalid={!!errors.code} {...register("code")} />
        <FieldError id="code-error" message={errors.code?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting} className="mt-2 h-12 w-full text-[0.95rem]">
        {isSubmitting ? "Verifying…" : "Verify and continue"}
      </Button>
      <button
        type="button"
        className="text-primary text-sm font-medium hover:underline"
        onClick={onResend}
      >
        Resend the code
      </button>
    </form>
  )
}

function ForgotPasswordForm({ onStep }: { onStep: (step: Step) => void }) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const { nextStep } = await resetPassword({ username: values.email })
      onStep({
        kind: "resetPassword",
        email: values.email,
        destination: nextStep.codeDeliveryDetails?.destination,
      })
    } catch (caught) {
      setError(authErrorMessage(caught))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
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
        <FieldError id="email-error" message={errors.email?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting} className="mt-2 h-12 w-full text-[0.95rem]">
        {isSubmitting ? "Sending…" : "Send reset code"}
      </Button>
    </form>
  )
}

function ResetPasswordForm({ step }: { step: Extract<Step, { kind: "resetPassword" }> }) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await confirmResetPassword({
        username: step.email,
        confirmationCode: values.code,
        newPassword: values.password,
      })
      toast.success("Password changed")
      await signIn({ username: step.email, password: values.password })
    } catch (caught) {
      setError(authErrorMessage(caught))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
      <div className="grid gap-2">
        <Label htmlFor="code">Reset code</Label>
        <CodeInput invalid={!!errors.code} {...register("code")} />
        <FieldError id="code-error" message={errors.code?.message} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="8+ characters, upper & lower case, a number"
          invalid={!!errors.password}
          {...register("password")}
        />
        <FieldError id="password-error" message={errors.password?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting} className="mt-2 h-12 w-full text-[0.95rem]">
        {isSubmitting ? "Saving…" : "Set new password"}
      </Button>
    </form>
  )
}

const HEADINGS: Record<Step["kind"], React.ReactNode> = {
  signIn: (
    <>
      Log in or <span className="text-gradient-canva">sign up</span> in seconds
    </>
  ),
  signUp: (
    <>
      Create your <span className="text-gradient-canva">free account</span>
    </>
  ),
  confirmSignUp: (
    <>
      Check your <span className="text-gradient-canva">inbox</span>
    </>
  ),
  forgotPassword: (
    <>
      Reset your <span className="text-gradient-canva">password</span>
    </>
  ),
  resetPassword: (
    <>
      Choose a <span className="text-gradient-canva">new password</span>
    </>
  ),
}

function subtitle(step: Step): string {
  switch (step.kind) {
    case "signIn":
    case "signUp":
      return "Use your email or Google to continue with SuccessfulSuccess — it's free!"
    case "confirmSignUp":
      return `We emailed a 6-digit code to ${step.destination ?? step.email}. Enter it to finish signing up.`
    case "forgotPassword":
      return "Enter your account's email and we'll send you a code to reset your password."
    case "resetPassword":
      return `Enter the code we sent to ${step.destination ?? step.email} and your new password.`
  }
}

export function AuthPage() {
  const { status } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>({ kind: "signIn" })

  // Signed in already, or just now: straight to the app.
  useEffect(() => {
    if (status === "signedIn") router.replace("/today")
  }, [status, router])

  const onGoogle = async () => {
    if (!authConfig.googleEnabled || !authConfig.domain) {
      toast.info("Google sign-in isn't enabled on this deployment yet.")
      return
    }
    try {
      configureAuth()
      await signInWithRedirect({ provider: "Google" })
    } catch (caught) {
      toast.error(authErrorMessage(caught))
    }
  }

  const isEntry = step.kind === "signIn" || step.kind === "signUp"

  if (status !== "signedOut") {
    return (
      <>
        <SiteHeader />
        <AuthLoading label={status === "signedIn" ? "Opening your meetings…" : undefined} />
      </>
    )
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 p-4 sm:p-6 lg:grid-cols-2 lg:p-8">
        <div className="flex flex-col">
          <div className="flex flex-1 items-center justify-center py-6">
            <div className="bg-card w-full max-w-md rounded-[2rem] border p-8 shadow-[0_24px_60px_-20px_rgba(139,61,255,0.25)] sm:p-10">
              {!isEntry ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-medium"
                  onClick={() => setStep({ kind: "signIn" })}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Back to log in
                </button>
              ) : null}

              {step.kind === "confirmSignUp" ? (
                <span className="tint-violet mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
                  <MailCheck className="size-5" aria-hidden />
                </span>
              ) : null}

              <h1 className="text-center text-3xl font-extrabold tracking-tight">
                {HEADINGS[step.kind]}
              </h1>
              <p className="text-muted-foreground mt-3 text-center text-sm">{subtitle(step)}</p>

              {!isAuthConfigured ? (
                <div className="tint-amber mt-6 rounded-2xl px-4 py-3 text-sm">
                  Sign-in isn&apos;t configured. Run <code>make aws-deploy-auth</code> and put the
                  values from <code>make aws-auth-env</code> in <code>.env</code>.
                </div>
              ) : null}

              {isEntry ? (
                <>
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
                </>
              ) : (
                <div className="mt-8" />
              )}

              {/* Keyed by step so each form starts empty. */}
              {step.kind === "signIn" ? <SignInForm key="signIn" onStep={setStep} /> : null}
              {step.kind === "signUp" ? <SignUpForm key="signUp" onStep={setStep} /> : null}
              {step.kind === "confirmSignUp" ? <ConfirmSignUpForm step={step} /> : null}
              {step.kind === "forgotPassword" ? <ForgotPasswordForm onStep={setStep} /> : null}
              {step.kind === "resetPassword" ? <ResetPasswordForm step={step} /> : null}

              {isEntry ? (
                <p className="text-muted-foreground mt-6 text-center text-sm">
                  {step.kind === "signIn" ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    className="text-primary font-semibold hover:underline"
                    onClick={() =>
                      setStep({ kind: step.kind === "signIn" ? "signUp" : "signIn" })
                    }
                  >
                    {step.kind === "signIn" ? "Sign up" : "Log in"}
                  </button>
                </p>
              ) : null}

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
