import { RequireAuth } from "@/components/require-auth"

/** Every page in this group needs a signed-in user. */
export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}
