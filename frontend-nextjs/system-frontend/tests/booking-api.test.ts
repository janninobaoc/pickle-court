import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    BookingApiError,
    cancelBooking,
    createBooking,
    getMyBookings,
    normalizeBookingTime,
    rescheduleBooking,
    type CreateBookingPayload,
} from "../app/lib/booking-api";

const payload: CreateBookingPayload = {
    court_id: 17,
    booking_date: "2026-10-15",
    start_time: "09:00",
    end_time: "10:30",
};

const booking = {
    id: 51,
    user_id: 8,
    court_id: 17,
    booking_date: "2026-10-15",
    start_time: "09:00:00",
    end_time: "10:30:00",
    status: "pending",
    total_amount: "525.00",
    created_at: "2026-10-01T10:00:00.000000Z",
    updated_at: "2026-10-01T10:00:00.000000Z",
    court: {
        id: 17,
        name: "Central Court",
        type: "indoor",
        description: "Indoor court",
        hourly_rate: "300.00",
        status: "available",
        location: "Makati",
        amenities: ["Lighting"],
        opening_time: "08:00:00",
        closing_time: "22:00:00",
        operating_days: ["Monday", "Tuesday"],
        image: null,
        created_at: "2026-09-01T00:00:00.000000Z",
        updated_at: "2026-09-01T00:00:00.000000Z",
    },
};

function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

