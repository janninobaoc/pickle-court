"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useAuth } from "@/contexts/auth-context";
import { BookingApiError, type Booking, type RescheduleBookingPayload } from "../lib/booking-api";
import {
  CourtAvailabilityApiError,
  findAvailableSlot,
  getAvailableEndTimes,
  getBookingRescheduleAvailability,
  getNoSlotsMessage,
  type CourtAvailability,
} from "../lib/court-availability-api";
import { buildLoginUrl } from "../lib/booking-selection";
import {
  bookingStatusLabel,
  formatBookingAmount,
  formatBookingListDate,
  formatBookingListTime,
  isBookingCancellable,
  validateRescheduleSelection,
} from "../lib/booking-display";
import { formatTime, getManilaDateString, parseLocalDate, timeToMinutes } from "../lib/booking-utils";
import CourtImage from "./court-image";

type BookingCardProps = {
  booking: Booking;
  now: Date | null;
  canCancel: boolean;
  isCancelling: boolean;
  canReschedule: boolean;
  isRescheduling: boolean;
  onCancel: (booking: Booking) => Promise<BookingApiError | null>;
  onReschedule: (booking: Booking, payload: RescheduleBookingPayload) => Promise<BookingApiError | null>;
  onRefreshBookings: () => void;
};

const statusStyles = {
  pending: "border-amber-200 bg-amber-50 text-amber-900",
  confirmed: "border-green-200 bg-green-50 text-green-900",
  cancelled: "border-red-200 bg-red-50 text-red-900",
} as const;

