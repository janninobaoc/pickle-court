import { describe, expect, it } from "vitest";
import type { Booking } from "../app/lib/booking-api";
import {
    bookingStatusLabel,
    formatBookingAmount,
    formatBookingListDate,
    formatBookingListTime,
    hasBookingEnded,
    isBookingCancellable,
    isBookingReschedulable,
    mergeCancelledBooking,
    mergeRescheduledBooking,
    validateRescheduleSelection,
} from "../app/lib/booking-display";

const sampleBooking: Booking = {
    id: 51,
    user_id: 8,
    court_id: 17,
    booking_date: "2026-10-15",
    start_time: "09:00:00",
    end_time: "10:00:00",
    status: "pending",
    total_amount: "500.00",
    created_at: null,
    updated_at: null,
    court: { id: 17, name: "Central Court", type: "indoor" },
};

describe("booking display formatting", () => {
    it("formats the stored booking date as a calendar date without UTC conversion", () => {
        expect(formatBookingListDate("2026-10-15")).toBe("Oct 15, 2026");
        expect(formatBookingListDate("2026-02-30")).toBe("Date unavailable");
    });

    it("formats Laravel times without treating them as timestamps", () => {
        expect(formatBookingListTime("09:00:00")).toBe("9:00 AM");
        expect(formatBookingListTime("10:00")).toBe("10:00 AM");
        expect(formatBookingListTime("22:15:00")).toBe("10:15 PM");
        expect(formatBookingListTime("not-a-time")).toBe("Time unavailable");
    });

    it("formats decimal amounts with two places without floating-point calculations", () => {
        expect(formatBookingAmount("500.00")).toBe("₱500.00");
        expect(formatBookingAmount("1234567.5")).toBe("₱1,234,567.50");
        expect(formatBookingAmount("invalid")).toBe("Amount unavailable");
    });

    it.each([
        ["pending", "Pending"],
        ["confirmed", "Confirmed"],
        ["cancelled", "Cancelled"],
    ] as const)("labels %s status", (status, label) => {
        expect(bookingStatusLabel(status)).toBe(label);
    });

    it("allows pending and confirmed future bookings to be cancelled in Asia/Manila time", () => {
        const justBeforeStart = new Date("2026-10-15T00:59:59.000Z"); // 08:59:59 Manila
        expect(isBookingCancellable(sampleBooking, justBeforeStart)).toBe(true);
        expect(isBookingCancellable({ ...sampleBooking, status: "confirmed" }, justBeforeStart)).toBe(true);
    });

    it("allows pending and confirmed future bookings to be rescheduled", () => {
        const beforeStart = new Date("2026-10-15T00:59:00.000Z");
        expect(isBookingReschedulable(sampleBooking, beforeStart)).toBe(true);
        expect(isBookingReschedulable({ ...sampleBooking, status: "confirmed" }, beforeStart)).toBe(true);
    });

    it("rejects cancelled or already-started bookings and treats the start instant as ineligible", () => {
        const atStart = new Date("2026-10-15T01:00:00.000Z"); // 09:00 Manila
        expect(isBookingCancellable(sampleBooking, atStart)).toBe(false);
        expect(isBookingCancellable({ ...sampleBooking, status: "cancelled" }, new Date("2026-10-15T00:00:00Z"))).toBe(false);
        expect(isBookingCancellable(sampleBooking, null)).toBe(false);
        expect(isBookingReschedulable({ ...sampleBooking, status: "cancelled" }, new Date("2026-10-15T00:00:00Z"))).toBe(false);
        expect(isBookingReschedulable(sampleBooking, atStart)).toBe(false);
    });

    it("validates required and correctly formatted reschedule dates and times", () => {
        expect(validateRescheduleSelection(sampleBooking, { booking_date: "", start_time: "", end_time: "" }, new Date("2026-10-01T00:00:00Z")))
            .toMatchObject({ booking_date: "Choose a booking date.", start_time: "Choose a start time.", end_time: "Choose an end time." });
        expect(validateRescheduleSelection(sampleBooking, { booking_date: "2026-02-30", start_time: "9:00", end_time: "10:00" }, new Date("2026-01-01T00:00:00Z")))
            .toMatchObject({ booking_date: "Enter a valid booking date.", start_time: "Enter a valid start time." });
    });

    it("rejects past dates, past starts today, reversed times, and unchanged schedules", () => {
        const now = new Date("2026-10-15T00:30:00.000Z"); // 08:30 Manila
        expect(validateRescheduleSelection(sampleBooking, { booking_date: "2026-10-14", start_time: "11:00", end_time: "12:00" }, now).booking_date)
            .toContain("past");
        expect(validateRescheduleSelection(sampleBooking, { booking_date: "2026-10-15", start_time: "08:00", end_time: "09:00" }, now).start_time)
            .toContain("future");
        expect(validateRescheduleSelection(sampleBooking, { booking_date: "2026-10-16", start_time: "11:00", end_time: "10:00" }, now).end_time)
            .toContain("later");
        expect(validateRescheduleSelection(sampleBooking, { booking_date: "2026-10-15", start_time: "09:00", end_time: "10:00" }, now).end_time)
            .toContain("different");
    });

    it("uses available court operating days and hours as guidance", () => {
        const scheduled = { ...sampleBooking, court: { ...sampleBooking.court!, operating_days: ["Friday"], opening_time: "08:00:00", closing_time: "18:00:00" } };
        const errors = validateRescheduleSelection(scheduled, { booking_date: "2026-10-19", start_time: "07:00", end_time: "08:00" }, new Date("2026-10-01T00:00:00Z"));
        expect(errors.booking_date).toContain("not scheduled");
        expect(errors.start_time).toContain("operating hours");
    });

    it("updates a booking only from the returned server cancellation and preserves its court", () => {
        const returned = { ...sampleBooking, status: "cancelled" as const, court: null };
        const result = mergeCancelledBooking([sampleBooking], returned);

        expect(result[0]).toMatchObject({ status: "cancelled", total_amount: "500.00", court: sampleBooking.court });
        expect(sampleBooking.status).toBe("pending");
    });

    it("leaves unrelated bookings unchanged when merging a cancellation", () => {
        const unrelated = { ...sampleBooking, id: 52 };
        const result = mergeCancelledBooking([sampleBooking, unrelated], { ...sampleBooking, status: "cancelled" });
        expect(result[1]).toBe(unrelated);
        expect(result[0].status).toBe("cancelled");
    });

    it("applies the backend schedule and amount while retaining the loaded court", () => {
        const updated = { ...sampleBooking, booking_date: "2026-10-20", start_time: "11:00:00", end_time: "12:00:00", total_amount: "600.00", court: null };
        const result = mergeRescheduledBooking([sampleBooking], updated);
        expect(result[0]).toMatchObject({ booking_date: "2026-10-20", total_amount: "600.00", court: sampleBooking.court });
        expect(sampleBooking.booking_date).toBe("2026-10-15");
    });

    it("uses the stored end date/time as a court-local wall clock", () => {
        expect(hasBookingEnded(sampleBooking, new Date("2026-10-15T01:00:00.000Z"))).toBe(false); // 09:00 Manila
        expect(hasBookingEnded(sampleBooking, new Date("2026-10-15T02:00:00.000Z"))).toBe(true); // 10:00 Manila
    });
});
