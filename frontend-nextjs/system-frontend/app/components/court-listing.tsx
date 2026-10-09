"use client";

import { useMemo, useState } from "react";
import type { Court } from "../data/courts";
import CourtCard from "./court-card";
import Button from "./button";

type CourtTypeFilter = "All" | "Indoor" | "Outdoor";
type AvailabilityFilter = "All" | "Available" | "Unavailable";
type PriceSort = "low-to-high" | "high-to-low";

const controlStyles =
  "min-h-12 w-full appearance-none rounded-xl border border-border bg-white px-4 pr-10 text-sm text-foreground outline-none transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

export default function CourtListing({ courts }: { courts: Court[] }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<CourtTypeFilter>("All");
  const [availability, setAvailability] = useState<AvailabilityFilter>("All");
  const [priceSort, setPriceSort] = useState<PriceSort>("low-to-high");

  const filteredCourts = useMemo(() => {
    const searchTerm = search.trim().toLocaleLowerCase();

    return courts
      .filter((court) => {
        const matchesSearch =
          !searchTerm ||
          court.name.toLocaleLowerCase().includes(searchTerm) ||
          court.location.toLocaleLowerCase().includes(searchTerm);
        const matchesType = type === "All" || court.category === type;
        const matchesAvailability =
          availability === "All" || court.available === (availability === "Available");

        return matchesSearch && matchesType && matchesAvailability;
      })
      .sort((first, second) =>
        priceSort === "low-to-high"
          ? first.pricePerHour - second.pricePerHour
          : second.pricePerHour - first.pricePerHour,
      );
  }, [availability, courts, priceSort, search, type]);

  function resetFilters() {
    setSearch("");
    setType("All");
    setAvailability("All");
    setPriceSort("low-to-high");
  }

  return (
    <>
      <section aria-label="Search and filter courts" className="rounded-3xl border border-border bg-white p-4 shadow-soft sm:p-6 lg:p-7">
        <div>
          <label htmlFor="court-search" className="text-sm font-semibold text-foreground">Search courts</label>
          <div className="relative mt-2">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              id="court-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search courts by name or location..."
              className="min-h-12 w-full rounded-xl border border-border bg-white py-3 pl-12 pr-4 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted hover:border-primary/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 sm:text-base"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(10rem,0.55fr)_minmax(10rem,0.55fr)] md:items-end">
          <fieldset className="min-w-0">
            <legend className="text-sm font-semibold text-foreground">Court type</legend>
            <div role="group" aria-label="Filter by court type" className="mt-2 flex flex-wrap gap-2">
              {([
                ["All", "All Courts"],
                ["Indoor", "Indoor"],
                ["Outdoor", "Outdoor"],
              ] as const).map(([value, label]) => {
                const active = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setType(value)}
                    className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? "border-primary bg-primary text-white" : "border-border bg-[#f8faf7] text-foreground hover:border-primary/40 hover:bg-primary/5"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="court-availability" className="text-sm font-semibold text-foreground">Availability</label>
            <div className="relative mt-2">
              <select
                id="court-availability"
                value={availability}
                onChange={(event) => setAvailability(event.target.value as AvailabilityFilter)}
                className={controlStyles}
              >
                <option value="All">All availability</option>
                <option value="Available">Available</option>
                <option value="Unavailable">Unavailable</option>
              </select>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted">
                <path d="m7 10 5 5 5-5" />
              </svg>
            </div>
          </div>

          <div>
            <label htmlFor="court-price-sort" className="text-sm font-semibold text-foreground">Sort by price</label>
            <div className="relative mt-2">
              <select
                id="court-price-sort"
                value={priceSort}
                onChange={(event) => setPriceSort(event.target.value as PriceSort)}
                className={controlStyles}
              >
                <option value="low-to-high">Price: Low to High</option>
                <option value="high-to-low">Price: High to Low</option>
              </select>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted">
                <path d="m7 10 5 5 5-5" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Explore Courts</h2>
          <p aria-live="polite" className="mt-1 text-sm text-muted">
            Showing {filteredCourts.length} {filteredCourts.length === 1 ? "court" : "courts"}
          </p>
        </div>
        <p>
          Court status reflects whether a court is available for booking.
          Time-slot availability is not yet verified against existing reservations.
        </p>
      </div>

      {filteredCourts.length > 0 ? (
        <div className="mt-5 grid items-stretch gap-5 sm:grid-cols-2 lg:mt-6 lg:grid-cols-3 lg:gap-6">
          {filteredCourts.map((court) => <CourtCard key={court.id} court={court} />)}
        </div>
      ) : (
        <section className="mt-5 rounded-3xl border border-dashed border-primary/25 bg-white px-5 py-14 text-center sm:mt-6 sm:py-16">
          <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eff8dc] text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-6">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4M8.5 8.5l5 5m0-5-5 5" />
            </svg>
          </span>
          <h2 className="mt-4 text-xl font-bold text-foreground">No courts found</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
            Try adjusting your search or filters to find a court that fits your game.
          </p>
          <Button type="button" variant="secondary" onClick={resetFilters} className="mt-5 rounded-xl">
            Clear Filters
          </Button>
        </section>
      )}
    </>
  );
}
