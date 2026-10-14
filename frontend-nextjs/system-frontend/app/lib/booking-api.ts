const API_BASE_URL = (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000/api"
).replace(/\/+$/, "");

const BACKEND_ORIGIN = new URL(API_BASE_URL).origin;

export interface CreateBookingPayload {
    court_id: number;
    booking_date: string;
    start_time: string;
    end_time: string;
}

export type BookingStatus = "pending" | "confirmed" | "cancelled";

/** Fields used from the eagerly loaded Laravel Court relationship. */
export interface BookingCourt {
    id: number;
    name: string;
    type: string;
    description?: string | null;
    hourly_rate?: string | number | null;
    location?: string | null;
    amenities?: string[] | null;
    opening_time?: string | null;
    closing_time?: string | null;
    operating_days?: string[] | null;
}

export interface RescheduleBookingPayload {
    booking_date: string;
    start_time: string;
    end_time: string;
}

export interface Booking {
    id: number;
    user_id: number;
    court_id: number;
    booking_date: string;
    start_time: string;
    end_time: string;
    status: BookingStatus;
    total_amount: string;
    // Laravel's timestamps are nullable at the database schema level.
    created_at: string | null;
    updated_at: string | null;
    /** createBooking does not eager-load this relationship; GET /bookings does. */
    court?: BookingCourt | null;
}

export interface CreateBookingResponse {
    /** The JSON body's status field; the actual HTTP response is 201. */
    status: 200;
    message: string;
    data: Booking;
}

export interface CancelBookingResponse {
    status: 200;
    message: string;
    data: Booking;
}

export interface RescheduleBookingResponse {
    status: 200;
    message: string;
    data: Booking;
}

export type BookingValidationErrors = Record<string, string[]>;

export class BookingApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly errors: BookingValidationErrors = {},
    ) {
        super(message);
        this.name = "BookingApiError";
    }
}

/** Convert a selected local time to Laravel's H:i:s format without timezone conversion. */
export function normalizeBookingTime(value: string): string {
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);

    if (!match) {
        throw new RangeError("Booking times must use HH:mm or HH:mm:ss format.");
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = match[3] === undefined ? 0 : Number(match[3]);

    if (hours > 23 || minutes > 59 || seconds > 59) {
        throw new RangeError("Booking time is outside the valid clock range.");
    }

    return `${match[1]}:${match[2]}:${String(seconds).padStart(2, "0")}`;
}

function getXsrfToken(): string {
    const cookie = document.cookie
        .split("; ")
        .find((item) => item.startsWith("XSRF-TOKEN="));

    if (!cookie) {
        throw new BookingApiError(
            419,
            "Your session expired. Please refresh and try again.",
        );
    }

    try {
        return decodeURIComponent(cookie.substring("XSRF-TOKEN=".length));
    } catch {
        throw new BookingApiError(
            419,
            "Your session expired. Please refresh and try again.",
        );
    }
}

async function initializeCsrf(): Promise<void> {
    const response = await fetch(`${BACKEND_ORIGIN}/sanctum/csrf-cookie`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
    });

    if (!response.ok) {
        throw new BookingApiError(
            response.status,
            response.status === 419
                ? "Your session expired. Please refresh and try again."
                : "Unable to initialize a secure session. Please try again.",
        );
    }
}

function getValidationErrors(value: unknown): BookingValidationErrors {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value).flatMap(([field, messages]) => {
            if (!Array.isArray(messages)) return [];
            const safeMessages = messages.filter(
                (message): message is string => typeof message === "string",
            );
            return safeMessages.length > 0 ? [[field, safeMessages]] : [];
        }),
    );
}

function getFailureMessage(status: number, serverMessage: unknown): string {
    switch (status) {
        case 401:
            return "Please log in to book a court.";
        case 419:
            return "Your session expired. Please refresh and try again.";
        case 404:
            return "The requested resource could not be found.";
        case 409: {
            const safeConflictMessages = new Set([
                "This court is currently unavailable for booking.",
                "This court is closed on the selected day.",
                "The selected booking time is outside court operating hours.",
                "The court is already booked for this time.",
            ]);
            return typeof serverMessage === "string" && safeConflictMessages.has(serverMessage)
                ? serverMessage
                : "This booking conflicts with the court's availability. Please choose another time.";
        }
        case 422:
            return typeof serverMessage === "string"
                ? serverMessage
                : "Please check the booking details and try again.";
        case 500:
            return "Unable to process your booking. Please try again.";
        default:
            return "Unable to process your booking. Please try again.";
    }
}