describe("booking API helper", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("document", { cookie: "XSRF-TOKEN=csrf%20token" });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("initializes CSRF then posts the typed booking payload with session credentials", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({ status: 200, message: "Booking created successfully", data: booking }, 201));

        await expect(createBooking(payload)).resolves.toMatchObject({
            status: 200,
            data: { id: 51, status: "pending", total_amount: "525.00" },
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/sanctum/csrf-cookie");
        expect(fetchMock.mock.calls[0][1]).toMatchObject({
            method: "GET",
            credentials: "include",
        });
        expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:8000/api/bookings");
        expect(fetchMock.mock.calls[1][1]).toMatchObject({
            method: "POST",
            credentials: "include",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-XSRF-TOKEN": "csrf token",
            },
        });
        expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
            court_id: 17,
            booking_date: "2026-10-15",
            start_time: "09:00:00",
            end_time: "10:30:00",
        });
    });

    it("normalizes HH:mm and preserves already normalized HH:mm:ss values", () => {
        expect(normalizeBookingTime("09:00")).toBe("09:00:00");
        expect(normalizeBookingTime("10:30")).toBe("10:30:00");
        expect(normalizeBookingTime("10:30:45")).toBe("10:30:45");
        expect(() => normalizeBookingTime("24:00")).toThrow(RangeError);
        expect(() => normalizeBookingTime("9:00")).toThrow(RangeError);
    });

    it("accepts HTTP 201 even though the response body status is 200", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({ status: 200, message: "Created", data: booking }, 201));

        const result = await createBooking(payload);
        expect(result.status).toBe(200);
        expect(result.data.id).toBe(51);
    });

    it.each([
        [401, "Please log in to book a court."],
        [419, "Your session expired. Please refresh and try again."],
        [404, "The requested resource could not be found."],
        [500, "Unable to process your booking. Please try again."],
    ])("maps HTTP %i to a safe message", async (status, expectedMessage) => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({ message: "private backend detail" }, status));

        await expect(createBooking(payload)).rejects.toMatchObject({
            status,
            message: expectedMessage,
        });
    });

    it("preserves Laravel 422 field errors", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({
                message: "The given data was invalid.",
                errors: { booking_date: ["The booking date is invalid."] },
            }, 422));

        await expect(createBooking(payload)).rejects.toMatchObject({
            status: 422,
            errors: { booking_date: ["The booking date is invalid."] },
        });
    });

    it("preserves known safe HTTP 409 booking conflict messages", async () => {
        const message = "The court is already booked for this time.";
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({ message }, 409));

        await expect(createBooking(payload)).rejects.toMatchObject({ status: 409, message });
    });

    it("does not expose an unknown conflict message", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({ message: "SQL exception details" }, 409));

        await expect(createBooking(payload)).rejects.toMatchObject({
            status: 409,
            message: "This booking conflicts with the court's availability. Please choose another time.",
        });
    });

    it("maps network failures to a user-friendly typed error", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockRejectedValueOnce(new TypeError("Failed to fetch"));

        await expect(createBooking(payload)).rejects.toMatchObject({
            status: 0,
            message: "Unable to connect to the server. Please try again.",
        });
    });

    it("does not send ownership, status, or price fields", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({ status: 200, message: "Created", data: booking }, 201));

        await createBooking(payload);

        const sent = JSON.parse(fetchMock.mock.calls[1][1].body as string) as Record<string, unknown>;
        expect(Object.keys(sent).sort()).toEqual([
            "booking_date",
            "court_id",
            "end_time",
            "start_time",
        ]);
        expect(sent).not.toHaveProperty("user_id");
        expect(sent).not.toHaveProperty("status");
        expect(sent).not.toHaveProperty("total_amount");
    });

    it("exposes the HTTP status through BookingApiError consumers", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({ message: "Unauthenticated." }, 401));

        try {
            await createBooking(payload);
            expect.fail("Expected createBooking to reject.");
        } catch (error) {
            expect(error).toBeInstanceOf(BookingApiError);
            expect((error as BookingApiError).status).toBe(401);
        }
    });

    it("gets the authenticated user's bookings with cookies and parses the loaded court", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ status: 200, data: [booking] }, 200));

        await expect(getMyBookings()).resolves.toMatchObject([{
            id: 51,
            status: "pending",
            total_amount: "525.00",
            court: { id: 17, name: "Central Court", type: "indoor", hourly_rate: "300.00" },
        }]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/api/bookings");
        expect(fetchMock.mock.calls[0][1]).toMatchObject({
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
        });
    });

    it("returns an empty array for an empty Laravel collection without demo fallback", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ status: 200, data: [] }, 200));
        await expect(getMyBookings()).resolves.toEqual([]);
    });

    it("rejects malformed booking response structures safely", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ data: { bookings: [booking] } }, 200));
        await expect(getMyBookings()).rejects.toMatchObject({
            status: 500,
            message: "Unable to load your bookings. Please try again.",
        });
    });

    it.each([
        [401, "Please log in to view your bookings."],
        [419, "Your session expired. Please refresh and try again."],
        [500, "Unable to load your bookings. Please try again."],
    ])("maps GET /bookings HTTP %i safely", async (status, message) => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "internal server details" }, status));
        await expect(getMyBookings()).rejects.toMatchObject({ status, message });
    });

    it("maps GET /bookings network failures safely", async () => {
        fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
        await expect(getMyBookings()).rejects.toMatchObject({
            status: 0,
            message: "Unable to connect to the server. Please try again.",
        });
    });

    it("initializes CSRF and sends an authenticated DELETE cancellation", async () => {
        const cancelledBooking = { ...booking, status: "cancelled", court: undefined };
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({
                status: 200,
                message: "Booking cancelled successfully",
                data: cancelledBooking,
            }, 200));

        await expect(cancelBooking(51)).resolves.toMatchObject({
            status: 200,
            message: "Booking cancelled successfully",
            data: { id: 51, status: "cancelled" },
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/sanctum/csrf-cookie");
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", credentials: "include" });
        expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:8000/api/bookings/51");
        expect(fetchMock.mock.calls[1][1]).toMatchObject({
            method: "DELETE",
            credentials: "include",
            headers: { Accept: "application/json", "X-XSRF-TOKEN": "csrf token" },
        });
    });

    it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid cancellation ID %s before network requests", async (id) => {
        await expect(cancelBooking(id)).rejects.toMatchObject({ status: 422 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
        [401, "Your session could not be verified. Please log in again."],
        [419, "Your session expired. Please refresh the page and try again."],
        [404, "This booking could not be found. Refresh your bookings."],
        [409, "This booking has already been cancelled."],
        [422, "Please check the booking and try again."],
        [500, "Unable to cancel this booking right now. Please try again."],
    ])("maps cancellation HTTP %i to safe feedback", async (status, message) => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({
                message: status === 409 ? "This booking has already been cancelled." : "internal details",
            }, status));

        await expect(cancelBooking(51)).rejects.toMatchObject({ status, message });
    });

    it("maps cancellation network failures safely", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockRejectedValueOnce(new TypeError("Failed to fetch"));
        await expect(cancelBooking(51)).rejects.toMatchObject({
            status: 0,
            message: "Unable to cancel this booking right now. Please try again.",
        });
    });

    it("initializes CSRF and PATCHes only the selected schedule with normalized times", async () => {
        const updated = { ...booking, booking_date: "2026-10-20", start_time: "11:00:00", end_time: "12:30:00", total_amount: "450.00", court: undefined };
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({ status: 200, message: "Booking rescheduled successfully", data: updated }, 200));

        await expect(rescheduleBooking(51, { booking_date: "2026-10-20", start_time: "11:00", end_time: "12:30" }))
            .resolves.toMatchObject({ status: 200, data: { booking_date: "2026-10-20", total_amount: "450.00" } });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:8000/api/bookings/51/reschedule");
        expect(fetchMock.mock.calls[1][1]).toMatchObject({
            method: "PATCH",
            credentials: "include",
            headers: { Accept: "application/json", "Content-Type": "application/json", "X-XSRF-TOKEN": "csrf token" },
        });
        expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
            booking_date: "2026-10-20", start_time: "11:00:00", end_time: "12:30:00",
        });
    });

    it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid reschedule ID %s before network requests", async (id) => {
        await expect(rescheduleBooking(id, { booking_date: "2026-10-20", start_time: "09:00", end_time: "10:00" }))
            .rejects.toMatchObject({ status: 422 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects malformed reschedule times as a safe validation error before network requests", async () => {
        await expect(rescheduleBooking(51, { booking_date: "2026-10-20", start_time: "9:00", end_time: "10:00" }))
            .rejects.toMatchObject({ status: 422, message: "Please check the selected date and time." });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
        [401, "Your session could not be verified. Please log in again."],
        [419, "Your session expired. Please refresh the page and try again."],
        [404, "This booking could not be found. Refresh your bookings."],
        [409, "This booking conflicts with the court's schedule or availability. Choose another time."],
        [422, "Please check the selected date and time."],
        [500, "Unable to reschedule this booking right now. Please try again."],
    ])("maps reschedule HTTP %i to safe feedback", async (status, message) => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({ message: "private backend detail", errors: { start_time: ["Choose another time."] } }, status));
        await expect(rescheduleBooking(51, { booking_date: "2026-10-20", start_time: "09:00", end_time: "10:00" }))
            .rejects.toMatchObject({ status, message });
    });

    it("preserves Laravel reschedule field errors and maps network failures safely", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(jsonResponse({ message: "Invalid", errors: { booking_date: ["Pick another date."] } }, 422));
        await expect(rescheduleBooking(51, { booking_date: "2026-10-20", start_time: "09:00", end_time: "10:00" }))
            .rejects.toMatchObject({ errors: { booking_date: ["Pick another date."] } });

        fetchMock.mockReset().mockResolvedValueOnce(new Response(null, { status: 204 })).mockRejectedValueOnce(new TypeError("Failed to fetch"));
        await expect(rescheduleBooking(51, { booking_date: "2026-10-20", start_time: "09:00", end_time: "10:00" }))
            .rejects.toMatchObject({ status: 0, message: "Unable to connect to the server. Please try again." });
    });
});
