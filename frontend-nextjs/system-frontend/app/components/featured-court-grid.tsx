import Link from "next/link";
import CourtCard from "./court-card";
import { getCourts } from "../lib/courts-api";
import { selectFeaturedCourts } from "../lib/featured-courts";

export function FeaturedCourtGridSkeleton() {
    return (
        <div aria-label="Loading available courts" role="status" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            <span className="sr-only">Loading courts...</span>
            {[0, 1, 2].map((item) => (
                <div key={item} aria-hidden="true" className="overflow-hidden rounded-card border border-border bg-white shadow-soft">
                    <div className="aspect-[1.55] animate-pulse bg-[#edf1eb]" />
                    <div className="space-y-3 p-5 sm:p-6">
                        <div className="h-4 w-1/3 animate-pulse rounded bg-[#edf1eb]" />
                        <div className="h-6 w-2/3 animate-pulse rounded bg-[#edf1eb]" />
                        <div className="h-4 w-full animate-pulse rounded bg-[#edf1eb]" />
                        <div className="h-10 w-32 animate-pulse rounded-full bg-[#edf1eb]" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default async function FeaturedCourtGrid() {
    try {
        const courts = selectFeaturedCourts(await getCourts(), 3);
        if (courts.length === 0) {
            return (
                <p role="status" className="rounded-2xl border border-dashed border-primary/25 bg-[#f8faf7] px-5 py-10 text-center text-sm text-muted">
                    No courts are available right now.
                </p>
            );
        }

        return (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {courts.map((court) => <CourtCard key={court.id} court={court} compact />)}
            </div>
        );
    } catch {
        return (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-900">
                <p>We couldn&apos;t load featured courts right now.</p>
                <a href="/" className="mt-3 inline-flex min-h-10 items-center rounded-full px-4 font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800">
                    Try again
                </a>
            </div>
        );
    }
}
