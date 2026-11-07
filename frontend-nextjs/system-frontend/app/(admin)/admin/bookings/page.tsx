import type { Metadata } from "next";
import AdminBookingManagement from "@/app/components/admin-booking-management";
import Container from "@/app/components/container";

export const metadata: Metadata = {
  title: "Booking Management | PickleCourt Admin",
  description: "View and manage pickleball court reservations.",
};

export default function AdminBookingsPage() {
  return (
    <Container className="max-w-none px-0">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Administration</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Booking Management</h1>
        <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
          View and manage pickleball court reservations.
        </p>
      </header>
      <AdminBookingManagement />
    </Container>
  );
}
