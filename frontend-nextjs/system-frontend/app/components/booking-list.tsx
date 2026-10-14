"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import type { Booking, RescheduleBookingPayload } from "../lib/booking-api";
import { BookingApiError, cancelBooking, getMyBookings, rescheduleBooking } from "../lib/booking-api";
import { buildLoginUrl } from "../lib/booking-selection";
import { hasBookingEnded, isBookingCancellable, isBookingReschedulable, mergeCancelledBooking, mergeRescheduledBooking } from "../lib/booking-display";
import BookingCard from "./booking-card";
import Button from "./button";

type StatusFilter = "all" | Booking["status"];
type DateFilter = "all" | "upcoming" | "past";
type LoadError = { status: number; message: string };

function getClockSnapshot() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString();
}

function subscribeToLocalMinute(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;

  function scheduleNextMinute() {
    const now = new Date();
    const nextMinute = new Date(now);
    nextMinute.setSeconds(0, 0);
    nextMinute.setMinutes(nextMinute.getMinutes() + 1);
    timer = setTimeout(() => {
      onChange();
      scheduleNextMinute();
    }, nextMinute.getTime() - now.getTime() + 10);
  }

  scheduleNextMinute();
  return () => clearTimeout(timer);
}

function parseClockSnapshot(snapshot: string): Date | null {
  if (!snapshot) return null;
  const date = new Date(snapshot);
  return Number.isNaN(date.getTime()) ? null : date;
}

const statusFilters: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All Bookings" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "cancelled", label: "Cancelled" },
];

