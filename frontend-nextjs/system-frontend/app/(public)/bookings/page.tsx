import type { Metadata } from "next";
import Button from "@/app/components/button";
import BookingList from "@/app/components/booking-list";
import Container from "@/app/components/container";

export const metadata: Metadata = {
  title: "My Bookings | PickleCourt",
  description: "View and manage your pickleball court reservations.",
};

export default function BookingsPage() {
  return (
    <main className="flex-1 pb-16 sm:pb-20">
      <section className="border-b border-border/70 bg-[#f8faf7] py-12 sm:py-14 lg:py-16">
        <Container className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:text-sm">
              <span aria-hidden="true" className="h-0.5 w-8 rounded-full bg-accent" />
              Your Pickleball Schedule
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-primary sm:text-5xl lg:text-6xl">
              My <span className="text-[#5C9142]">Bookings.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              Keep track of your court bookings and review your upcoming games.
            </p>
          </div>
          <Button href="/courts" className="min-h-12 w-fit gap-2 rounded-xl bg-accent px-5 font-bold text-primary hover:bg-[#d4f695] focus-visible:outline-primary">
            Explore Courts
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </Button>
        </Container>
      </section>

      <Container className="py-8 sm:py-10 lg:py-12">
        <BookingList />
      </Container>
    </main>
  );
}
