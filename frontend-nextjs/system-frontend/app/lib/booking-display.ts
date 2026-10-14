import type { Booking, BookingStatus } from "./booking-api";
import { formatTime } from "./booking-utils";
import { parseLocalDate } from "./booking-utils";
import type { RescheduleBookingPayload } from "./booking-api";

/** Format the database DATE as a court-local calendar date, without UTC conversion. */
export function formatBookingListDate(value: string): string {
    const date = parseLocalDate(value);
    return date
        ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "Date unavailable";
}

/** Format Laravel TIME values as local wall-clock values, without parsing them as timestamps. */
export function formatBookingListTime(value: string): string {
    if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) {
        return "Time unavailable";
    }

    return formatTime(value.slice(0, 5));
}

/** Preserve the decimal amount from Laravel without floating-point arithmetic. */
export function formatBookingAmount(value: string): string {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match) return "Amount unavailable";

    const groupedWhole = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 })
        .format(BigInt(match[1]));
    const decimals = (match[2] ?? "").padEnd(2, "0");

    return `₱${groupedWhole}.${decimals}`;
}

export function bookingStatusLabel(status: BookingStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function getManilaClock(now: Date): { date: string; time: string } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(now);
    const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return {
        date: `${fields.year}-${fields.month}-${fields.day}`,
        time: `${fields.hour}:${fields.minute}:${fields.second}`,
    };
}

function scheduledTimeIsAfterNow(date: string, time: string, now: Date): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) {
        return false;
    }

    const scheduledTime = time.length === 5 ? `${time}:00` : time;
    const current = getManilaClock(now);
    return date > current.date || (date === current.date && scheduledTime > current.time);
}

/** Client-side visibility hint, using the same Asia/Manila wall clock as Laravel. */
export function isBookingCancellable(booking: Booking, now: Date | null): boolean {
    return now !== null &&
        (booking.status === "pending" || booking.status === "confirmed") &&
        scheduledTimeIsAfterNow(booking.booking_date, booking.start_time, now);
}

/** A booking can be rescheduled under the same status/start-time rules as cancellation. */
export const isBookingReschedulable = isBookingCancellable;

export type RescheduleFieldErrors = Partial<Record<keyof RescheduleBookingPayload, string>>;

/** Validate court-local schedule values without converting them through UTC. */
export function validateRescheduleSelection(
    booking: Booking,
    selection: RescheduleBookingPayload,
    now: Date | null,
): RescheduleFieldErrors {
    const errors: RescheduleFieldErrors = {};
    const date = parseLocalDate(selection.booking_date);
    const start = /^([01]\d|2[0-3]):[0-5]\d$/.test(selection.start_time);
    const end = /^([01]\d|2[0-3]):[0-5]\d$/.test(selection.end_time);

    if (!selection.booking_date) errors.booking_date = "Choose a booking date.";
    else if (!date) errors.booking_date = "Enter a valid booking date.";
    else if (now && selection.booking_date < getManilaClock(now).date) errors.booking_date = "The booking date cannot be in the past.";

    if (!selection.start_time) errors.start_time = "Choose a start time.";
    else if (!start) errors.start_time = "Enter a valid start time.";
    if (!selection.end_time) errors.end_time = "Choose an end time.";
    else if (!end) errors.end_time = "Enter a valid end time.";

    if (start && end) {
        const startMinutes = Number(selection.start_time.slice(0, 2)) * 60 + Number(selection.start_time.slice(3, 5));
        const endMinutes = Number(selection.end_time.slice(0, 2)) * 60 + Number(selection.end_time.slice(3, 5));
        if (endMinutes <= startMinutes) errors.end_time = "The end time must be later than the start time.";
        if (!errors.booking_date && date && now) {
            const current = getManilaClock(now);
            const currentMinutes = Number(current.time.slice(0, 2)) * 60 + Number(current.time.slice(3, 5));
            if (selection.booking_date === current.date && startMinutes <= currentMinutes) {
                errors.start_time = "The new booking must start in the future.";
            }
        }
    }

    const currentStart = booking.start_time.slice(0, 5);
    const currentEnd = booking.end_time.slice(0, 5);
    if (date && start && end && selection.booking_date === booking.booking_date &&
        selection.start_time === currentStart && selection.end_time === currentEnd) {
        errors.end_time = "Choose a schedule different from the current booking.";
    }

    const court = booking.court;
    if (date && !errors.booking_date && court?.operating_days) {
        const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" })
            .format(new Date(`${selection.booking_date}T12:00:00Z`));
        if (!court.operating_days.includes(weekday)) {
            errors.booking_date = "This court is not scheduled to operate on that day. Choose another date.";
        }
    }

    const parseMinutes = (value: string | null | undefined): number | null => {
        if (!value || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) return null;
        return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    };
    const opening = parseMinutes(court?.opening_time);
    const closing = parseMinutes(court?.closing_time);
    if (start && opening !== null && closing !== null && closing > opening) {
        const startMinutes = Number(selection.start_time.slice(0, 2)) * 60 + Number(selection.start_time.slice(3, 5));
        const endMinutes = end ? Number(selection.end_time.slice(0, 2)) * 60 + Number(selection.end_time.slice(3, 5)) : null;
        if (startMinutes < opening) errors.start_time = "Choose a start time within this court's operating hours.";
        if (endMinutes !== null && endMinutes > closing) errors.end_time = "Choose an end time within this court's operating hours.";
    }

    return errors;
}

export function hasBookingEnded(booking: Booking, now: Date): boolean {
    return !scheduledTimeIsAfterNow(booking.booking_date, booking.end_time, now);
}

/** Merge only a confirmed server cancellation, retaining the loaded court relationship. */
export function mergeCancelledBooking(bookings: Booking[], cancelled: Booking): Booking[] {
    return bookings.map((booking) => booking.id === cancelled.id
        ? { ...booking, ...cancelled, court: cancelled.court ?? booking.court }
        : booking);
}

/** Merge Laravel's rescheduled booking while retaining its previously loaded court. */
export function mergeRescheduledBooking(bookings: Booking[], updated: Booking): Booking[] {
    return bookings.map((booking) => booking.id === updated.id
        ? { ...booking, ...updated, court: updated.court ?? booking.court }
        : booking);
}
