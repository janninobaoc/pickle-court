import type { Court } from "../data/courts";
import type { Booking } from "../lib/booking-api";
import { formatBookingDate, formatPeso, formatPesoExact, formatTime, timeToMinutes } from "../lib/booking-utils";
import CourtImage from "./court-image";

type BookingSummaryProps = {
  court: Court;
  selectedDate: string;
  startTime: string;
  endTime: string;
  bookingResult?: Booking | null;
};

export default function BookingSummary({ court, selectedDate, startTime, endTime, bookingResult = null }: BookingSummaryProps) {
  const hasTimeRange = Boolean(startTime && endTime && timeToMinutes(endTime) > timeToMinutes(startTime));
  const duration = hasTimeRange
    ? (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60
    : 0;
  const total = duration * court.pricePerHour;

  return (
    <aside aria-labelledby="booking-summary-title" className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white shadow-soft lg:sticky lg:top-28 sm:rounded-3xl">
      <div className="bg-primary px-5 py-5 text-white sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Your court</p>
        <h2 id="booking-summary-title" className="mt-1 text-xl font-bold sm:text-2xl">Booking summary</h2>
      </div>

      <div className="p-4 sm:p-5">
        <CourtImage
          src={court.image}
          alt={`${court.category} pickleball court at ${court.name}`}
          variant={court.artwork}
          className="aspect-[1.8] rounded-2xl"
        />

        <div className="mt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="break-words text-lg font-bold leading-tight text-foreground">{court.name}</h3>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">{court.category} court</p>
            </div>
            <span className="inline-flex min-h-7 shrink-0 items-center rounded-full bg-[#eff8dc] px-2.5 py-1 text-xs font-semibold text-primary">Court details</span>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4 shrink-0 text-primary">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
              <circle cx="12" cy="10" r="2" />
            </svg>
            {court.location}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">Operating hours: {court.operatingHours}</p>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Selected schedule</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted">Date</dt>
              <dd className="max-w-[65%] text-right font-medium text-foreground">{formatBookingDate(selectedDate)}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted">Start time</dt>
              <dd className="text-right font-medium text-foreground">{startTime ? formatTime(startTime) : "Not selected"}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted">End time</dt>
              <dd className="text-right font-medium text-foreground">{endTime && hasTimeRange ? formatTime(endTime) : "Not selected"}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-[#f8faf7] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Price breakdown</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Hourly rate</dt>
              <dd className="font-medium text-foreground">{formatPeso(court.pricePerHour)} / hr</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Duration</dt>
              <dd className="font-medium text-foreground">{duration ? `${duration} ${duration === 1 ? "hour" : "hours"}` : "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-[#eff8dc] px-4 py-4">
          <span className="font-semibold text-primary">{bookingResult ? "Server total" : "Estimated total"}</span>
          <span className="text-xl font-extrabold text-primary">{bookingResult ? formatPesoExact(Number(bookingResult.total_amount)) : formatPesoExact(total)}</span>
        </div>
        {bookingResult ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-border p-3 text-sm">
            <div><dt className="text-xs text-muted">Booking ID</dt><dd className="font-semibold text-foreground">{bookingResult.id}</dd></div>
            <div><dt className="text-xs text-muted">Status</dt><dd className="font-semibold capitalize text-foreground">{bookingResult.status}</dd></div>
          </dl>
        ) : (
          <p className="mt-3 text-xs leading-5 text-muted">Estimate based on the listed hourly rate. Laravel checks availability and calculates the final amount when you submit.</p>
        )}
      </div>
    </aside>
  );
}
