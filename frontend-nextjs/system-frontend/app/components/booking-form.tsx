"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import type { Court } from "../data/courts";
import { formatPesoExact, formatTime, getLocalDateString, parseLocalDate } from "../lib/booking-utils";
import { BookingApiError, createBooking, type Booking, type BookingValidationErrors } from "../lib/booking-api";
import {
  CourtAvailabilityApiError,
  findAvailableSlot,
  getAvailableEndTimes,
  getAvailableStartTimes,
  getCourtAvailability,
  getNoSlotsMessage,
  type CourtAvailability,
} from "../lib/court-availability-api";
import {
  buildBookingReturnTo,
  buildLoginUrl,
  restoreBookingSelection,
  type BookingSelectionParams,
} from "../lib/booking-selection";
import BookingSummary from "./booking-summary";
import Button from "./button";

const controlStyles =
  "min-h-12 w-full rounded-xl border border-border bg-white px-4 text-sm text-foreground outline-none transition-colors hover:border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-muted";

function subscribeToLocalDay(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;

  function scheduleNextLocalDay() {
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setHours(24, 0, 0, 0);
    timer = setTimeout(() => {
      onChange();
      scheduleNextLocalDay();
    }, nextDay.getTime() - now.getTime() + 10);
  }

  scheduleNextLocalDay();
  return () => clearTimeout(timer);
}

function getServerLocalDay() {
  return "";
}