const dateFilters: { id: DateFilter; label: string }[] = [
  { id: "all", label: "All dates" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
];

function MetricIcon({ kind }: { kind: "all" | "upcoming" | "completed" }) {
  const shapes = {
    all: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4m8-4v4M4 9h16M8 13h3m-3 3h7" /></>,
    upcoming: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2M17 4l2 2" /></>,
    completed: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5">
      {shapes[kind]}
    </svg>
  );
}

function LoadingBookings() {
  return (
    <div aria-label="Loading bookings" role="status" className="space-y-5">
      <span className="sr-only">Loading your bookings...</span>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white" />)}
      </div>
      {[1, 2].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl bg-white" />)}
    </div>
  );
}

export default function BookingList() {
  const router = useRouter();
  const { user, status, clearAuthenticatedUser, refreshUser } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [bookingResult, setBookingResult] = useState<{ userId: number; items: Booking[] } | null>(null);
  const [pendingMutationKeys, setPendingMutationKeys] = useState<Set<string>>(() => new Set());
  const [pendingRescheduleKeys, setPendingRescheduleKeys] = useState<Set<string>>(() => new Set());
  const requestGenerationRef = useRef(0);
  const sessionRetryPendingRef = useRef(false);
  const pendingMutationRef = useRef(new Set<string>());
  const mountedRef = useRef(false);
  const authScopeRef = useRef({ userId: user?.id ?? null, status });
  authScopeRef.current = { userId: user?.id ?? null, status };
  const clockSnapshot = useSyncExternalStore(subscribeToLocalMinute, getClockSnapshot, () => "");
  const now = parseClockSnapshot(clockSnapshot);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const generation = ++requestGenerationRef.current;
    let active = true;

    if (status === "unauthenticated") {
      setBookingResult(null);
      setLoadError(null);
      router.replace(buildLoginUrl("/bookings"));
      return () => {
        active = false;
        requestGenerationRef.current += 1;
      };
    }

    if (status !== "authenticated" || !user) {
      setBookingResult(null);
      setLoadError(null);
      return () => {
        active = false;
        requestGenerationRef.current += 1;
      };
    }

    setBookingResult(null);
    setLoadError(null);

    void getMyBookings().then((items) => {
      if (!active || generation !== requestGenerationRef.current) return;
      setBookingResult({ userId: user.id, items });
    }).catch((error: unknown) => {
      if (!active || generation !== requestGenerationRef.current) return;

      if (error instanceof BookingApiError && error.status === 401) {
        clearAuthenticatedUser();
        return;
      }

      const apiError = error instanceof BookingApiError
        ? error
        : new BookingApiError(0, "Unable to load your bookings. Please try again.");
      setLoadError({ status: apiError.status, message: apiError.message });
      toast.error(apiError.message, { id: "my-bookings-load-error" });
    });

    return () => {
      active = false;
      requestGenerationRef.current += 1;
    };
  }, [clearAuthenticatedUser, retryCount, router, status, user?.id]);

  async function retrySessionCheck() {
    if (sessionRetryPendingRef.current || status !== "error") return;
    sessionRetryPendingRef.current = true;
    setIsRetrying(true);
    try {
      await refreshUser();
    } finally {
      sessionRetryPendingRef.current = false;
      setIsRetrying(false);
    }
  }

  const retryBookings = () => {
    setLoadError(null);
    setRetryCount((previous) => previous + 1);
  };

  async function handleCancellation(booking: Booking): Promise<BookingApiError | null> {
    const requestedUserId = user?.id;
    if (status !== "authenticated" || requestedUserId === undefined) return null;

    const key = `${requestedUserId}:${booking.id}`;
    if (pendingMutationRef.current.has(key)) {
      return new BookingApiError(409, "This cancellation is already being submitted.");
    }
    pendingMutationRef.current.add(key);
    setPendingMutationKeys((previous) => new Set(previous).add(key));

    try {
      const response = await cancelBooking(booking.id);
      const currentScope = authScopeRef.current;
      if (!mountedRef.current || currentScope.status !== "authenticated" || currentScope.userId !== requestedUserId) {
        return null;
      }

      setBookingResult((previous) => {
        if (!previous || previous.userId !== requestedUserId) return previous;
        return {
          ...previous,
          items: mergeCancelledBooking(previous.items, response.data),
        };
      });
      toast.success(response.message, { id: `booking-cancelled-${booking.id}` });
      return null;
    } catch (error) {
      const currentScope = authScopeRef.current;
      if (!mountedRef.current || currentScope.status !== "authenticated" || currentScope.userId !== requestedUserId) {
        return null;
      }

      const apiError = error instanceof BookingApiError
        ? error
        : new BookingApiError(0, "Unable to cancel this booking right now. Please try again.");
      if (apiError.status === 401) {
        clearAuthenticatedUser();
        return null;
      }

      toast.error(apiError.message, { id: `booking-cancel-error-${booking.id}` });
      return apiError;
    } finally {
      pendingMutationRef.current.delete(key);
      if (mountedRef.current) {
        setPendingMutationKeys((previous) => {
          const next = new Set(previous);
          next.delete(key);
          return next;
        });
      }
    }
  }

  async function handleReschedule(booking: Booking, payload: RescheduleBookingPayload): Promise<BookingApiError | null> {
    const requestedUserId = user?.id;
    if (status !== "authenticated" || requestedUserId === undefined) {
      return new BookingApiError(401, "Your session could not be verified. Please log in again.");
    }
    const key = `${requestedUserId}:${booking.id}`;
    if (pendingMutationRef.current.has(key)) return new BookingApiError(409, "This booking is already being updated.");
    pendingMutationRef.current.add(key);
    setPendingMutationKeys((previous) => new Set(previous).add(key));
    setPendingRescheduleKeys((previous) => new Set(previous).add(key));
    try {
      const response = await rescheduleBooking(booking.id, payload);
      const currentScope = authScopeRef.current;
      if (!mountedRef.current || currentScope.status !== "authenticated" || currentScope.userId !== requestedUserId) return null;
      setBookingResult((previous) => {
        if (!previous || previous.userId !== requestedUserId) return previous;
        return { ...previous, items: mergeRescheduledBooking(previous.items, response.data) };
      });
      toast.success(response.message, { id: `booking-rescheduled-${booking.id}` });
      return null;
    } catch (error) {
      const currentScope = authScopeRef.current;
      if (!mountedRef.current || currentScope.status !== "authenticated" || currentScope.userId !== requestedUserId) return null;
      const apiError = error instanceof BookingApiError
        ? error
        : new BookingApiError(0, "Unable to reschedule this booking right now. Please try again.");
      if (apiError.status === 401) {
        clearAuthenticatedUser();
        router.replace(buildLoginUrl("/bookings"));
        return apiError;
      }
      if (apiError.status === 404) retryBookings();
      toast.error(apiError.message, { id: `booking-reschedule-error-${booking.id}` });
      return apiError;
    } finally {
      pendingMutationRef.current.delete(key);
      if (mountedRef.current) {
        setPendingRescheduleKeys((previous) => {
          const next = new Set(previous);
          next.delete(key);
          return next;
        });
        setPendingMutationKeys((previous) => {
          const next = new Set(previous);
          next.delete(key);
          return next;
        });
      }
    }
  }

  if (status === "loading" || status === "unauthenticated" || status === "authenticated" && !user) {
    return <LoadingBookings />;
  }

  if (status === "error") {
    return (
      <section role="alert" className="rounded-3xl border border-amber-200 bg-white px-5 py-12 text-center shadow-sm sm:py-16">
        <h2 className="text-xl font-bold text-foreground">Unable to verify your session</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">Your booking history is hidden until we can confirm your session.</p>
        <Button type="button" onClick={retrySessionCheck} disabled={isRetrying} className="mt-5 rounded-xl">
          {isRetrying ? "Checking session..." : "Retry session check"}
        </Button>
      </section>
    );
  }

  if (loadError) {
    const sessionExpired = loadError.status === 419;
    return (
      <section role="alert" className="rounded-3xl border border-amber-200 bg-white px-5 py-12 text-center shadow-sm sm:py-16">
        <h2 className="text-xl font-bold text-foreground">{sessionExpired ? "Your session expired" : "We couldn’t load your bookings"}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">{loadError.message}</p>
        <Button type="button" onClick={retryBookings} className="mt-5 rounded-xl">Retry</Button>
      </section>
    );
  }

  const bookings = user && bookingResult?.userId === user.id ? bookingResult.items : null;
  if (!bookings) return <LoadingBookings />;

  function getDateCategory(booking: Booking): "upcoming" | "past" | "cancelled" {
    if (booking.status === "cancelled") return "cancelled";
    if (!now || !hasBookingEnded(booking, now)) return "upcoming";
    return "past";
  }

  const statusCounts: Record<StatusFilter, number> = {
    all: bookings.length,
    pending: bookings.filter((booking) => booking.status === "pending").length,
    confirmed: bookings.filter((booking) => booking.status === "confirmed").length,
    cancelled: bookings.filter((booking) => booking.status === "cancelled").length,
  };
  const upcomingCount = bookings.filter((booking) => getDateCategory(booking) === "upcoming").length;
  const completedCount = bookings.filter((booking) =>
    booking.status === "confirmed" && now !== null && hasBookingEnded(booking, now),
  ).length;
  const dateCounts: Record<DateFilter, number> = {
    all: bookings.length,
    upcoming: upcomingCount,
    past: completedCount,
  };
  const visibleBookings = bookings.filter((booking) =>
    (statusFilter === "all" || booking.status === statusFilter) &&
    (dateFilter === "all" || getDateCategory(booking) === dateFilter),
  );
  const filtersAreActive = statusFilter !== "all" || dateFilter !== "all";

  function resetFilters() {
    setStatusFilter("all");
    setDateFilter("all");
  }

  const metrics = [
    { label: "Total Bookings", value: bookings.length, icon: "all" as const },
    { label: "Upcoming Bookings", value: upcomingCount, icon: "upcoming" as const },
    { label: "Completed Bookings", value: completedCount, icon: "completed" as const },
  ];

  return (
    <div className="space-y-7 sm:space-y-8">
      <section aria-label="Booking summary" className="grid gap-4 sm:grid-cols-3 sm:gap-5">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-muted">{metric.label}</p>
              <span className="grid size-10 place-items-center rounded-xl bg-[#eff8dc] text-primary"><MetricIcon kind={metric.icon} /></span>
            </div>
            <p className="mt-4 text-3xl font-extrabold tracking-tight text-primary" aria-label={`${metric.value} ${metric.label.toLowerCase()}`}>{metric.value}</p>
          </article>
        ))}
      </section>

      <section aria-label="Booking filters" className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Filter by status</h2>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter bookings by status">
            {statusFilters.map((filter) => {
              const active = statusFilter === filter.id;
              return (
                <button key={filter.id} type="button" aria-pressed={active} onClick={() => setStatusFilter(filter.id)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? "border-primary bg-primary text-white" : "border-border bg-[#f8faf7] text-foreground hover:border-primary/35 hover:bg-primary/5"}`}>
                  {filter.label}<span className={`grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-xs ${active ? "bg-white/15 text-white" : "bg-white text-muted"}`}>{statusCounts[filter.id]}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <h2 className="text-sm font-semibold text-foreground">Filter by date</h2>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter bookings by date">
            {dateFilters.map((filter) => {
              const active = dateFilter === filter.id;
              return (
                <button key={filter.id} type="button" aria-pressed={active} onClick={() => setDateFilter(filter.id)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? "border-primary/20 bg-[#eff8dc] text-primary" : "border-border bg-white text-muted hover:border-primary/35 hover:text-primary"}`}>
                  {filter.label}<span className="text-xs tabular-nums">{dateCounts[filter.id]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="booking-results-title">
        <div className="mb-4 flex flex-col gap-1 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="booking-results-title" className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Your Bookings</h2>
            <p aria-live="polite" className="mt-1 text-sm text-muted">Showing {visibleBookings.length} {visibleBookings.length === 1 ? "booking" : "bookings"}</p>
          </div>
          {filtersAreActive && <button type="button" onClick={resetFilters} className="min-h-10 w-fit rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Reset filters</button>}
        </div>

        {visibleBookings.length > 0 ? (
          <div className="space-y-4 sm:space-y-5">
            {visibleBookings.map((booking) => {
              const cancellationKey = `${user?.id}:${booking.id}`;
              return (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  now={now}
                  canCancel={isBookingCancellable(booking, now)}
                  isCancelling={pendingMutationKeys.has(cancellationKey) && !pendingRescheduleKeys.has(cancellationKey)}
                  canReschedule={isBookingReschedulable(booking, now)}
                  isRescheduling={pendingRescheduleKeys.has(cancellationKey)}
                  onCancel={handleCancellation}
                  onReschedule={handleReschedule}
                  onRefreshBookings={retryBookings}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-primary/25 bg-white px-5 py-14 text-center sm:py-16">
            <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eff8dc] text-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-6"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17M9 14h6" /></svg>
            </span>
            <h3 className="mt-4 text-xl font-bold text-foreground">{filtersAreActive ? "No bookings found" : "You don’t have any bookings yet."}</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
              {filtersAreActive ? "No bookings match your selected filters." : "Your court reservations will appear here."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {filtersAreActive && <Button type="button" variant="secondary" onClick={resetFilters} className="rounded-xl">Reset Filters</Button>}
              <Button href="/courts" className="rounded-xl">Explore Courts</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
