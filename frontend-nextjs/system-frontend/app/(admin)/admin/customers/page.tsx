import type { Metadata } from "next";
import AdminCustomerManagement from "@/app/components/admin-customer-management";
import Container from "@/app/components/container";

export const metadata: Metadata = {
  title: "Customer Management | PickleCourt Admin",
  description: "View customers and their pickleball booking activity.",
};

export default function AdminCustomersPage() {
  return (
    <Container className="max-w-none px-0">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Administration</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Customer Management</h1>
        <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
          View customers and their pickleball booking activity.
        </p>
      </header>
      <AdminCustomerManagement />
    </Container>
  );
}
