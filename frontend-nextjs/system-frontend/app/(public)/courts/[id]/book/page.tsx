import Link from "next/link";
import { notFound } from "next/navigation";
import BookingForm from "@/app/components/booking-form";
import Container from "@/app/components/container";
import { getCourtById } from "@/app/lib/courts-api";
import { mapApiCourt } from "@/app/lib/court-mapper";
import type { BookingSelectionParams } from "@/app/lib/booking-selection";

type BookingPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string | string[]; start?: string | string[]; end?: string | string[] }>;
};

export default async function BookingPage({ params, searchParams }: BookingPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const apiCourt = await getCourtById(id);

  if (!apiCourt) {
    notFound();
  }

  const court = mapApiCourt(apiCourt);
  const selectionParams: BookingSelectionParams = {
    date: query.date,
    start: query.start,
    end: query.end,
  };

  return (
    <main className="flex-1 pb-16 sm:pb-20">
      <Container className="pt-6 sm:pt-8">
        <Link
          href={`/courts/${court.id}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-primary transition-colors hover:text-[#5C9142] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span aria-hidden="true">←</span> Back to Court Details
        </Link>
        <div className="mb-8 mt-5 sm:mb-10">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:text-sm">
            <span aria-hidden="true" className="h-0.5 w-8 rounded-full bg-accent" />
            Court Reservation
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-primary sm:text-5xl lg:text-6xl">
            Book Your <span className="text-[#5C9142]">Court.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            Choose your preferred schedule and review your booking details.
          </p>
        </div>
        <BookingForm key={court.id} court={court} selectionParams={selectionParams} />
      </Container>
    </main>
  );
}
