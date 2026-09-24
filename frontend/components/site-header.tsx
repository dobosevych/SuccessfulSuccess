import { CalendarDays } from "lucide-react"
import Link from "next/link"

/** Shared top bar: the same logo, height, width and frosted background on every page. */
export function SiteHeader({
  href = "/",
  children,
}: {
  href?: string
  children?: React.ReactNode
}) {
  return (
    <header className="bg-background/70 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href={href} className="flex items-center gap-2.5 font-bold tracking-tight">
          <span
            className="flex size-9 items-center justify-center rounded-full text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--canva-teal), var(--canva-blue) 45%, var(--canva-violet))",
            }}
          >
            <CalendarDays className="size-4.5" aria-hidden />
          </span>
          <span className="hidden text-[0.95rem] sm:inline">SuccessfulSuccess</span>
        </Link>
        {children}
      </div>
    </header>
  )
}
