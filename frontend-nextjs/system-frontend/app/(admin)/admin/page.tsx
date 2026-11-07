import type { Metadata } from "next";
import AdminDashboardOverview from "@/app/components/admin-dashboard-overview";

export const metadata: Metadata = {
  title: "Admin Overview | PickleCourt",
  description: "Admin dashboard overview for PickleCourt.",
};

export default function AdminOverviewPage() {
  return <AdminDashboardOverview />;
}