async function readJson(response: Response): Promise<unknown> {
    return response.json().catch(() => null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidBookingsResponse(): BookingApiError {
    return new BookingApiError(500, "Unable to load your bookings. Please try again.");
}

function parseBookingCourt(value: unknown): BookingCourt | null {
    if (value === null || value === undefined) return null;
    if (!isRecord(value) || typeof value.id !== "number" || typeof value.name !== "string" || typeof value.type !== "string") {
        throw invalidBookingsResponse();
    }

    return {
        id: value.id,
        name: value.name,
        type: value.type,
        description: typeof value.description === "string" || value.description === null
            ? value.description
            : null,
        hourly_rate: typeof value.hourly_rate === "string" || typeof value.hourly_rate === "number"
            ? value.hourly_rate
            : null,
        location: typeof value.location === "string" || value.location === null
            ? value.location
            : null,
        amenities: Array.isArray(value.amenities) && value.amenities.every((item) => typeof item === "string")
            ? value.amenities
            : null,
        opening_time: typeof value.opening_time === "string" || value.opening_time === null
            ? value.opening_time
            : null,
        closing_time: typeof value.closing_time === "string" || value.closing_time === null
            ? value.closing_time
            : null,
        operating_days: Array.isArray(value.operating_days) && value.operating_days.every((item) => typeof item === "string")
            ? value.operating_days
            : null,
    };
}

function parseBooking(value: unknown): Booking {
    if (!isRecord(value)) throw invalidBookingsResponse();

    const validStatus = value.status === "pending" || value.status === "confirmed" || value.status === "cancelled";
    const validDate = typeof value.booking_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.booking_date);
    const validTime = (time: unknown) => typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time);
    const validTimestamp = (timestamp: unknown) => timestamp === null || typeof timestamp === "string";

    if (
        typeof value.id !== "number" ||
        typeof value.user_id !== "number" ||
        typeof value.court_id !== "number" ||
        !validDate ||
        !validTime(value.start_time) ||
        !validTime(value.end_time) ||
        !validStatus ||
        typeof value.total_amount !== "string" ||
        !/^\d+(?:\.\d{1,2})?$/.test(value.total_amount) ||
        !validTimestamp(value.created_at) ||
        !validTimestamp(value.updated_at)
    ) {
        throw invalidBookingsResponse();
    }

    return {
        id: value.id,
        user_id: value.user_id,
        court_id: value.court_id,
        booking_date: value.booking_date as string,
        start_time: value.start_time as string,
        end_time: value.end_time as string,
        status: value.status as BookingStatus,
        total_amount: value.total_amount,
        created_at: value.created_at,
        updated_at: value.updated_at,
        court: parseBookingCourt(value.court),
    };
}

