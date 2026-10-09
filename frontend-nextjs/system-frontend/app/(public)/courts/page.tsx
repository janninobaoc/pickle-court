import type { Metadata } from "next";
import Container from "@/app/components/container";
import CourtListing from "@/app/components/court-listing";
import { getCourts } from "@/app/lib/courts-api";
import { mapApiCourt } from "@/app/lib/court-mapper";

export const metadata: Metadata = {
  title: "Find Your Perfect Court | PickleCourt",
  description: "Explore our pickleball courts and find the perfect place for your next game.",
};

export default async function CourtsPage() {
  let courts: ReturnType<typeof mapApiCourt>[] = [];
  let error: string | null = null;

  try {
    const apiCourts = await getCourts();
    courts = apiCourts.map(mapApiCourt);
  } catch (err) {
    console.error("Failed to fetch courts:", err);
    error = "Unable to load courts. Please try again later.";
  }

  return (
    <main className="flex-1 pb-16 sm:pb-20">
      <section className="bg-primary py-14 sm:py-16 lg:py-20">
        <Container>
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:text-sm">
            <span aria-hidden="true" className="h-0.5 w-9 rounded-full bg-accent" />
            Find Your Perfect Court
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Find Your Next <span className="text-accent">Place to Play.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#D1E2DB] sm:mt-6 sm:text-lg sm:leading-8">
            Explore indoor and outdoor pickleball courts, compare facilities, and find the perfect spot for your next match.
          </p>
        </Container>
      </section>

      <Container className="py-8 sm:py-10 lg:py-12">
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700"
          >
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        ) : courts.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
            <h2 className="text-xl font-semibold text-gray-900">
              No courts available
            </h2>

            <p className="mt-2 text-gray-600">
              There are currently no pickleball courts listed.
              Please check back later.
            </p>
          </div>
        ) : (
          <CourtListing courts={courts} />
        )}
      </Container>
    </main>
  );
}
