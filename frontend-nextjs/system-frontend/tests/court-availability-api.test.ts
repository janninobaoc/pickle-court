import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    findAvailableSlot,
    getAvailableEndTimes,
    getAvailableStartTimes,
    getBookingRescheduleAvailability,
    getCourtAvailability,
    getNoSlotsMessage,
    type CourtAvailability,
} from "../app/lib/court-availability-api";

const date = "2026-10-15";
const responseBody = {
    status: 200,
    data: {
        court_id: 17,
        date,
        court_status: "available",
        opening_time: "08:00:00",
        closing_time: "11:00:00",
        slot_duration_minutes: 60,
        reason: null,
        slots: [
            { start_time: "08:00:00", end_time: "09:00:00", available: true },
            { start_time: "09:00:00", end_time: "10:00:00", available: false, reason: "booked" },
            { start_time: "10:00:00", end_time: "11:00:00", available: true },
        ],
    },
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("public court availability API", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-01T04:00:00.000Z"));
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000/api");
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        fetchMock.mockReset();
    });

    it("requests the encoded public availability URL without CSRF or credentials", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(responseBody));

        await getCourtAvailability(17, date);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            `http://localhost:8000/api/courts/17/availability?date=${date}`,
            expect.objectContaining({ method: "GET", cache: "no-store", headers: { Accept: "application/json" } }),
        );
        const options = fetchMock.mock.calls[0][1] as RequestInit;
        expect(options.headers).not.toHaveProperty("X-XSRF-TOKEN");
        expect(options.credentials).toBeUndefined();
    });

    it("parses the Laravel availability contract including unavailable reasons", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(responseBody));

        await expect(getCourtAvailability(17, date)).resolves.toEqual({
            court_id: 17,
            date,
            court_status: "available",
            opening_time: "08:00:00",
            closing_time: "11:00:00",
            slot_duration_minutes: 60,
            reason: null,
            slots: [
                { start_time: "08:00:00", end_time: "09:00:00", available: true },
                { start_time: "09:00:00", end_time: "10:00:00", available: false, reason: "booked" },
                { start_time: "10:00:00", end_time: "11:00:00", available: true },
            ],
        });
    });

    it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "not-a-court"])(
        "rejects invalid court ID %s without a request",
        async (courtId) => {
            await expect(getCourtAvailability(courtId as number | string, date)).rejects.toMatchObject({ status: 422 });
            expect(fetchMock).not.toHaveBeenCalled();
        },
    );

    it.each(["2026-02-30", "2026-9-15", "2026-09-30", "nonsense"])(
        "rejects invalid or past date %s without a request",
        async (requestedDate) => {
            await expect(getCourtAvailability(17, requestedDate)).rejects.toMatchObject({ status: 422 });
            expect(fetchMock).not.toHaveBeenCalled();
        },
    );

    it.each([
        [404, "This court could not be found."],
        [422, "Choose a valid booking date from today onward."],
        [500, "Unable to load court availability. Please try again."],
    ])("maps HTTP %i to safe availability feedback", async (status, message) => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "private backend detail" }, status));

        await expect(getCourtAvailability(17, date)).rejects.toMatchObject({ status, message });
    });

    it("rejects a malformed success body safely", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ status: 200, data: { ...responseBody.data, slots: [{ available: true }] } }));

        await expect(getCourtAvailability(17, date)).rejects.toMatchObject({
            status: 500,
            message: "Unable to load court availability. Please try again.",
        });
    });

    it("maps network failures without exposing browser error details", async () => {
        fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

        await expect(getCourtAvailability(17, date)).rejects.toMatchObject({
            status: 0,
            message: "Unable to load court availability. Please try again.",
        });
    });

    it("passes AbortSignal to fetch and preserves aborts", async () => {
        const controller = new AbortController();
        fetchMock.mockImplementationOnce((_url: string, options: RequestInit) => {
            expect(options.signal).toBe(controller.signal);
            return Promise.reject(new DOMException("Aborted", "AbortError"));
        });

        await expect(getCourtAvailability(17, date, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    });
});

