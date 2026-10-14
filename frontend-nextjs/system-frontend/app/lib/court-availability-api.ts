import { getManilaDateString } from "./booking-utils";

export type CourtAvailabilityReason =
    | "court_unavailable"
    | "operating_days_unconfigured"
    | "closed_day"
    | "operating_hours_unconfigured"
    | "operating_hours_invalid"
    | "invalid_date"
    | "booking_schedule_invalid"
    | "no_complete_slots"
    | string;

export interface CourtAvailabilitySlot {
    start_time: string;
    end_time: string;
    available: boolean;
    reason?: string;
}

export interface CourtAvailability {
    court_id: number;
    date: string;
    court_status: string;
    opening_time: string | null;
    closing_time: string | null;
    slot_duration_minutes: number;
    reason: CourtAvailabilityReason | null;
    slots: CourtAvailabilitySlot[];
}

const API_BASE_URL = (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000/api"
).replace(/\/+$/, "");

export class CourtAvailabilityApiError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = "CourtAvailabilityApiError";
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidClockTime(value: unknown): value is string {
    if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value)) return false;
    return true;
}

function clockTimeToSeconds(value: string): number {
    const [hours, minutes, seconds] = value.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
}

function isOptionalClockTime(value: unknown): value is string | null {
    return value === null || isValidClockTime(value);
}

function parseAvailability(value: unknown, date: string, expectedCourtId?: number): CourtAvailability {
    if (!isRecord(value) || value.status !== 200 || !isRecord(value.data)) {
        throw new CourtAvailabilityApiError(500, "Unable to load court availability. Please try again.");
    }

    const data = value.data;
    if (
        !Number.isSafeInteger(data.court_id) || Number(data.court_id) <= 0 ||
        (expectedCourtId !== undefined && data.court_id !== expectedCourtId) || data.date !== date ||
        typeof data.court_status !== "string" ||
        !isOptionalClockTime(data.opening_time) || !isOptionalClockTime(data.closing_time) ||
        !Number.isSafeInteger(data.slot_duration_minutes) || Number(data.slot_duration_minutes) !== 60 ||
        !(data.reason === null || typeof data.reason === "string") ||
        !Array.isArray(data.slots)
    ) {
        throw new CourtAvailabilityApiError(500, "Unable to load court availability. Please try again.");
    }

    const slots: CourtAvailabilitySlot[] = data.slots.map((slot: unknown) => {
        if (
            !isRecord(slot) || !isValidClockTime(slot.start_time) || !isValidClockTime(slot.end_time) ||
            typeof slot.available !== "boolean" ||
            (slot.reason !== undefined && typeof slot.reason !== "string")
        ) {
            throw new CourtAvailabilityApiError(500, "Unable to load court availability. Please try again.");
        }

        const segmentDuration = clockTimeToSeconds(slot.end_time) - clockTimeToSeconds(slot.start_time);
        if (segmentDuration <= 0 || segmentDuration > 60 * 60) {
            throw new CourtAvailabilityApiError(500, "Unable to load court availability. Please try again.");
        }

        return {
            start_time: slot.start_time,
            end_time: slot.end_time,
            available: slot.available,
            ...(typeof slot.reason === "string" ? { reason: slot.reason } : {}),
        };
    });

    if (slots.length > 0) {
        if (typeof data.opening_time !== "string" || typeof data.closing_time !== "string") {
            throw new CourtAvailabilityApiError(500, "Unable to load court availability. Please try again.");
        }

        let expectedStart = data.opening_time;
        for (const [index, slot] of slots.entries()) {
            if (slot.start_time !== expectedStart) {
                throw new CourtAvailabilityApiError(500, "Unable to load court availability. Please try again.");
            }
            const duration = clockTimeToSeconds(slot.end_time) - clockTimeToSeconds(slot.start_time);
            if (index < slots.length - 1 && duration !== 60 * 60) {
                throw new CourtAvailabilityApiError(500, "Unable to load court availability. Please try again.");
            }
            expectedStart = slot.end_time;
        }

        if (expectedStart !== data.closing_time) {
            throw new CourtAvailabilityApiError(500, "Unable to load court availability. Please try again.");
        }
    }

    return {
        court_id: Number(data.court_id),
        date,
        court_status: data.court_status,
        opening_time: data.opening_time,
        closing_time: data.closing_time,
        slot_duration_minutes: Number(data.slot_duration_minutes),
        reason: data.reason,
        slots,
    };
}

function getAvailabilityFailure(status: number): string {
    if (status === 404) return "This court could not be found.";
    if (status === 422) return "Choose a valid booking date from today onward.";
    return "Unable to load court availability. Please try again.";
}

function getRescheduleAvailabilityFailure(status: number, responseBody: unknown): string {
    if (status === 401) return "Your session could not be verified. Please log in again.";
    if (status === 403) return "You are not allowed to view availability for this booking.";
    if (status === 404) return "Booking not found.";
    if (status === 409) {
        const message = isRecord(responseBody) ? responseBody.message : undefined;
        if (message === "A booking that has already started cannot be rescheduled.") return message;
        if (message === "This booking cannot be rescheduled.") return message;
        return "This booking cannot be rescheduled right now.";
    }
    if (status === 419) return "Your session expired. Please refresh the page and try again.";
    if (status === 422) return "Choose a valid booking date from today onward.";
    return "Unable to load court availability. Please try again.";
}

