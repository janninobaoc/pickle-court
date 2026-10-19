import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminCourtsApiError, getAdminCourts } from "../app/lib/admin-courts-api";
import type { ApiCourt } from "../app/types/court";

const apiCourts: ApiCourt[] = [
    {
        id: 17,
        name: "Riverside Court",
        type: "Indoor",
        description: "Indoor courts near the river.",
        hourly_rate: "350.50",
        status: "available",
        location: "Cebu City",
        amenities: ["Parking"],
        opening_time: "08:00:00",
        closing_time: "22:00:00",
        operating_days: ["Monday", "Tuesday"],
        image: null,
        created_at: null,
        updated_at: null,
    },
    {
        id: 18,
        name: "Mabolo Outdoor Court",
        type: "Outdoor",
        description: null,
        hourly_rate: 275,
        status: "unavailable",
        location: "Mabolo",
        amenities: [],
        opening_time: null,
        closing_time: null,
        operating_days: null,
        image: null,
        created_at: null,
        updated_at: null,
    },
];

describe("admin courts API helper", () => {
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000/api");
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        fetchMock.mockReset();
    });

    it("fetches and returns courts from the admin endpoint with Sanctum credentials", async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(apiCourts), { status: 200 }));

        await expect(getAdminCourts()).resolves.toEqual(apiCourts);
        expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/admin/courts", {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json",
            },
            cache: "no-store",
        });
    });

    it("accepts an empty court list", async () => {
        fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));

        await expect(getAdminCourts()).resolves.toEqual([]);
    });

    it.each([401, 403, 500])("rejects an HTTP %i response", async (status) => {
        fetchMock.mockResolvedValueOnce(new Response("{}", { status }));

        const request = getAdminCourts();
        const expectedMessage = `Failed to fetch admin courts (${status})`;
        await expect(request).rejects.toBeInstanceOf(AdminCourtsApiError);
        await expect(request).rejects.toThrow(expectedMessage);

        const error = await request.catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(AdminCourtsApiError);
        expect(error).toHaveProperty("status", status);
    });

    it("rejects a JSON object instead of a court array", async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: apiCourts }), { status: 200 }));

        const error = await getAdminCourts().catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(AdminCourtsApiError);
        expect(error).toHaveProperty("message", "Invalid admin courts response: expected an array.");
    });

    it("rejects clearly without calling fetch when the API base URL is missing", async () => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", undefined);

        await expect(getAdminCourts()).rejects.toThrow("API base URL is not defined in environment variables.");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uses the configured API base URL to request the exact admin endpoint", async () => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000/api");
        fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));

        await expect(getAdminCourts()).resolves.toEqual([]);
        expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/admin/courts", {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json",
            },
            cache: "no-store",
        });
    });
});
