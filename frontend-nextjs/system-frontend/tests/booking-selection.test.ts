import { describe, expect, it } from "vitest";
import { courts } from "../app/data/courts";
import { DEFAULT_AUTH_REDIRECT, getSafeReturnTo } from "../app/lib/auth-redirect";
import {
    buildBookingReturnTo,
    buildLoginUrl,
    restoreBookingSelection,
} from "../app/lib/booking-selection";

const court = courts[0];
const validSelection = {
    date: "2026-10-15", // Thursday
    start: "09:00",
    end: "10:00",
};

describe("booking selection preservation", () => {
    it("builds a safe internal booking URL with encoded date and times", () => {
        const returnTo = buildBookingReturnTo(
            "/courts/1/book",
            validSelection.date,
            validSelection.start,
            validSelection.end,
        );

        expect(returnTo).toBe("/courts/1/book?date=2026-10-15&start=09%3A00&end=10%3A00");
        expect(buildLoginUrl(returnTo)).toBe(
            "/login?returnTo=%2Fcourts%2F1%2Fbook%3Fdate%3D2026-10-15%26start%3D09%253A00%26end%3D10%253A00",
        );
        expect(getSafeReturnTo(returnTo)).toBe(returnTo);
    });

    it("restores a valid date and time selection", () => {
        expect(restoreBookingSelection(validSelection, court, "2026-10-14")).toEqual({
            date: validSelection.date,
            startTime: validSelection.start,
            endTime: validSelection.end,
            notice: null,
        });
    });

    it("restores any opening-aligned duration, including the court closing boundary", () => {
        const longSelection = restoreBookingSelection({
            date: validSelection.date,
            start: "08:00",
            end: "22:00",
        }, court, "2026-10-14");
        expect(longSelection).toMatchObject({ startTime: "08:00", endTime: "22:00", notice: null });

        const nonAlignedCourt = { ...court, openingTime: "08:30", closingTime: "11:00" };
        const closingSelection = restoreBookingSelection({
            date: validSelection.date,
            start: "08:30",
            end: "11:00",
        }, nonAlignedCourt, "2026-10-14");
        expect(closingSelection).toMatchObject({ startTime: "08:30", endTime: "11:00", notice: null });
    });

    it("uses empty defaults when parameters are missing", () => {
        expect(restoreBookingSelection({}, court)).toEqual({
            date: "",
            startTime: "",
            endTime: "",
            notice: null,
        });
    });

    it.each([
        { date: "2026-02-30", start: "09:00", end: "10:00" },
        { date: "2026-10-15", start: "9:00", end: "10:00" },
        { date: "2026-10-15", start: "24:00", end: "25:00" },
        { date: "2026-10-15", start: "10:00", end: "09:00" },
        { date: "2026-10-15", start: "09:30", end: "10:30" },
        { date: "2026-10-15", start: ["09:00"], end: "10:00" },
    ])("rejects malformed or incompatible selection %#", (selection) => {
        const restored = restoreBookingSelection(selection, court, "2026-10-14");
        expect(restored.notice).toBeTruthy();
        if (selection.date === "2026-02-30") {
            expect(restored.date).toBe("");
        }
        if (selection.start === "9:00" || selection.start === "24:00" || selection.start === "09:30") {
            expect(restored.startTime).toBe("");
        }
        if (selection.end === "25:00" || selection.end === "09:00") {
            expect(restored.endTime).toBe("");
        }
    });

    it("rejects past dates", () => {
        const restored = restoreBookingSelection(validSelection, court, "2026-10-16");
        expect(restored.notice).toBeTruthy();
        expect(restored.date).toBe("");
    });

    it("rejects dates on a court's closed day", () => {
        const weekdayCourt = { ...court, operatingDays: [1] };
        const restored = restoreBookingSelection(validSelection, weekdayCourt, "2026-10-14");
        expect(restored.notice).toBeTruthy();
        expect(restored.date).toBe("");
    });

    it("keeps the shared returnTo validator's external and loop protections", () => {
        expect(getSafeReturnTo("https://evil.example/")).toBe(DEFAULT_AUTH_REDIRECT);
        expect(getSafeReturnTo("//evil.example/")).toBe(DEFAULT_AUTH_REDIRECT);
        expect(getSafeReturnTo("/login?returnTo=/courts/1/book")).toBe(DEFAULT_AUTH_REDIRECT);
    });
});
