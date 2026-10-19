import { describe, expect, it } from "vitest";
import type { ApiCourt } from "../app/types/court";
import { mapApiCourt, mapOperatingDays } from "../app/lib/court-mapper";

function makeApiCourt(overrides: Partial<ApiCourt> = {}): ApiCourt {
  return {
    id: 42,
    name: "Northside Indoor Courts",
    type: "Indoor",
    description: "Climate-controlled courts for year-round play.",
    hourly_rate: "350.50",
    status: "available",
    location: "Makati City",
    amenities: ["Parking", "Restrooms"],
    opening_time: "06:00:00",
    closing_time: "22:00:00",
    operating_days: ["Monday", "Wednesday", "Friday"],
    image: "/storage/courts/northside.jpg",
    created_at: "2026-10-01T08:00:00.000000Z",
    updated_at: "2026-10-02T09:00:00.000000Z",
    ...overrides,
  };
}

describe("mapApiCourt", () => {
  it("maps a complete valid indoor Laravel court record", () => {
    const mapped = mapApiCourt(makeApiCourt());

    expect(mapped).toEqual({
      id: "42",
      name: "Northside Indoor Courts",
      description: "Climate-controlled courts for year-round play.",
      category: "Indoor",
      pricePerHour: 350.5,
      available: true,
      location: "Makati City",
      amenities: ["Parking", "Restrooms"],
      operatingHours: "Monday, Wednesday, Friday · 6:00 AM–10:00 PM",
      openingTime: "06:00",
      closingTime: "22:00",
      operatingDays: [1, 3, 5],
      artwork: "indoor",
      image: undefined,
    });
  });

  it("maps an outdoor court and unavailable status to outdoor artwork and false", () => {
    const mapped = mapApiCourt(makeApiCourt({
      id: 43,
      type: "Outdoor",
      status: "unavailable",
    }));

    expect(mapped.category).toBe("Outdoor");
    expect(mapped.artwork).toBe("outdoor");
    expect(mapped.available).toBe(false);
  });

  it.each([
    ["Monday", 1],
    ["Tuesday", 2],
    ["Wednesday", 3],
    ["Thursday", 4],
    ["Friday", 5],
    ["Saturday", 6],
    ["Sunday", 0],
  ] as const)("maps %s to weekday number %i", (day, expected) => {
    expect(mapOperatingDays([day])).toEqual([expected]);
  });

  it("maps Sunday to 0 and Saturday to 6 in a combined list", () => {
    expect(mapOperatingDays(["Sunday", "Saturday"])).toEqual([0, 6]);
  });

  it("maps null operating days to an empty array", () => {
    expect(mapOperatingDays(null)).toEqual([]);
  });

  it("skips unknown weekday names safely", () => {
    expect(mapOperatingDays(["Funday", "Monday"])).toEqual([1]);
  });

  it("preserves weekday order", () => {
    expect(mapOperatingDays(["Friday", "Monday", "Sunday"])).toEqual([5, 1, 0]);
  });

  it("uses the existing location fallback for null or blank locations", () => {
    expect(mapApiCourt(makeApiCourt({ location: null })).location).toBe("Location not provided");
    expect(mapApiCourt(makeApiCourt({ location: "  " })).location).toBe("Location not provided");
  });

  it("maps null amenities to an empty array", () => {
    expect(mapApiCourt(makeApiCourt({ amenities: null })).amenities).toEqual([]);
  });

  it.each([
    ["06:00", "06:00"],
    ["06:00:00", "06:00"],
  ])("normalizes valid Laravel time %s to %s", (input, expected) => {
    expect(mapApiCourt(makeApiCourt({ opening_time: input })).openingTime).toBe(expected);
  });

  it("maps an unsupported hour-only time value to an empty string", () => {
    expect(mapApiCourt(makeApiCourt({ opening_time: "06" })).openingTime).toBe("");
  });

  it.each([null, "25:00", "6:00", "06:60", "06:00:99"]) (
    "maps null or invalid opening times (%s) to an empty string",
    (openingTime) => {
      expect(mapApiCourt(makeApiCourt({ opening_time: openingTime })).openingTime).toBe("");
    },
  );

  it("maps a null closing time to an empty string", () => {
    expect(mapApiCourt(makeApiCourt({ closing_time: null })).closingTime).toBe("");
  });

  it("uses the operating-hours fallback when either time is missing", () => {
    expect(mapApiCourt(makeApiCourt({ opening_time: null })).operatingHours).toBe("Operating hours not provided");
    expect(mapApiCourt(makeApiCourt({ closing_time: null })).operatingHours).toBe("Operating hours not provided");
  });

  it("does not treat Laravel image paths as Next.js image URLs", () => {
    expect(mapApiCourt(makeApiCourt({ image: "/storage/courts/private.jpg" })).image).toBeUndefined();
  });

  it("does not mutate the API record or its arrays", () => {
    const apiCourt = makeApiCourt();
    const original = structuredClone(apiCourt);

    mapApiCourt(apiCourt);

    expect(apiCourt).toEqual(original);
    expect(apiCourt.amenities).toEqual(original.amenities);
    expect(apiCourt.operating_days).toEqual(original.operating_days);
  });

  it("maps a court with nullable optional fields safely", () => {
    const mapped = mapApiCourt(makeApiCourt({
      description: null,
      location: null,
      amenities: null,
      opening_time: null,
      closing_time: null,
      operating_days: null,
      image: null,
    }));

    expect(mapped.description).toBe("");
    expect(mapped.location).toBe("Location not provided");
    expect(mapped.amenities).toEqual([]);
    expect(mapped.operatingDays).toEqual([]);
    expect(mapped.openingTime).toBe("");
    expect(mapped.closingTime).toBe("");
    expect(mapped.operatingHours).toBe("Operating hours not provided");
    expect(mapped.image).toBeUndefined();
  });
});