describe("authenticated rescheduling availability API", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-01T04:00:00.000Z"));
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000/api");
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        fetchMock.mockReset();
    });

    it("uses the authenticated booking availability URL without CSRF initialization", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(responseBody));

        await getBookingRescheduleAvailability(51, date);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            `http://localhost:8000/api/bookings/51/availability?date=${date}`,
            expect.objectContaining({ method: "GET", credentials: "include", cache: "no-store" }),
        );
        const options = fetchMock.mock.calls[0][1] as RequestInit;
        expect(options.headers).not.toHaveProperty("X-XSRF-TOKEN");
    });

    it("rejects invalid booking IDs and dates before making a request", async () => {
        await expect(getBookingRescheduleAvailability(0, date)).rejects.toMatchObject({ status: 422 });
        await expect(getBookingRescheduleAvailability(51, "2026-02-30")).rejects.toMatchObject({ status: 422 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
        [401, "Your session could not be verified. Please log in again."],
        [403, "You are not allowed to view availability for this booking."],
        [404, "Booking not found."],
        [409, "This booking cannot be rescheduled right now."],
        [419, "Your session expired. Please refresh the page and try again."],
        [422, "Choose a valid booking date from today onward."],
        [500, "Unable to load court availability. Please try again."],
    ])("maps rescheduling availability HTTP %i safely", async (status, message) => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "private internal detail" }, status));

        await expect(getBookingRescheduleAvailability(51, date)).rejects.toMatchObject({ status, message });
    });

    it("does not expose internal server messages from an unavailable booking", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "A booking that has already started cannot be rescheduled." }, 409));

        await expect(getBookingRescheduleAvailability(51, date)).rejects.toMatchObject({
            status: 409,
            message: "A booking that has already started cannot be rescheduled.",
        });
    });
});

describe("availability slot selection", () => {
    const availability = {
        court_id: 17,
        date,
        court_status: "available",
        opening_time: "08:00:00",
        closing_time: "10:00:00",
        slot_duration_minutes: 60,
        reason: null,
        slots: [
            { start_time: "08:00:00", end_time: "09:00:00", available: true },
            { start_time: "09:00:00", end_time: "10:00:00", available: false, reason: "booked" },
                { start_time: "10:00:00", end_time: "11:00:00", available: true },
        ],
    } satisfies CourtAvailability;

    it("allows selection only from available slots in the latest date response", () => {
        expect(findAvailableSlot(availability, date, "08:00", "09:00")?.available).toBe(true);
        expect(findAvailableSlot(availability, date, "09:00", "10:00")).toBeNull();
        expect(findAvailableSlot(availability, "2026-10-16", "08:00", "09:00")).toBeNull();
        expect(findAvailableSlot(null, date, "08:00", "09:00")).toBeNull();
    });

    it("allows an interval only when every contiguous hourly segment is available", () => {
        const contiguous = {
            ...availability,
            slots: [
                { start_time: "08:00:00", end_time: "09:00:00", available: true },
                { start_time: "09:00:00", end_time: "10:00:00", available: true },
                { start_time: "10:00:00", end_time: "11:00:00", available: false, reason: "booked" },
            ],
            closing_time: "11:00:00",
        };

        expect(findAvailableSlot(contiguous, date, "08:00", "10:00")).toMatchObject({
            start_time: "08:00:00", end_time: "10:00:00", available: true,
        });
        expect(findAvailableSlot(contiguous, date, "08:00", "11:00")).toBeNull();
        expect(getAvailableStartTimes(contiguous)).toEqual(["08:00", "09:00"]);
        expect(getAvailableEndTimes(contiguous, date, "08:00")).toEqual(["09:00", "10:00"]);
    });

    it("allows the shorter final segment through closing time and preserves opening alignment", () => {
        const aligned = {
            ...availability,
            opening_time: "08:30:00",
            closing_time: "10:45:00",
            slots: [
                { start_time: "08:30:00", end_time: "09:30:00", available: true },
                { start_time: "09:30:00", end_time: "10:30:00", available: true },
                { start_time: "10:30:00", end_time: "10:45:00", available: true },
            ],
        };

        expect(findAvailableSlot(aligned, date, "08:30", "10:45")?.end_time).toBe("10:45:00");
        expect(getAvailableStartTimes(aligned)).toEqual(["08:30", "09:30", "10:30"]);
        expect(getAvailableEndTimes(aligned, date, "08:30")).toEqual(["09:30", "10:30", "10:45"]);
    });

    it("fails closed when availability contains a gap inside a requested interval", () => {
        const gap = {
            ...availability,
            slots: [
                { start_time: "08:00:00", end_time: "09:00:00", available: true },
                { start_time: "09:30:00", end_time: "10:00:00", available: true },
            ],
        };

        expect(findAvailableSlot(gap, date, "08:00", "10:00")).toBeNull();
    });

    it("explains empty and fully unavailable dates", () => {
        expect(getNoSlotsMessage({ ...availability, slots: [] })).toBe("No time slots are available for this date. Please choose another date.");
        expect(getNoSlotsMessage({ ...availability, slots: availability.slots.map((slot) => ({ ...slot, available: false })) }))
            .toBe("No available time slots for this date. Please choose another date.");
    });

    it("uses backend reasons for closed and unbookable dates", () => {
        expect(getNoSlotsMessage({ ...availability, reason: "closed_day", slots: [] })).toContain("closed");
        expect(getNoSlotsMessage({ ...availability, reason: "court_unavailable", slots: [] })).toContain("unavailable");
        expect(getNoSlotsMessage({ ...availability, reason: "operating_hours_unconfigured", slots: [] })).toContain("hours");
    });
});