/** Fetch the public availability snapshot for one court and local calendar date. */
export async function getCourtAvailability(
    courtIdValue: number | string,
    date: string,
    signal?: AbortSignal,
): Promise<CourtAvailability> {
    const courtId = typeof courtIdValue === "number" ? courtIdValue : Number(courtIdValue);
    if (!Number.isSafeInteger(courtId) || courtId <= 0) {
        throw new CourtAvailabilityApiError(422, "A valid court is required to check availability.");
    }
    if (!isValidDate(date) || date < getManilaDateString()) {
        throw new CourtAvailabilityApiError(422, "Choose a valid booking date from today onward.");
    }

    try {
        const query = new URLSearchParams({ date });
        const response = await fetch(`${API_BASE_URL}/courts/${courtId}/availability?${query.toString()}`, {
            method: "GET",
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal,
        });

        if (!response.ok) {
            throw new CourtAvailabilityApiError(response.status, getAvailabilityFailure(response.status));
        }

        let body: unknown;
        try {
            body = await response.json();
        } catch {
            throw new CourtAvailabilityApiError(500, "Unable to load court availability. Please try again.");
        }

        return parseAvailability(body, date, courtId);
    } catch (error) {
        if (error instanceof CourtAvailabilityApiError) throw error;
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw new CourtAvailabilityApiError(0, "Unable to load court availability. Please try again.");
    }
}

/** Fetch availability for rescheduling; the session-authenticated backend excludes this owned booking. */
export async function getBookingRescheduleAvailability(
    bookingId: number,
    date: string,
    signal?: AbortSignal,
): Promise<CourtAvailability> {
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
        throw new CourtAvailabilityApiError(422, "A valid booking is required to check availability.");
    }
    if (!isValidDate(date) || date < getManilaDateString()) {
        throw new CourtAvailabilityApiError(422, "Choose a valid booking date from today onward.");
    }

    try {
        const query = new URLSearchParams({ date });
        const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/availability?${query.toString()}`, {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: { Accept: "application/json" },
            signal,
        });

        let body: unknown = null;
        try {
            body = await response.json();
        } catch {
            if (response.ok) {
                throw new CourtAvailabilityApiError(500, "Unable to load court availability. Please try again.");
            }
        }

        if (!response.ok) {
            throw new CourtAvailabilityApiError(
                response.status,
                getRescheduleAvailabilityFailure(response.status, body),
            );
        }

        return parseAvailability(body, date);
    } catch (error) {
        if (error instanceof CourtAvailabilityApiError) throw error;
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw new CourtAvailabilityApiError(0, "Unable to load court availability. Please try again.");
    }
}

export function findAvailableSlot(
    availability: CourtAvailability | null,
    date: string,
    startTime: string,
    endTime: string,
): CourtAvailabilitySlot | null {
    if (!availability || availability.date !== date) return null;
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime)) return null;

    const startSeconds = clockTimeToSeconds(`${startTime}:00`);
    const endSeconds = clockTimeToSeconds(`${endTime}:00`);
    if (endSeconds <= startSeconds) return null;

    let index = availability.slots.findIndex((slot) => slot.start_time.slice(0, 5) === startTime);
    if (index < 0 || !availability.slots[index].available) return null;

    const first = availability.slots[index];
    let expectedStart = first.start_time;
    while (index < availability.slots.length) {
        const segment = availability.slots[index];
        if (!segment.available || segment.start_time !== expectedStart) return null;
        expectedStart = segment.end_time;
        if (expectedStart.slice(0, 5) === endTime) {
            if (clockTimeToSeconds(expectedStart) !== endSeconds) return null;
            return { start_time: first.start_time, end_time: expectedStart, available: true };
        }
        if (clockTimeToSeconds(expectedStart) >= endSeconds) return null;
        index += 1;
    }

    return null;
}

export function getAvailableStartTimes(availability: CourtAvailability | null): string[] {
    if (!availability) return [];
    return availability.slots
        .filter((slot) => slot.available)
        .map((slot) => slot.start_time.slice(0, 5));
}

export function getAvailableEndTimes(
    availability: CourtAvailability | null,
    date: string,
    startTime: string,
): string[] {
    if (!availability || availability.date !== date) return [];
    const startIndex = availability.slots.findIndex((slot) => slot.start_time.slice(0, 5) === startTime);
    if (startIndex < 0) return [];

    const ends: string[] = [];
    let expectedStart = availability.slots[startIndex].start_time;
    for (let index = startIndex; index < availability.slots.length; index += 1) {
        const segment = availability.slots[index];
        if (!segment.available || segment.start_time !== expectedStart) break;
        expectedStart = segment.end_time;
        ends.push(expectedStart.slice(0, 5));
    }
    return ends;
}

export function getNoSlotsMessage(availability: CourtAvailability): string {
    if (availability.slots.length > 0 && availability.slots.every((slot) => !slot.available)) {
        return "No available time slots for this date. Please choose another date.";
    }

    switch (availability.reason) {
        case "court_unavailable": return "This court is currently unavailable for booking.";
        case "operating_days_unconfigured": return "This court is not accepting bookings right now.";
        case "closed_day": return "This court is closed on the selected day. Please choose another date.";
        case "operating_hours_unconfigured": return "This court's operating hours are not configured for booking.";
        case "operating_hours_invalid": return "This court's operating hours are invalid. Please try another date later.";
        case "invalid_date": return "Choose a valid booking date from today onward.";
        case "booking_schedule_invalid": return "Availability cannot be confirmed right now. Please try again.";
        case "no_complete_slots": return "There are no available time ranges for this date. Please choose another date.";
        default: return "No time slots are available for this date. Please choose another date.";
    }
}
