"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import type { Court } from "../data/courts";
import { formatPeso } from "../lib/booking-utils";
import Button from "./button";
import CourtEditorForm from "./court-editor-form";
import { mapApiCourt } from "../lib/court-mapper";
import { useAuth } from "@/contexts/auth-context";
import { AdminCourtsApiError, getAdminCourts } from "../lib/admin-courts-api";

type CourtTypeFilter = "All" | "Indoor" | "Outdoor";
type AvailabilityFilter = "All" | "Available" | "Unavailable";
type CourtChanges = Omit<Court, "id">;

const filterStyles =
  "mt-1.5 min-h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-foreground outline-none transition hover:border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

export default function AdminCourtManagement() {
  const [localCourts, setLocalCourts] = useState<Court[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CourtTypeFilter>("All");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("All");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const { refreshUser } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function loadCourts() {
      try {
        const apiCourts = await getAdminCourts();
        const mappedCourts = apiCourts.map(mapApiCourt);

        if (!cancelled) {
          setLocalCourts(mappedCourts);
        }
      } catch (err) {
        if (cancelled) return;

        if (err instanceof AdminCourtsApiError) {
          if (err.status === 401) {
            setError("Your session has expired. Checking authentication...");
            void refreshUser();
            return;
          }

          if (err.status === 403) {
            setError("You do not have permission to manage courts.");
            return;
          }
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load courts."
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    setIsLoading(true);
    setError(null);
    void loadCourts();

    return () => {
      cancelled = true;
    };
  }, [retryCount, refreshUser]);

  const filteredCourts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return localCourts.filter((court) => {
      const matchesQuery = !query || court.name.toLocaleLowerCase().includes(query) || court.location.toLocaleLowerCase().includes(query);
      const matchesType = typeFilter === "All" || court.category === typeFilter;
      const matchesAvailability = availabilityFilter === "All" || court.available === (availabilityFilter === "Available");
      return matchesQuery && matchesType && matchesAvailability;
    });
  }, [availabilityFilter, localCourts, search, typeFilter]);

  function openAddForm() {
    setEditingCourt(null);
    setEditorKey((key) => key + 1);
    setEditorOpen(true);
    setSuccessMessage("");
  }

  function openEditForm(court: Court) {
    setEditingCourt(court);
    setEditorKey((key) => key + 1);
    setEditorOpen(true);
    setSuccessMessage("");
  }

  function saveCourt(changes: CourtChanges) {
    if (editingCourt) {
      setLocalCourts((current) => current.map((court) =>
        court.id === editingCourt.id ? { ...court, ...changes, image: changes.image ?? court.image, id: court.id } : court,
      ));
      setSuccessMessage("Demo action: court updated in local page state only.");
    } else {
      let suffix = 1;
      let id = `demo-court-${suffix}`;
      while (localCourts.some((court) => court.id === id)) {
        suffix += 1;
        id = `demo-court-${suffix}`;
      }
      setLocalCourts((current) => [...current, { ...changes, id }]);
      setSuccessMessage("Demo action: court added to local page state only.");
    }
    setEditorOpen(false);
    setEditingCourt(null);
    resetFilters();
  }

  function deleteCourt(court: Court) {
    const confirmed = window.confirm(
      `Demo-only deletion: remove “${court.name}” from this page's temporary local state? This will not affect the shared dataset or backend.`,
    );
    if (!confirmed) return;

    setLocalCourts((current) => current.filter((item) => item.id !== court.id));
    setSuccessMessage("Demo action: court removed from local page state only.");
    if (editingCourt?.id === court.id) {
      setEditorOpen(false);
      setEditingCourt(null);
    }
  }

  function resetFilters() {
    setSearch("");
    setTypeFilter("All");
    setAvailabilityFilter("All");
  }

  if (isLoading) {
    return <p>Loading courts...</p>;
  }

  if (error) {
    return (
      <div role="alert">
        <p>{error}</p>

        <button
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-900" role="note">
        Demo Court Management — Changes are temporary and will reset when the page reloads.
      </div>

      {successMessage && (
        <p role="status" aria-live="polite" className="rounded-xl border border-primary/20 bg-[#f1f7e9] px-4 py-3 text-sm font-medium text-primary">
          {successMessage}
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <label htmlFor="admin-court-search" className="text-sm font-semibold text-foreground">Search courts</label>
          <input
            id="admin-court-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Court name or location"
            className={`${filterStyles} sm:max-w-md`}
          />
        </div>
        <Button type="button" disabled onClick={openAddForm} className="shrink-0">Add Court</Button>
      </div>

      <section aria-label="Court filters" className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="admin-court-type" className="text-sm font-semibold text-foreground">Court type</label>
          <select id="admin-court-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as CourtTypeFilter)} className={filterStyles}>
            <option>All</option>
            <option>Indoor</option>
            <option>Outdoor</option>
          </select>
        </div>
        <div>
          <label htmlFor="admin-court-availability" className="text-sm font-semibold text-foreground">Availability</label>
          <select id="admin-court-availability" value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value as AvailabilityFilter)} className={filterStyles}>
            <option>All</option>
            <option>Available</option>
            <option>Unavailable</option>
          </select>
        </div>
      </section>

      {editorOpen && (
        <CourtEditorForm
          key={editorKey}
          initialCourt={editingCourt}
          onSave={saveCourt}
          onCancel={() => { setEditorOpen(false); setEditingCourt(null); }}
        />
      )}

      <section aria-label="Courts table" className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <p aria-live="polite" className="text-sm font-medium text-muted">{filteredCourts.length} {filteredCourts.length === 1 ? "court" : "courts"}</p>
          {(search || typeFilter !== "All" || availabilityFilter !== "All") && (
            <button type="button" onClick={resetFilters} className="min-h-9 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              Reset Filters
            </button>
          )}
        </div>
        {filteredCourts.length ? (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <caption className="sr-only">Court list with type, location, hourly rate, status, and actions</caption>
              <thead className="bg-[#f7f9f6] text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Court Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Location</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Hourly Rate</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCourts.map((court) => (
                  <tr key={court.id} className="text-foreground">
                    <td className="px-5 py-4 font-semibold">{court.name}</td>
                    <td className="whitespace-nowrap px-4 py-4">{court.category}</td>
                    <td className="whitespace-nowrap px-4 py-4">{court.location}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-medium">{formatPeso(court.pricePerHour)} / hr</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${court.available ? "border-green-200 bg-green-50 text-green-800" : "border-gray-200 bg-gray-100 text-gray-700"}`}>
                        {court.available ? "Available" : "Unavailable"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <Link href={`/courts/${court.id}`} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">View</Link>
                        <button type="button" disabled onClick={() => openEditForm(court)} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-foreground hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">Edit</button>
                        <button type="button" disabled onClick={() => deleteCourt(court)} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <h2 className="text-lg font-bold text-foreground">No courts found</h2>
            <p className="mt-2 text-sm text-muted">Try another search or update your filters.</p>
            <Button type="button" variant="secondary" onClick={resetFilters} className="mt-4">Reset Filters</Button>
          </div>
        )}
      </section>
    </div>
  );
}
