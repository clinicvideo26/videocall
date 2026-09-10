import { redirect } from "next/navigation";

// Default the dashboard to the doctor's queue.
export default function DashboardIndex() {
  redirect("/dashboard/queue");
}
