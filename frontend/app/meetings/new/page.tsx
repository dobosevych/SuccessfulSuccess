import { TodayPage } from "@/components/today-page";

export const metadata = {
  title: "New meeting — SuccessfulSuccess",
};

/** Same screen as "/today", with the create dialog already open. */
export default function NewMeetingPage() {
  return <TodayPage initialDialogOpen />;
}
