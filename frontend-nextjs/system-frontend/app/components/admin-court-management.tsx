"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import type { Court } from "../data/courts";
import { formatPeso } from "../lib/booking-utils";
import Button from "./button";
import CourtEditorForm from "./court-editor-form";
import { mapApiCourt } from "../lib/court-mapper";
import { useAuth } from "@/contexts/auth-context";
import {
  AdminCourtsApiError,
  createAdminCourt,
  getAdminCourts,
  updateAdminCourt,
} from "../lib/admin-courts-api";
import { AuthApiError } from "../lib/auth-api";
import type { CreateAdminCourtPayload, UpdateAdminCourtPayload } from "../types/court";
import type { CourtEditorFieldErrors } from "./court-editor-form";

type CourtTypeFilter = "All" | "Indoor" | "Outdoor";
type AvailabilityFilter = "All" | "Available" | "Unavailable";
type CourtChanges = Omit<Court, "id">;
type CreationOutcome = "idle" | "saved" | "unknown";

const apiToEditorField: Record<string, keyof CourtEditorFieldErrors> = {
  name: "name",
  description: "description",
  type: "category",
  hourly_rate: "pricePerHour",
  status: "available",
  location: "location",
  amenities: "amenities",
  opening_time: "openingTime",
  closing_time: "closingTime",
};

function mapValidationErrors(errors: AdminCourtsApiError["errors"]) {
  const fieldErrors: CourtEditorFieldErrors = {};
  const messages: string[] = [];

  for (const [apiField, fieldMessages] of Object.entries(errors)) {
    const editorField = apiToEditorField[apiField] ?? (
      apiField.startsWith("amenities.") ? "amenities" : undefined
    );
    const validMessages = fieldMessages.filter((message) => message.trim().length > 0);
    if (editorField && validMessages[0]) fieldErrors[editorField] = validMessages[0];
    messages.push(...validMessages.map((message) => `${apiField}: ${message}`));
  }

  return { fieldErrors, message: messages.join(" ") };
}