export default function BookingCard({
  booking,
  now,
  canCancel,
  isCancelling,
  canReschedule,
  isRescheduling,
  onCancel,
  onReschedule,
  onRefreshBookings,
}: BookingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [cancelError, setCancelError] = useState<BookingApiError | null>(null);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(booking.booking_date);
  const [rescheduleStart, setRescheduleStart] = useState(booking.start_time.slice(0, 5));
  const [rescheduleEnd, setRescheduleEnd] = useState(booking.end_time.slice(0, 5));
  const [rescheduleErrors, setRescheduleErrors] = useState<Record<string, string>>({});
  const [rescheduleError, setRescheduleError] = useState<BookingApiError | null>(null);
  const [availabilityState, setAvailabilityState] = useState<{
    date: string;
    status: "idle" | "loading" | "success" | "error";
    data?: CourtAvailability;
    error?: CourtAvailabilityApiError;
  }>({ date: "", status: "idle" });
  const { user, status, clearAuthenticatedUser } = useAuth();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const rescheduleDialogRef = useRef<HTMLDialogElement>(null);
  const keepButtonRef = useRef<HTMLButtonElement>(null);
  const keepRescheduleButtonRef = useRef<HTMLButtonElement>(null);
  const cancelPendingRef = useRef(false);
  const reschedulePendingRef = useRef(false);
  const availabilityRequestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const availabilityRequestIdRef = useRef(0);
  const authScopeRef = useRef({ userId: user?.id ?? null, status });
  const selectionRef = useRef({
    date: booking.booking_date,
    start: booking.start_time.slice(0, 5),
    end: booking.end_time.slice(0, 5),
  });
  const court = booking.court;
  const courtName = court?.name || `Court #${booking.court_id}`;
  const courtType = court?.type.trim() || "Court";
  const category = courtType.toLowerCase().includes("outdoor") ? "outdoor" : "indoor";
  const duration = (timeToMinutes(booking.end_time) - timeToMinutes(booking.start_time)) / 60;
  const detailsId = `booking-details-${booking.id}`;

  useEffect(() => {
    authScopeRef.current = { userId: user?.id ?? null, status };
  }, [status, user?.id]);

  function syncExpandedState(event: SyntheticEvent<HTMLDetailsElement>) {
    setExpanded(event.currentTarget.open);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isConfirmOpen && !dialog.open) {
      dialog.showModal();
      keepButtonRef.current?.focus();
    } else if (!isConfirmOpen && dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isConfirmOpen]);

  useEffect(() => {
    const dialog = rescheduleDialogRef.current;
    if (!dialog) return;
    if (isRescheduleOpen && !dialog.open) {
      setRescheduleDate(booking.booking_date);
      setRescheduleStart(booking.start_time.slice(0, 5));
      setRescheduleEnd(booking.end_time.slice(0, 5));
      selectionRef.current = {
        date: booking.booking_date,
        start: booking.start_time.slice(0, 5),
        end: booking.end_time.slice(0, 5),
      };
      setRescheduleErrors({});
      setRescheduleError(null);
      dialog.showModal();
      keepRescheduleButtonRef.current?.focus();
    } else if (!isRescheduleOpen && dialog.open) {
      dialog.close();
    }
    return () => { if (dialog.open) dialog.close(); };
  }, [booking.booking_date, booking.end_time, booking.start_time, isRescheduleOpen]);

  const refreshAvailability = useCallback(async (date: string) => {
    if (status !== "authenticated" || user?.id === undefined) return;
    availabilityRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const requestId = ++availabilityRequestIdRef.current;
    const requestedUserId = user.id;
    availabilityRequestRef.current = { id: requestId, controller };
    setAvailabilityState({ date, status: "loading" });

    try {
      const data = await getBookingRescheduleAvailability(booking.id, date, controller.signal);
      const currentScope = authScopeRef.current;
      if (
        controller.signal.aborted || availabilityRequestIdRef.current !== requestId ||
        currentScope.status !== "authenticated" || currentScope.userId !== requestedUserId
      ) return;

      setAvailabilityState({ date, status: "success", data });
      const selected = selectionRef.current;
      if (
        selected.date === date && selected.start &&
        !findAvailableSlot(data, date, selected.start, selected.end)
      ) {
        selectionRef.current = { date, start: "", end: "" };
        setRescheduleStart("");
        setRescheduleEnd("");
      }
    } catch (error) {
      if (controller.signal.aborted || availabilityRequestIdRef.current !== requestId) return;
      const currentScope = authScopeRef.current;
      if (currentScope.status !== "authenticated" || currentScope.userId !== requestedUserId) return;

      const safeError = error instanceof CourtAvailabilityApiError
        ? error
        : new CourtAvailabilityApiError(0, "Unable to load court availability. Please try again.");
      setAvailabilityState({ date, status: "error", error: safeError });
      if (safeError.status === 401) {
        clearAuthenticatedUser();
        router.replace(buildLoginUrl("/bookings"));
      }
    }
  }, [booking.id, clearAuthenticatedUser, router, status, user]);

  const todayInManila = now ? getManilaDateString(now) : "";
  const dateIsValid = Boolean(parseLocalDate(rescheduleDate)) && (!todayInManila || rescheduleDate >= todayInManila);

  useEffect(() => {
    if (!isRescheduleOpen || !canReschedule || !dateIsValid || status !== "authenticated") {
      availabilityRequestRef.current?.controller.abort();
      availabilityRequestIdRef.current += 1;
      return;
    }

    let active = true;
    void Promise.resolve().then(() => {
      if (active) return refreshAvailability(rescheduleDate);
      return undefined;
    });
    return () => {
      active = false;
      availabilityRequestRef.current?.controller.abort();
    };
  }, [canReschedule, dateIsValid, isRescheduleOpen, refreshAvailability, rescheduleDate, status]);

  const availability = availabilityState.date === rescheduleDate && availabilityState.status === "success"
    ? availabilityState.data ?? null
    : null;
  const availabilityLoading = isRescheduleOpen && dateIsValid && status === "authenticated" && (
    availabilityState.date !== rescheduleDate || availabilityState.status === "loading"
  );
  const selectedSlot = findAvailableSlot(availability, rescheduleDate, rescheduleStart, rescheduleEnd);
  const availableEndTimes = getAvailableEndTimes(availability, rescheduleDate, rescheduleStart);

  async function confirmCancellation() {
    if (cancelPendingRef.current || reschedulePendingRef.current || isCancelling || isRescheduling || !isBookingCancellable(booking, now)) return;
    cancelPendingRef.current = true;
    setCancelError(null);
    try {
      const error = await onCancel(booking);
      if (error) {
        setCancelError(error);
      } else {
        setIsConfirmOpen(false);
      }
    } finally {
      cancelPendingRef.current = false;
    }
  }

  async function confirmReschedule(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reschedulePendingRef.current || isRescheduling || isCancelling || !canReschedule) return;
    const payload = {
      booking_date: rescheduleDate,
      start_time: selectedSlot?.start_time.slice(0, 5) ?? rescheduleStart,
      end_time: selectedSlot?.end_time.slice(0, 5) ?? rescheduleEnd,
    };
    const localErrors = validateRescheduleSelection(booking, payload, now);
    if (!availability || availabilityLoading || !selectedSlot) {
      localErrors.start_time = "Choose an available time slot.";
    }
    setRescheduleErrors(localErrors);
    setRescheduleError(null);
    if (Object.keys(localErrors).length > 0) return;
    reschedulePendingRef.current = true;
    try {
      const error = await onReschedule(booking, payload);
      if (error) {
        setRescheduleError(error);
        const mapped: Record<string, string> = {};
        for (const field of ["booking_date", "start_time", "end_time"]) {
          const message = error.errors[field]?.[0];
          if (message) mapped[field] = message;
        }
        setRescheduleErrors(mapped);
        if (error.status === 409) void refreshAvailability(rescheduleDate);
      } else {
        setIsRescheduleOpen(false);
      }
    } finally {
      reschedulePendingRef.current = false;
    }
  }

  const estimatedAmount = (() => {
    if (!selectedSlot) return null;
    const rate = Number(court?.hourly_rate);
    const start = timeToMinutes(rescheduleStart);
    const end = timeToMinutes(rescheduleEnd);
    if (!Number.isFinite(rate) || rate < 0 || !rescheduleStart || !rescheduleEnd || end <= start) return null;
    return (rate * (end - start) / 60).toFixed(2);
  })();

  function handleRescheduleDateChange(value: string) {
    setRescheduleDate(value);
    setRescheduleStart("");
    setRescheduleEnd("");
    selectionRef.current = { date: value, start: "", end: "" };
    setRescheduleErrors({});
    setRescheduleError(null);
  }

  function handleRescheduleStartSelect(start: string) {
    selectionRef.current = { date: rescheduleDate, start, end: "" };
    setRescheduleStart(start);
    setRescheduleEnd("");
    setRescheduleErrors((previous) => ({ ...previous, start_time: "", end_time: "" }));
    setRescheduleError(null);
  }

  function handleRescheduleEndSelect(end: string) {
    selectionRef.current = { date: rescheduleDate, start: rescheduleStart, end };
    setRescheduleEnd(end);
    setRescheduleErrors((previous) => ({ ...previous, start_time: "", end_time: "" }));
    setRescheduleError(null);
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition duration-300 hover:border-primary/20 hover:shadow-soft motion-reduce:transition-none sm:rounded-3xl">
      <div className="grid sm:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <CourtImage
          alt={`${courtType} pickleball court at ${courtName}`}
          variant={category}
          className="aspect-[1.9] w-full sm:aspect-auto sm:min-h-full"
        />
        <div className="min-w-0 p-4 sm:p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">
                {court ? `${courtType} court` : "Court booking"}
              </p>
              <h2 className="mt-1 break-words text-lg font-bold tracking-tight text-foreground sm:text-xl">{courtName}</h2>
              <p className="mt-1 text-xs text-muted">Booking ID: #{booking.id}</p>
            </div>
            <span className={`inline-flex min-h-8 shrink-0 items-center rounded-full border px-3 py-1 text-xs font-bold ${statusStyles[booking.status]}`}>
              {bookingStatusLabel(booking.status)}
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-xs text-muted">Date</dt>
              <dd className="mt-1 break-words font-medium leading-5 text-foreground">{formatBookingListDate(booking.booking_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Time</dt>
              <dd className="mt-1 font-medium leading-5 text-foreground">
                {formatBookingListTime(booking.start_time)} – {formatBookingListTime(booking.end_time)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Duration</dt>
              <dd className="mt-1 font-medium leading-5 text-foreground">{duration} {duration === 1 ? "hour" : "hours"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Total</dt>
              <dd className="mt-1 font-bold leading-5 text-primary">{formatBookingAmount(booking.total_amount)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Link
              href={`/courts/${booking.court_id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-[#103B34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
            >
              View Court
            </Link>
            {canCancel && (
              <button
                type="button"
                onClick={() => { setCancelError(null); setIsConfirmOpen(true); }}
                disabled={isCancelling || isRescheduling}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-800 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel Booking
              </button>
            )}
            {canReschedule && (
              <button
                type="button"
                onClick={() => { setRescheduleError(null); setRescheduleErrors({}); setIsRescheduleOpen(true); }}
                disabled={isCancelling || isRescheduling}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/25 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reschedule
              </button>
            )}
            <details className="group/details min-w-0" onToggle={syncExpandedState}>
              <summary
                aria-expanded={expanded}
                aria-controls={detailsId}
                className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden motion-reduce:transition-none"
              >
                {expanded ? "Hide details" : "View details"}
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`size-4 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}>
                  <path d="m7 10 5 5 5-5" />
                </svg>
              </summary>
              <div id={detailsId} className="mt-3 w-full rounded-2xl border border-border bg-[#f8faf7] p-4 sm:p-5">
                <h3 className="text-sm font-bold text-foreground">Booking details</h3>
                <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted">Booking ID</dt>
                    <dd className="mt-1 font-medium text-foreground">#{booking.id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Court</dt>
                    <dd className="mt-1 font-medium text-foreground">{courtName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Booking date</dt>
                    <dd className="mt-1 font-medium text-foreground">{formatBookingListDate(booking.booking_date)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Time</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {formatBookingListTime(booking.start_time)} – {formatBookingListTime(booking.end_time)}
                    </dd>
                  </div>
                  {court?.hourly_rate !== null && court?.hourly_rate !== undefined && (
                    <div>
                      <dt className="text-xs text-muted">Hourly rate</dt>
                      <dd className="mt-1 font-medium text-foreground">{formatBookingAmount(String(court.hourly_rate))} / hour</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-muted">Total amount</dt>
                    <dd className="mt-1 font-semibold text-primary">{formatBookingAmount(booking.total_amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Status</dt>
                    <dd className="mt-1 font-medium text-foreground">{bookingStatusLabel(booking.status)}</dd>
                  </div>
                  {court?.location && (
                    <div>
                      <dt className="text-xs text-muted">Location</dt>
                      <dd className="mt-1 font-medium text-foreground">{court.location}</dd>
                    </div>
                  )}
                </dl>
                {court?.description && (
                  <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted">{court.description}</p>
                )}
                {court?.amenities && court.amenities.length > 0 && (
                  <ul aria-label="Court amenities" className="mt-3 flex flex-wrap gap-2">
                    {court.amenities.map((amenity) => (
                      <li key={amenity} className="rounded-full border border-border bg-white px-2.5 py-1 text-xs text-foreground">{amenity}</li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby={`cancel-booking-title-${booking.id}`}
        aria-describedby={`cancel-booking-description-${booking.id}`}
        onClose={() => setIsConfirmOpen(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-white p-0 text-foreground shadow-2xl backdrop:bg-[#1F2937]/50"
      >
        <div className="p-5 sm:p-6">
          <h2 id={`cancel-booking-title-${booking.id}`} className="text-xl font-bold text-foreground">Cancel Booking?</h2>
          <p id={`cancel-booking-description-${booking.id}`} className="mt-2 text-sm leading-6 text-muted">
            Are you sure you want to cancel this court reservation? This action cannot be undone.
          </p>
          {cancelError && (
            <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-900">
              <p>{cancelError.message}</p>
              {(cancelError.status === 404 || cancelError.status === 409) && (
                <button
                  type="button"
                  onClick={onRefreshBookings}
                  className="mt-2 rounded font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                >
                  Refresh bookings
                </button>
              )}
              {cancelError.status === 419 && <p className="mt-1 text-xs">You can retry the cancellation.</p>}
            </div>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              ref={keepButtonRef}
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isCancelling || isRescheduling}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-[#f8faf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
            >
              Keep Booking
            </button>
            <button
              type="button"
              onClick={confirmCancellation}
              disabled={isCancelling || isRescheduling || !isBookingCancellable(booking, now)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCancelling ? "Cancelling..." : cancelError?.status === 419 ? "Retry Cancellation" : "Yes, Cancel Booking"}
            </button>
          </div>
        </div>
      </dialog>
      <dialog
        ref={rescheduleDialogRef}
        aria-labelledby={`reschedule-booking-title-${booking.id}`}
        aria-describedby={`reschedule-booking-description-${booking.id}`}
        onClose={() => setIsRescheduleOpen(false)}
        className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-white p-0 text-foreground shadow-2xl backdrop:bg-[#1F2937]/50"
      >
        <form onSubmit={confirmReschedule} noValidate className="p-5 sm:p-6">
          <h2 id={`reschedule-booking-title-${booking.id}`} className="text-xl font-bold">Reschedule Booking</h2>
          <p id={`reschedule-booking-description-${booking.id}`} className="mt-2 text-sm leading-6 text-muted">
            Choose a new time for {courtName}. The court cannot be changed, and availability will be confirmed when you submit.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#f8faf7] p-4 text-sm">
            <div><dt className="text-xs text-muted">Current date</dt><dd className="mt-1 font-medium">{formatBookingListDate(booking.booking_date)}</dd></div>
            <div><dt className="text-xs text-muted">Current time</dt><dd className="mt-1 font-medium">{formatBookingListTime(booking.start_time)} – {formatBookingListTime(booking.end_time)}</dd></div>
            <div><dt className="text-xs text-muted">Current status</dt><dd className="mt-1 font-medium">{bookingStatusLabel(booking.status)}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted">Current total</dt><dd className="mt-1 font-semibold text-primary">{formatBookingAmount(booking.total_amount)}</dd></div>
          </dl>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-semibold" htmlFor={`reschedule-date-${booking.id}`}>New date
              <input id={`reschedule-date-${booking.id}`} type="date" min={todayInManila || undefined} value={rescheduleDate} onChange={(event) => handleRescheduleDateChange(event.target.value)} disabled={isRescheduling} aria-invalid={Boolean(rescheduleErrors.booking_date) || Boolean(rescheduleDate && !dateIsValid)} className="mt-1 min-h-11 w-full rounded-xl border border-border px-3 font-normal focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60" />
              {rescheduleErrors.booking_date && <span role="alert" className="mt-1 block text-xs font-normal text-red-700">{rescheduleErrors.booking_date}</span>}
              {rescheduleDate && !dateIsValid && <span role="alert" className="mt-1 block text-xs font-normal text-red-700">Choose a valid date today or later in Asia/Manila.</span>}
            </label>
            <fieldset aria-describedby={`reschedule-availability-help-${booking.id}`}>
              <legend className="text-sm font-semibold">Choose a new time range</legend>
              <p id={`reschedule-availability-help-${booking.id}`} className="mt-1 text-xs leading-5 text-muted">Choose any contiguous free interval within operating hours. Your current booking alone is excluded; availability is not guaranteed until Laravel confirms the change.</p>
              {availabilityLoading && <p role="status" className="mt-3 rounded-lg bg-[#f8faf7] p-3 text-sm text-muted">Loading live availability…</p>}
              {availabilityState.date === rescheduleDate && availabilityState.status === "error" && (
                <div role="alert" className="mt-3 flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <p>{availabilityState.error?.message ?? "Unable to load court availability. Please try again."}</p>
                  {availabilityState.error?.status === 404 ? (
                    <button type="button" onClick={onRefreshBookings} className="min-h-9 w-fit rounded px-2 font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-primary">Refresh bookings</button>
                  ) : (
                    <button type="button" onClick={() => void refreshAvailability(rescheduleDate)} className="min-h-9 w-fit rounded px-2 font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-primary">Retry availability</button>
                  )}
                </div>
              )}
              {!dateIsValid && <p className="mt-3 text-sm text-muted">Choose a valid date to load availability.</p>}
              {availability && availability.slots.length === 0 && <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{getNoSlotsMessage(availability)}</p>}
              {availability && availability.slots.length > 0 && availability.slots.every((slot) => !slot.available) && <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{getNoSlotsMessage(availability)}</p>}
              {availability && availability.slots.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={`Availability for ${courtName}`}>
                  {availability.slots.map((slot) => {
                    const selected = slot.available && rescheduleStart === slot.start_time.slice(0, 5);
                    const label = `Start at ${formatTime(slot.start_time)}, ${slot.available ? "available" : "unavailable"}`;
                    return (
                      <button key={`${slot.start_time}-${slot.end_time}`} type="button" disabled={!slot.available || availabilityLoading || isRescheduling} aria-label={label} aria-pressed={selected} onClick={() => handleRescheduleStartSelect(slot.start_time.slice(0, 5))} className={`min-h-12 rounded-lg border px-2 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55 sm:text-sm ${selected ? "border-primary bg-primary text-white" : slot.available ? "border-border bg-white text-foreground hover:border-primary/50" : "border-gray-200 bg-gray-100 text-gray-500 line-through"}`}>
                        <span className="block">Start {formatTime(slot.start_time)}</span>
                        <span className="mt-1 block text-[10px] uppercase tracking-wide">{slot.available ? "Available" : "Unavailable"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {rescheduleErrors.start_time && <p role="alert" className="mt-2 text-xs text-red-700">{rescheduleErrors.start_time}</p>}
              {rescheduleErrors.end_time && <p role="alert" className="mt-2 text-xs text-red-700">{rescheduleErrors.end_time}</p>}
              {rescheduleStart && availability && !selectedSlot && <p role="status" className="mt-2 text-xs text-amber-800">The selected slot is no longer available. Choose another slot.</p>}
            </fieldset>
              <label htmlFor={`reschedule-end-time-${booking.id}`} className="mt-4 block text-sm font-semibold">End time
                <select id={`reschedule-end-time-${booking.id}`} value={rescheduleEnd} disabled={!rescheduleStart || availabilityLoading || isRescheduling || availableEndTimes.length === 0} onChange={(event) => handleRescheduleEndSelect(event.target.value)} aria-describedby={`reschedule-end-help-${booking.id}`} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-white px-3 font-normal focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60">
                  <option value="">Select an end time</option>
                  {availableEndTimes.map((time) => <option key={time} value={time}>{formatTime(time)}</option>)}
                </select>
                <span id={`reschedule-end-help-${booking.id}`} className="mt-1 block text-xs font-normal text-muted">The closing time is selectable when the full interval remains available.</span>
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-[#f8faf7] p-3 text-sm">
                <p><span className="block text-xs text-muted">New start</span><span className="font-medium">{selectedSlot ? formatTime(selectedSlot.start_time) : "Not selected"}</span></p>
                <p><span className="block text-xs text-muted">New end</span><span className="font-medium">{selectedSlot ? formatTime(selectedSlot.end_time) : "Not selected"}</span></p>
              </div>
          </div>
          {estimatedAmount !== null && court?.hourly_rate !== null && court?.hourly_rate !== undefined && (
            <p className="mt-3 rounded-lg bg-[#eff8dc] p-3 text-sm text-primary">Estimated Total: <strong>{formatBookingAmount(estimatedAmount)}</strong>. Laravel calculates the final amount.</p>
          )}
          {rescheduleError && (
            <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <p>{rescheduleError.message}</p>
              {rescheduleError.status === 404 && <button type="button" onClick={onRefreshBookings} className="mt-2 font-semibold underline">Refresh bookings</button>}
              {rescheduleError.status === 419 && <p className="mt-1 text-xs">You can retry the reschedule.</p>}
            </div>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button ref={keepRescheduleButtonRef} type="button" onClick={() => setIsRescheduleOpen(false)} disabled={isRescheduling} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold hover:bg-[#f8faf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60">Keep Current Booking</button>
            <button type="submit" disabled={isRescheduling || isCancelling || !canReschedule || !availability || availabilityLoading || !selectedSlot || !dateIsValid || (rescheduleDate === booking.booking_date && rescheduleStart === booking.start_time.slice(0, 5) && rescheduleEnd === booking.end_time.slice(0, 5))} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-[#103B34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60">
              {isRescheduling ? "Rescheduling..." : rescheduleError?.status === 419 ? "Retry Reschedule" : "Confirm Reschedule"}
            </button>
          </div>
        </form>
      </dialog>
    </article>
  );
}
