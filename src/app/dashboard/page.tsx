import { redirect } from "next/navigation";

// Default the dashboard to the New Consultation tab.
export default function DashboardIndex() {
  redirect("/dashboard/new");
}
