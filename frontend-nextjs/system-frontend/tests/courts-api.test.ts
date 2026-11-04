import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCourtById, getCourts } from "../app/lib/courts-api";

const apiCourt = {
    id: 17,
    name: "Riverside Court",
    type: "Indoor",
    description: "",
    hourly_rate: "350.50",
    status: "available",
    location: null,
    amenities: [],
    opening_time: "08:00:00",
    closing_time: "22:00:00",
    operating_days: ["Monday"],
    image: null,
    created_at: null,
    updated_at: null,
};

describe("public courts API helper", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000/api");
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        fetchMock.mockReset();
    });

    it.each([
        ["http://localhost:8000", "http://localhost:8000/api/courts"],
        ["http://localhost:8000/api", "http://localhost:8000/api/courts"],
        ["http://localhost:8000/api/api/", "http://localhost:8000/api/courts"],
    ])("gets public court records from %s with one API prefix", async (baseUrl, expectedUrl) => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", baseUrl);
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([apiCourt]), { status: 200 }));
        await expect(getCourts()).resolves.toEqual([apiCourt]);
        expect(fetchMock).toHaveBeenCalledWith(expectedUrl, {
            method: "GET",
            credentials: "omit",
            headers: {
                Accept: "application/json",
            },
            cache: "no-store",
        });
        expect(new Headers(fetchMock.mock.calls[0][1].headers).has("Authorization")).toBe(false);
    });

    it("rejects an unsuccessful backend response", async () => {
        fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
        await expect(getCourts()).rejects.toThrow("Failed to fetch courts (503)");
    });

    it("rejects a malformed non-array response", async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [apiCourt] }), { status: 200 }));
        await expect(getCourts()).rejects.toThrow("Invalid courts response");
    });

    it.each([
        ["http://localhost:8000", "http://localhost:8000/api/courts/17"],
        ["http://localhost:8000/api", "http://localhost:8000/api/courts/17"],
    ])("gets a public court detail from %s with one API prefix", async (baseUrl, expectedUrl) => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", baseUrl);
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(apiCourt), { status: 200 }));

        await expect(getCourtById("17")).resolves.toEqual(apiCourt);
        expect(fetchMock).toHaveBeenCalledWith(expectedUrl, {
            method: "GET",
            credentials: "omit",
            headers: { Accept: "application/json" },
            cache: "no-store",
        });
        expect(new Headers(fetchMock.mock.calls[0][1].headers).has("Authorization")).toBe(false);
    });

    it("preserves the public court detail not-found behavior", async () => {
        fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
        await expect(getCourtById("missing")).resolves.toBeNull();
    });

    it("rejects other unsuccessful court detail responses", async () => {
        fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
        await expect(getCourtById("17")).rejects.toThrow("Failed to fetch court by ID (503)");
    });

    it("preserves the missing API base URL error for both public requests", async () => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", undefined);

        await expect(getCourts()).rejects.toThrow("API base URL is not defined in environment variables.");
        await expect(getCourtById("17")).rejects.toThrow("API base URL is not defined in environment variables.");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
