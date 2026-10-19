import { describe, expect, it } from "vitest";
import type { ApiCourt } from "../app/types/court";
import { selectFeaturedCourts } from "../app/lib/featured-courts";

function apiCourt(overrides: Partial<ApiCourt> = {}): ApiCourt {
    return {
        id: 1,
        name: "Court 1",
        type: "Indoor",
        description: "Court description",
        hourly_rate: "350.50",
        status: "available",
        location: "Quezon City",
        amenities: ["Lighting"],
        opening_time: "08:00:00",
        closing_time: "22:00:00",
        operating_days: ["Monday", "Wednesday"],
        image: null,
        created_at: null,
        updated_at: null,
        ...overrides,
    };
}

describe("featured court selection", () => {
    it("selects only exactly available supported records", () => {
        const selected = selectFeaturedCourts([
            apiCourt({ id: 1, status: "unavailable" }),
            apiCourt({ id: 2, status: "AVAILABLE" }),
            apiCourt({ id: 3, type: "Other" }),
            { ...apiCourt({ id: 4 }), hourly_rate: "not a price" },
            apiCourt({ id: 5, name: "Valid Court" }),
        ]);
        expect(selected.map((court) => court.id)).toEqual(["5"]);
    });

    it("keeps API order and returns no more than the three-card feature limit", () => {
        const records = [1, 2, 3, 4, 5].map((id) => apiCourt({ id }));
        expect(selectFeaturedCourts(records).map((court) => court.id)).toEqual(["1", "2", "3"]);
        expect(selectFeaturedCourts(records).map((court) => court.id)).toEqual(["1", "2", "3"]);
    });

    it("returns fewer cards when fewer valid courts exist and never fills from mock data", () => {
        const selected = selectFeaturedCourts([apiCourt({ id: 73 }), apiCourt({ id: 74, status: "unavailable" })]);
        expect(selected).toHaveLength(1);
        expect(selected[0].id).toBe("73");
        expect(selectFeaturedCourts([])).toEqual([]);
        expect(selectFeaturedCourts(null)).toEqual([]);
    });

    it("uses actual database IDs, rates, category, and available-for-booking state", () => {
        const [court] = selectFeaturedCourts([apiCourt({ id: 912, name: "North Court", hourly_rate: "275.25" })]);
        expect(court).toMatchObject({ id: "912", name: "North Court", pricePerHour: 275.25, available: true });
    });
});