/** Fetch the authenticated user's bookings without modifying booking or session state. */
export async function getMyBookings(): Promise<Booking[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/bookings`, {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
            cache: "no-store",
        });
        const body = await readJson(response);

        if (!response.ok) {
            const message = response.status === 401
                ? "Please log in to view your bookings."
                : response.status === 419
                    ? "Your session expired. Please refresh and try again."
                    : "Unable to load your bookings. Please try again.";
            throw new BookingApiError(response.status, message);
        }

        if (!isRecord(body) || body.status !== 200 || !Array.isArray(body.data)) {
            throw invalidBookingsResponse();
        }

        return body.data.map(parseBooking);
    } catch (error) {
        if (error instanceof BookingApiError) throw error;
        throw new BookingApiError(0, "Unable to connect to the server. Please try again.");
    }
}

function getCancellationFailureMessage(status: number, serverMessage: unknown): string {
    if (status === 401) return "Your session could not be verified. Please log in again.";
    if (status === 419) return "Your session expired. Please refresh the page and try again.";
    if (status === 404) return "This booking could not be found. Refresh your bookings.";
    if (status === 409) {
        const safeMessages = new Set([
            "This booking has already been cancelled.",
            "This booking cannot be cancelled.",
            "A booking that has already started cannot be cancelled.",
        ]);
        return typeof serverMessage === "string" && safeMessages.has(serverMessage)
            ? serverMessage
            : "This booking can no longer be cancelled. Refresh your bookings.";
    }
    if (status === 422) return "Please check the booking and try again.";
    return "Unable to cancel this booking right now. Please try again.";
}

/** Cancel an owned booking through Laravel; the backend remains authoritative. */
export async function cancelBooking(bookingId: number): Promise<CancelBookingResponse> {
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
        throw new BookingApiError(422, "A valid booking ID is required.");
    }

    try {
        await initializeCsrf();
        const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
            method: "DELETE",
            credentials: "include",
            headers: {
                Accept: "application/json",
                "X-XSRF-TOKEN": getXsrfToken(),
            },
        });
        const body = await readJson(response);

        if (!response.ok) {
            const serverMessage = isRecord(body) ? body.message : undefined;
            throw new BookingApiError(
                response.status,
                getCancellationFailureMessage(response.status, serverMessage),
            );
        }

        if (
            !isRecord(body) ||
            body.status !== 200 ||
            body.message !== "Booking cancelled successfully" ||
            !isRecord(body.data)
        ) {
            throw new BookingApiError(500, "Unable to confirm the cancellation. Refresh your bookings.");
        }

        const booking = parseBooking(body.data);
        if (booking.status !== "cancelled") {
            throw new BookingApiError(500, "Unable to confirm the cancellation. Refresh your bookings.");
        }

        return {
            status: 200,
            message: body.message,
            data: booking,
        };
    } catch (error) {
        if (error instanceof BookingApiError) throw error;
        throw new BookingApiError(0, "Unable to cancel this booking right now. Please try again.");
    }
}

function getRescheduleFailureMessage(status: number): string {
    if (status === 401) return "Your session could not be verified. Please log in again.";
    if (status === 419) return "Your session expired. Please refresh the page and try again.";
    if (status === 404) return "This booking could not be found. Refresh your bookings.";
    if (status === 409) return "This booking conflicts with the court's schedule or availability. Choose another time.";
    if (status === 422) return "Please check the selected date and time.";
    return "Unable to reschedule this booking right now. Please try again.";
}

/** Reschedule an owned booking through Laravel; only the selected schedule is submitted. */
export async function rescheduleBooking(
    bookingId: number,
    payload: RescheduleBookingPayload,
): Promise<RescheduleBookingResponse> {
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
        throw new BookingApiError(422, "A valid booking ID is required.");
    }

    let startTime: string;
    let endTime: string;
    try {
        startTime = normalizeBookingTime(payload.start_time);
        endTime = normalizeBookingTime(payload.end_time);
    } catch {
        throw new BookingApiError(422, "Please check the selected date and time.");
    }

    try {
        await initializeCsrf();
        const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/reschedule`, {
            method: "PATCH",
            credentials: "include",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-XSRF-TOKEN": getXsrfToken(),
            },
            body: JSON.stringify({
                booking_date: payload.booking_date,
                start_time: startTime,
                end_time: endTime,
            }),
        });
        const body = await readJson(response);

        if (!response.ok) {
            const errors = isRecord(body) ? getValidationErrors(body.errors) : {};
            throw new BookingApiError(response.status, getRescheduleFailureMessage(response.status), errors);
        }

        if (!isRecord(body) || body.status !== 200 || body.message !== "Booking rescheduled successfully") {
            throw new BookingApiError(500, "Unable to confirm the reschedule. Refresh your bookings.");
        }

        const data = parseBooking(body.data);
        if (data.id !== bookingId || data.booking_date !== payload.booking_date ||
            data.start_time !== startTime || data.end_time !== endTime) {
            throw new BookingApiError(500, "Unable to confirm the reschedule. Refresh your bookings.");
        }

        return { status: 200, message: body.message, data };
    } catch (error) {
        if (error instanceof BookingApiError) throw error;
        throw new BookingApiError(0, "Unable to connect to the server. Please try again.");
    }
}

export async function createBooking(
    payload: CreateBookingPayload,
): Promise<CreateBookingResponse> {
    // Validate/normalize before network activity; keep date and local clock values unchanged.
    const startTime = normalizeBookingTime(payload.start_time);
    const endTime = normalizeBookingTime(payload.end_time);

    try {
        await initializeCsrf();

        const response = await fetch(`${API_BASE_URL}/bookings`, {
            method: "POST",
            credentials: "include",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-XSRF-TOKEN": getXsrfToken(),
            },
            body: JSON.stringify({
                court_id: payload.court_id,
                booking_date: payload.booking_date,
                start_time: startTime,
                end_time: endTime,
            }),
        });

        const data = await readJson(response);

        if (!response.ok) {
            const body = data && typeof data === "object"
                ? data as { message?: unknown; errors?: unknown }
                : {};
            throw new BookingApiError(
                response.status,
                getFailureMessage(response.status, body.message),
                response.status === 422 ? getValidationErrors(body.errors) : {},
            );
        }

        return data as CreateBookingResponse;
    } catch (error) {
        if (error instanceof BookingApiError) {
            throw error;
        }

        throw new BookingApiError(
            0,
            "Unable to connect to the server. Please try again.",
        );
    }
}
