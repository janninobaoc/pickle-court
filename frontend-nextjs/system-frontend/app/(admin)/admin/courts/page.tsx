import type { Metadata } from "next";
import AdminCourtManagement from "@/app/components/admin-court-management";
import Container from "@/app/components/container";

export const metadata: Metadata = {
  title: "Court Management | PickleCourt Admin",
  description: "Manage pickleball court listings, pricing, and availability.",
};

export default function AdminCourtsPage() {
  return (
    <Container className="max-w-none px-0">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Administration</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Court Management</h1>
        <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
          Manage your pickleball courts, pricing, and availability.
        </p>
      </header>
      <AdminCourtManagement />
    </Container>
  );
}