export default function BookingForm({
  court,
  selectionParams = {},
}: {
  court: Court;
  selectionParams?: BookingSelectionParams;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, refreshUser } = useAuth();
  const today = useSyncExternalStore(subscribeToLocalDay, getLocalDateString, getServerLocalDay);
  const initialSelection = useMemo(
    () => restoreBookingSelection(selectionParams, court),
    [court, selectionParams],
  );
  const [selectedDate, setSelectedDate] = useState(initialSelection.date);
  const [startTime, setStartTime] = useState(initialSelection.startTime);
  const [endTime, setEndTime] = useState(initialSelection.endTime);
  const bookingSelectionRef = useRef({
    date: initialSelection.date,
    startTime: initialSelection.startTime,
    endTime: initialSelection.endTime,
  });
  const [selectionNotice, setSelectionNotice] = useState(initialSelection.notice);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [bookingResult, setBookingResult] = useState<Booking | null>(null);
  const [apiErrors, setApiErrors] = useState<BookingValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryingSession, setIsRetryingSession] = useState(false);
  const [availabilityState, setAvailabilityState] = useState<{
    date: string;
    status: "idle" | "loading" | "success" | "error";
    data?: CourtAvailability;
    error?: CourtAvailabilityApiError;
  }>({ date: "", status: "idle" });
  const submissionPendingRef = useRef(false);
  const retryPendingRef = useRef(false);
  const manuallyEditedSelectionRef = useRef(false);
  const pastDateCheckCompleteRef = useRef(false);
  const availabilityRequestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const availabilityRequestIdRef = useRef(0);

  useEffect(() => {
    if (!today || pastDateCheckCompleteRef.current) return;
    pastDateCheckCompleteRef.current = true;

    if (!manuallyEditedSelectionRef.current && selectedDate && selectedDate < today) {
      bookingSelectionRef.current = { date: "", startTime: "", endTime: "" };
      setSelectedDate("");
      setStartTime("");
      setEndTime("");
      setSelectionNotice("Your previous booking date has passed. Please choose a new date and time.");
    }
  }, [selectedDate, today]);

  const selectedLocalDate = parseLocalDate(selectedDate);
  const courtId = Number(court.id);
  const dateIssue = (() => {
    if (!Number.isSafeInteger(courtId) || courtId <= 0) return "This court cannot be booked right now.";
    if (!selectedDate) return "Select a booking date.";
    if (!selectedLocalDate) return "Enter a valid booking date.";
    if (today && selectedDate < today) return "The booking date cannot be in the past.";
    return "";
  })();

  const loadAvailability = useCallback(async (date: string) => {
    availabilityRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const requestId = ++availabilityRequestIdRef.current;
    availabilityRequestRef.current = { id: requestId, controller };
    setAvailabilityState({ date, status: "loading" });

    try {
      const data = await getCourtAvailability(courtId, date, controller.signal);
      if (availabilityRequestIdRef.current !== requestId || controller.signal.aborted) return;
      const selection = bookingSelectionRef.current;
      if (selection.date === date && selection.startTime) {
        if (!getAvailableStartTimes(data).includes(selection.startTime)) {
          bookingSelectionRef.current = { date, startTime: "", endTime: "" };
          setStartTime("");
          setEndTime("");
          setSelectionNotice("Availability changed. Please choose a new start and end time.");
        } else if (
          selection.endTime &&
          !getAvailableEndTimes(data, date, selection.startTime).includes(selection.endTime)
        ) {
          bookingSelectionRef.current = { ...selection, endTime: "" };
          setEndTime("");
          setSelectionNotice("Availability changed. Please choose a new end time.");
        }
      }
      setAvailabilityState({ date, status: "success", data });
    } catch (error) {
      if (controller.signal.aborted || availabilityRequestIdRef.current !== requestId) return;
      const safeError = error instanceof CourtAvailabilityApiError
        ? error
        : new CourtAvailabilityApiError(0, "Unable to load court availability. Please try again.");
      setAvailabilityState({ date, status: "error", error: safeError });
    }
  }, [courtId]);

  useEffect(() => {
    if (!selectedDate || dateIssue) {
      availabilityRequestRef.current?.controller.abort();
      availabilityRequestIdRef.current += 1;
      return;
    }

    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadAvailability(selectedDate);
      return undefined;
    });
    return () => {
      active = false;
      availabilityRequestRef.current?.controller.abort();
    };
  }, [dateIssue, loadAvailability, selectedDate]);

  const availability = availabilityState.date === selectedDate && availabilityState.status === "success"
    ? availabilityState.data ?? null
    : null;
  const availabilityLoading = Boolean(selectedDate) && (
    !dateIssue && (availabilityState.date !== selectedDate || availabilityState.status === "loading")
  );
  const availableStartTimes = getAvailableStartTimes(availability);
  const availableEndTimes = getAvailableEndTimes(availability, selectedDate, startTime);
  const selectedSlot = findAvailableSlot(availability, selectedDate, startTime, endTime);
  const startIssue = !dateIssue && !startTime
    ? "Choose a start time."
    : availability && startTime && !availableStartTimes.includes(startTime)
      ? "That start time is no longer available. Choose another time."
      : "";
  const endIssue = !dateIssue && !startIssue && !endTime
    ? "Choose an end time."
    : availability && startTime && endTime && !availableEndTimes.includes(endTime)
      ? "The selected interval is no longer available. Choose another end time."
      : "";

  const unavailableSelectionNotice = availability && startTime && endTime && !selectedSlot
    ? "The selected interval is no longer available. Please choose another time range."
    : null;

  function clearBookingFeedback(fields: string[] = []) {
    setBookingResult(null);
    if (fields.length > 0) {
      setApiErrors((previous) => {
        const next = { ...previous };
        for (const field of fields) delete next[field];
        return next;
      });
    }
  }

  function handleDateChange(value: string) {
    manuallyEditedSelectionRef.current = true;
    bookingSelectionRef.current = { date: value, startTime: "", endTime: "" };
    setSelectionNotice(null);
    setSelectedDate(value);
    setStartTime("");
    setEndTime("");
    setAvailabilityState({ date: value, status: "idle" });
    clearBookingFeedback(["booking_date", "start_time", "end_time"]);
  }

  function handleStartTimeChange(value: string) {
    manuallyEditedSelectionRef.current = true;
    bookingSelectionRef.current = { date: selectedDate, startTime: value, endTime: "" };
    setSelectionNotice(null);
    setStartTime(value);
    setEndTime("");
    clearBookingFeedback(["start_time", "end_time"]);
  }

  function handleEndTimeChange(value: string) {
    manuallyEditedSelectionRef.current = true;
    bookingSelectionRef.current = { date: selectedDate, startTime, endTime: value };
    setSelectionNotice(null);
    setEndTime(value);
    clearBookingFeedback(["start_time", "end_time"]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionPendingRef.current) return;
    setAttemptedSubmit(true);
    if (dateIssue || startIssue || endIssue) return;
    if (!availability || availabilityLoading || !selectedSlot) return;
    if (status === "loading") return;

    const loginForBooking = () => {
      toast.info("Please log in to book a court.");
      const returnTo = buildBookingReturnTo(
        pathname || `/courts/${court.id}/book`,
        selectedDate,
        startTime,
        endTime,
      );
      router.push(buildLoginUrl(returnTo));
    };

    if (status === "unauthenticated") {
      loginForBooking();
      return;
    }

    if (status === "error") {
      toast.error("Unable to verify your session. Please retry before booking.");
      return;
    }

    submissionPendingRef.current = true;
    setIsSubmitting(true);
    setApiErrors({});

    try {
      const response = await createBooking({
        court_id: courtId,
        booking_date: selectedDate,
        start_time: startTime,
        end_time: endTime,
      });

      setBookingResult(response.data);
      if (response.data.status === "pending") {
        toast.success("Your booking has been submitted successfully!");
      } else {
        toast.warning(`Your booking was submitted with status: ${response.data.status}.`);
      }
    } catch (error) {
      if (error instanceof BookingApiError) {
        if (error.status === 401) {
          loginForBooking();
        } else if (error.status === 419) {
          toast.error("Your session expired. Please refresh and try again.");
        } else if (error.status === 422) {
          setApiErrors(error.errors);
          toast.error(Object.keys(error.errors).length > 0
            ? "Please review the highlighted booking details."
            : error.message);
        } else if (error.status === 409) {
          toast.warning(error.message);
          void loadAvailability(selectedDate);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("Unable to process your booking. Please try again.");
      }
    } finally {
      submissionPendingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function retrySessionCheck() {
    if (retryPendingRef.current || status !== "error") return;
    retryPendingRef.current = true;
    setIsRetryingSession(true);
    try {
      await refreshUser();
    } finally {
      retryPendingRef.current = false;
      setIsRetryingSession(false);
    }
  }
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.95fr)] lg:gap-8">
      <form noValidate onSubmit={handleSubmit} className="min-w-0 rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-7 lg:p-8">
        <div className="border-b border-border pb-5 sm:pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Plan your next game</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Choose your schedule</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Booking for <span className="font-semibold text-foreground">{court.name}</span> in {court.location}.
          </p>
        </div>

        {(selectionNotice || unavailableSelectionNotice) && (
          <p role="status" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            {unavailableSelectionNotice ?? selectionNotice}
          </p>
        )}

        <section aria-labelledby="booking-date-heading" className="mt-6 sm:mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">01 <span aria-hidden="true" className="mx-1 text-[#5C9142]">—</span> Select Your Date</p>
          <h3 id="booking-date-heading" className="sr-only">Select your booking date</h3>
          <div className="mt-4">
            <label htmlFor="booking-date" className="text-sm font-semibold text-foreground">
              Booking date <span aria-hidden="true" className="text-red-700">*</span>
            </label>
            <div className="relative mt-2">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted">
                <rect x="3.5" y="5" width="17" height="15" rx="2" />
                <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" />
              </svg>
              <input
                id="booking-date"
                type="date"
                value={selectedDate}
                min={today || undefined}
                required
                aria-required="true"
                aria-invalid={(attemptedSubmit && Boolean(dateIssue)) || Boolean(apiErrors.booking_date?.length)}
                aria-describedby={(attemptedSubmit && dateIssue) || apiErrors.booking_date?.length ? "booking-date-error" : "booking-date-help"}
                disabled={isSubmitting}
                onChange={(event) => handleDateChange(event.target.value)}
                className={`${controlStyles} pl-12`}
              />
            </div>
            <p id={(attemptedSubmit && dateIssue) || apiErrors.booking_date?.length ? "booking-date-error" : "booking-date-help"} className={`mt-2 text-xs leading-5 ${(attemptedSubmit && dateIssue) || apiErrors.booking_date?.length ? "text-red-700" : "text-muted"}`}>
              {attemptedSubmit && dateIssue ? dateIssue : (apiErrors.booking_date?.[0] ?? "Choose a date from today onward. Dates use your local calendar.")}
            </p>
          </div>
        </section>

        <fieldset className="mt-7 border-t border-border pt-6 sm:mt-8 sm:pt-7" aria-describedby="time-slot-help">
          <legend className="sr-only">Select your booking time</legend>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">02 <span aria-hidden="true" className="mx-1 text-[#5C9142]">—</span> Select Your Time</p>
          <p id="time-slot-help" className="mt-2 text-sm leading-6 text-muted">Choose a start time and any later end time within the court&apos;s available operating hours. Availability can change before you submit.</p>

          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground">Available time range <span aria-hidden="true" className="text-red-700">*</span></p>
            {availabilityLoading && <p role="status" className="mt-3 rounded-xl bg-[#f8faf7] p-4 text-sm text-muted">Loading live availability…</p>}
            {availabilityState.date === selectedDate && availabilityState.status === "error" && (
              <div role="alert" className="mt-3 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
                <p>{availabilityState.error?.message ?? "Unable to load court availability. Please try again."}</p>
                <button
                  type="button"
                  onClick={() => void loadAvailability(selectedDate)}
                  className="min-h-10 rounded-lg px-3 font-semibold text-primary hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >Retry availability</button>
              </div>
            )}
            {!selectedDate && <p className="mt-3 text-sm text-muted">Choose a date to load live availability.</p>}
            {availability && availability.slots.length === 0 && (
              <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{getNoSlotsMessage(availability)}</p>
            )}
            {availability && availability.slots.length > 0 && availability.slots.every((slot) => !slot.available) && (
              <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{getNoSlotsMessage(availability)}</p>
            )}
            {availability && availability.slots.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" role="group" aria-label="Court availability time slots">
                {availability.slots.map((slot) => {
                  const isSelected = slot.available && startTime === slot.start_time.slice(0, 5);
                  const label = `Start at ${formatTime(slot.start_time)}, ${slot.available ? "available" : "unavailable"}`;
                  return (
                    <button
                      key={`${slot.start_time}-${slot.end_time}`}
                      type="button"
                      disabled={!slot.available || availabilityLoading || isSubmitting}
                      aria-label={label}
                      aria-pressed={isSelected}
                      onClick={() => handleStartTimeChange(slot.start_time.slice(0, 5))}
                      className={`min-h-14 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55 sm:text-sm ${isSelected ? "border-primary bg-primary text-white shadow-sm" : slot.available ? "border-border bg-white text-foreground hover:border-primary/50 hover:bg-primary/5" : "border-gray-200 bg-gray-100 text-gray-500 line-through"}`}
                    >
                      <span className="block">{formatTime(slot.start_time)} <span aria-hidden="true">–</span> {formatTime(slot.end_time)}</span>
                      <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide">{slot.available ? "Available" : "Unavailable"}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {attemptedSubmit && startIssue && <p role="alert" className="mt-2 text-xs text-red-700">{startIssue}</p>}
            {!startIssue && apiErrors.start_time?.[0] && <p role="alert" className="mt-2 text-xs text-red-700">{apiErrors.start_time[0]}</p>}
            {selectedDate && dateIssue && <p className="mt-2 text-xs text-amber-800">{dateIssue}</p>}
          </div>

          <div className="mt-5">
            <label htmlFor="booking-end-time" className="text-sm font-semibold text-foreground">
              End time <span aria-hidden="true" className="text-red-700">*</span>
              <select id="booking-end-time" value={endTime} required disabled={!startTime || availabilityLoading || isSubmitting || availableEndTimes.length === 0} onChange={(event) => handleEndTimeChange(event.target.value)} aria-invalid={Boolean(attemptedSubmit && endIssue) || Boolean(apiErrors.end_time?.length)} aria-describedby="booking-end-help" className={`${controlStyles} mt-2`}>
                <option value="">Select an end time</option>
                {availableEndTimes.map((time) => <option key={time} value={time}>{formatTime(time)}</option>)}
              </select>
              <span id="booking-end-help" className={`mt-2 block text-xs leading-5 ${attemptedSubmit && endIssue ? "text-red-700" : "text-muted"}`}>
                {attemptedSubmit && endIssue ? endIssue : (apiErrors.end_time?.[0] ?? "Choose any free end boundary up to closing time.")}
              </span>
            </label>
          </div>
        </fieldset>

        {apiErrors.court_id?.[0] && <p role="alert" className="mt-4 text-sm text-red-700">{apiErrors.court_id[0]}</p>}

        {status === "error" && (
          <div role="alert" className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <p>Unable to verify your session. Retry before submitting a booking.</p>
            <button
              type="button"
              onClick={retrySessionCheck}
              disabled={isRetryingSession}
              className="min-h-10 rounded-lg px-3 font-semibold text-[#164A41] hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41] disabled:opacity-60"
            >
              {isRetryingSession ? "Checking..." : "Retry session check"}
            </button>
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || availabilityLoading || !availability || !selectedSlot || status === "loading" || status === "error"}
          className="mt-7 min-h-12 w-full rounded-xl text-base font-bold sm:mt-8"
        >
          {isSubmitting ? "Booking..." : status === "loading" ? "Checking session..." : "Submit Booking"}
        </Button>
        <p className="mt-3 text-center text-xs leading-5 text-muted">
          Availability is checked when you submit. The displayed total is an estimate; Laravel calculates the final amount. New bookings are submitted with pending status.
        </p>

        <div aria-live="polite" aria-atomic="true" className="mt-4">
          {bookingResult && (
            <div role="status" className="rounded-xl border border-primary/20 bg-[#f1f7e9] p-4 text-sm leading-6 text-primary">
              <p className="font-bold">Booking submitted</p>
              <p className="mt-1">Your booking is pending. The court has not confirmed it yet.</p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-primary/70">Booking ID</dt><dd className="font-semibold">{bookingResult.id}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-primary/70">Status</dt><dd className="font-semibold">{bookingResult.status}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-primary/70">Server total</dt><dd className="font-semibold">{formatPesoExact(Number(bookingResult.total_amount))}</dd></div>
              </dl>
            </div>
          )}
        </div>
      </form>

      <BookingSummary
        court={court}
        selectedDate={selectedDate}
        startTime={startTime}
        endTime={endTime}
        bookingResult={bookingResult}
      />
    </div>
  );
}
