import Link from "next/link";
import type { Court } from "../data/courts";
import CourtImage from "./court-image";

type CourtCardProps = { court: Court; compact?: boolean };

export default function CourtCard({ court, compact = false }: CourtCardProps) {
  return (
    <article className={`group overflow-hidden border border-border bg-white transition duration-300 ${compact ? "rounded-card shadow-soft hover:-translate-y-1 hover:shadow-xl" : "flex h-full flex-col rounded-3xl shadow-[0_8px_28px_rgba(31,41,55,0.06)] hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_18px_42px_rgba(22,74,65,0.13)] motion-reduce:transition-none"}`}>
      <CourtImage
        src={court.image}
        alt={`${court.category} pickleball court at ${court.name}`}
        variant={court.artwork}
        className={`aspect-[1.55] w-full ${compact ? "" : "shrink-0"}`}
      />
      <div className={compact ? "p-5 sm:p-6" : "flex flex-1 flex-col p-5 sm:p-6"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={compact ? "text-xs font-semibold uppercase tracking-[0.14em] text-primary/75" : "inline-flex min-h-7 items-center rounded-full bg-[#eff8dc] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary"}>{court.category}</p>
              {compact && court.available && <span className="rounded-full bg-[#edf7df] px-2.5 py-1 text-[11px] font-semibold text-primary">Available for booking</span>}
            </div>
            <h3 className={compact ? "mt-2 text-lg font-bold tracking-tight text-foreground" : "mt-2 break-words text-lg font-bold tracking-tight text-foreground sm:text-xl"}>
              {court.name}
            </h3>
          </div>
          <p className={compact ? "shrink-0 text-right text-sm font-semibold text-primary" : "shrink-0 text-right text-sm font-bold text-primary sm:text-base"}>
            ₱{court.pricePerHour}
            <span className="block text-xs font-normal text-muted">/ hour</span>
          </p>
        </div>
        <p className="mt-3 min-h-12 text-sm leading-6 text-muted">
          {court.description}
        </p>
        {!compact && (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-muted">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mr-1 inline size-4 text-primary">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
                  <circle cx="12" cy="10" r="2" />
                </svg>
                {court.location}
              </p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${court.available ? "bg-[#edf7df] text-primary" : "bg-gray-100 text-gray-600"}`}>
                {court.available ? "Available" : "Unavailable"} · sample
              </span>
            </div>
            <ul aria-label="Amenities" className="mt-3 flex flex-wrap gap-1.5">
              {court.amenities.slice(0, 2).map((amenity) => (
                <li key={amenity} className="rounded-md bg-background px-2 py-1 text-[11px] font-medium text-muted">
                  {amenity}
                </li>
              ))}
            </ul>
          </>
        )}
        <Link
          href={`/courts/${court.id}`}
          className={`inline-flex min-h-11 items-center gap-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${compact ? "mt-5 rounded-full border border-primary/15 px-4 text-primary hover:border-primary hover:bg-primary hover:text-white" : "mt-auto w-full justify-between rounded-xl bg-[#f1f6ec] px-4 py-3 text-primary hover:bg-primary hover:text-white motion-reduce:transition-none"}`}
        >
          {compact ? "View Court" : "View Details"}
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </div>
    </article>
  );
}