function mapEditorChangesToPayload(changes: CourtChanges): CreateAdminCourtPayload {
  return {
    name: changes.name,
    type: changes.category,
    hourly_rate: changes.pricePerHour,
    status: changes.available ? "available" : "unavailable",
    description: changes.description,
    location: changes.location,
    amenities: changes.amenities,
    opening_time: changes.openingTime,
    closing_time: changes.closingTime,
  };
}

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
  const [isSavingCourt, setIsSavingCourt] = useState(false);
  const [isRefreshingCreatedCourts, setIsRefreshingCreatedCourts] = useState(false);
  const [creationOutcome, setCreationOutcome] = useState<CreationOutcome>("idle");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionFieldErrors, setSubmissionFieldErrors] = useState<CourtEditorFieldErrors>({});
  const [refreshCreatedCourtsError, setRefreshCreatedCourtsError] = useState<string | null>(null);
  const createInFlightRef = useRef(false);
  const updateInFlightRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const creationOutcomeRef = useRef<CreationOutcome>("idle");
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
    if (creationOutcomeRef.current !== "idle") return;
    setEditingCourt(null);
    setEditorKey((key) => key + 1);
    setEditorOpen(true);
    setSuccessMessage("");
    setSubmissionError(null);
    setSubmissionFieldErrors({});
  }

  function openEditForm(court: Court) {
    if (editorOpen || isSavingCourt || isRefreshingCreatedCourts) return;
    setEditingCourt(court);
    setEditorKey((key) => key + 1);
    setEditorOpen(true);
    setSuccessMessage("");
    setSubmissionError(null);
    setSubmissionFieldErrors({});
  }

  async function refreshCreatedCourtList() {
    if (refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    setIsRefreshingCreatedCourts(true);
    setRefreshCreatedCourtsError(null);

    try {
      const apiCourts = await getAdminCourts();
      setLocalCourts(apiCourts.map(mapApiCourt));
      resetFilters();

      const outcome = creationOutcomeRef.current;
      creationOutcomeRef.current = "idle";
      setCreationOutcome("idle");
      setRefreshCreatedCourtsError(null);
      setSubmissionError(null);
      setSubmissionFieldErrors({});

      if (outcome === "saved") {
        setEditorOpen(false);
        setEditingCourt(null);
        setSuccessMessage("Court created successfully.");
      } else {
        setSuccessMessage("Court list refreshed. Check whether the court was created before submitting again.");
      }
    } catch (err) {
      const courtWasSaved = creationOutcomeRef.current === "saved";
      if (err instanceof AdminCourtsApiError && err.status === 401) {
        setRefreshCreatedCourtsError(
          courtWasSaved
            ? "The court was saved, but your session expired before the list could refresh. Sign in again, then retry the list refresh."
            : "Your session expired before the court list could be verified. Checking authentication; retry the list refresh before submitting again.",
        );
        void refreshUser();
      } else if (err instanceof AdminCourtsApiError && err.status === 403) {
        setRefreshCreatedCourtsError(
          courtWasSaved
            ? "The court was saved, but you do not have permission to refresh the court list."
            : "You do not have permission to verify the court list. Contact an administrator before submitting again.",
        );
      } else {
        setRefreshCreatedCourtsError(
          courtWasSaved
            ? "The court was saved, but the list could not be refreshed. Retry the list refresh; do not submit the court again."
            : "The request outcome is unclear and the court list could not be refreshed. Retry the list refresh before deciding whether to submit again.",
        );
      }
    } finally {
      refreshInFlightRef.current = false;
      setIsRefreshingCreatedCourts(false);
    }
  }

  async function saveCourt(changes: CourtChanges) {
    if (editingCourt) {
      if (updateInFlightRef.current) return;

      updateInFlightRef.current = true;
      setIsSavingCourt(true);
      setSubmissionError(null);
      setSubmissionFieldErrors({});
      setSuccessMessage("");

      const payload: UpdateAdminCourtPayload = mapEditorChangesToPayload(changes);

      try {
        const response = await updateAdminCourt(editingCourt.id, payload);
        const updatedCourt = mapApiCourt(response.data);
        setLocalCourts((current) => current.map((court) =>
          court.id === editingCourt.id ? updatedCourt : court,
        ));
        setEditorOpen(false);
        setEditingCourt(null);
        setSuccessMessage("Court updated successfully.");
      } catch (err) {
        if (err instanceof AdminCourtsApiError) {
          if (err.status === 401) {
            setSubmissionError("Your session has expired. Checking authentication...");
            void refreshUser();
          } else if (err.status === 403) {
            setSubmissionError("You do not have permission to update courts.");
          } else if (err.status === 419) {
            setSubmissionError("Your session or CSRF token has expired. Refresh the page and sign in again.");
          } else if (err.status === 422) {
            const validation = mapValidationErrors(err.errors);
            setSubmissionFieldErrors(validation.fieldErrors);
            setSubmissionError(validation.message || err.message);
          } else {
            setSubmissionError(err.message);
          }
        } else if (err instanceof AuthApiError) {
          if (err.status === 401) {
            setSubmissionError("Your session has expired. Checking authentication...");
            void refreshUser();
          } else {
            setSubmissionError(
              err.status === 419
                ? "Your session or CSRF token has expired. Refresh the page and sign in again."
                : err.message,
            );
          }
        } else {
          setSubmissionError(
            err instanceof Error
              ? `Could not update the court: ${err.message}. Review the court list before trying again.`
              : "Could not confirm whether the court was updated. Review the court list before trying again.",
          );
        }
      } finally {
        updateInFlightRef.current = false;
        setIsSavingCourt(false);
      }
      return;
    }

    if (createInFlightRef.current || creationOutcomeRef.current !== "idle") return;

    createInFlightRef.current = true;
    setIsSavingCourt(true);
    setSubmissionError(null);
    setSubmissionFieldErrors({});
    setRefreshCreatedCourtsError(null);
    setSuccessMessage("");

    const payload: CreateAdminCourtPayload = mapEditorChangesToPayload(changes);

    try {
      await createAdminCourt(payload);
      creationOutcomeRef.current = "saved";
      setCreationOutcome("saved");
      await refreshCreatedCourtList();
    } catch (err) {
      if (err instanceof AdminCourtsApiError) {
        if (err.status === 401) {
          setSubmissionError("Your session has expired. Checking authentication...");
          void refreshUser();
        } else if (err.status === 403) {
          setSubmissionError("You do not have permission to create courts.");
        } else if (err.status === 419) {
          setSubmissionError("Your session or CSRF token has expired. Refresh the page and sign in again.");
        } else if (err.status === 422) {
          const validation = mapValidationErrors(err.errors);
          setSubmissionFieldErrors(validation.fieldErrors);
          setSubmissionError(validation.message || err.message);
        } else {
          setSubmissionError(err.message);
        }
      } else if (err instanceof AuthApiError) {
        if (err.status === 401) {
          setSubmissionError("Your session has expired. Checking authentication...");
          void refreshUser();
          return;
        }
        setSubmissionError(
          err.status === 419
            ? "Your session or CSRF token has expired. Refresh the page and sign in again."
            : err.message,
        );
      } else {
        creationOutcomeRef.current = "unknown";
        setCreationOutcome("unknown");
        setSubmissionError("We could not confirm whether the court was saved. Refresh the court list before deciding whether to submit again.");
      }
    } finally {
      createInFlightRef.current = false;
      setIsSavingCourt(false);
    }
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
          onClick={() => {
            setIsLoading(true);
            setError(null);
            setRetryCount((count) => count + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-900" role="note">
        New courts and edits are saved to the shared court listings. Delete is currently unavailable.
      </div>

      {successMessage && (
        <p role="status" aria-live="polite" className="rounded-xl border border-primary/20 bg-[#f1f7e9] px-4 py-3 text-sm font-medium text-primary">
          {successMessage}
        </p>
      )}

      {creationOutcome !== "idle" && (
        <div role="alert" aria-live="assertive" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {refreshCreatedCourtsError ?? (
              creationOutcome === "saved"
                ? "Court saved. Refreshing the court list..."
                : "The request outcome is unclear. Refresh the court list before deciding whether to submit again."
            )}
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={isRefreshingCreatedCourts}
            onClick={() => void refreshCreatedCourtList()}
            className="shrink-0"
          >
            {isRefreshingCreatedCourts ? "Refreshing..." : "Refresh court list"}
          </Button>
        </div>
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
        <Button
          type="button"
          disabled={editorOpen || isSavingCourt || isRefreshingCreatedCourts || creationOutcome !== "idle"}
          onClick={openAddForm}
          className="shrink-0"
        >
          Add Court
        </Button>
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
          isSubmitting={isSavingCourt || isRefreshingCreatedCourts}
          isSubmitLocked={creationOutcome !== "idle"}
          submitPendingLabel={isRefreshingCreatedCourts ? "Refreshing courts..." : "Saving court..."}
          submitLockedLabel={creationOutcome === "saved" ? "Court saved" : "Refresh before retrying"}
          submissionError={submissionError}
          serverFieldErrors={submissionFieldErrors}
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
                        <button type="button" disabled={editorOpen || isSavingCourt || isRefreshingCreatedCourts} onClick={() => openEditForm(court)} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-foreground hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">Edit</button>
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
