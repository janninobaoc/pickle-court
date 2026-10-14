import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCourts } from "../app/lib/courts-api";

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

    it("gets real court records from the existing public GET /api/courts endpoint", async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([apiCourt]), { status: 200 }));
        await expect(getCourts()).resolves.toEqual([apiCourt]);
        expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/courts", { cache: "no-store" });
    });

    it("rejects an unsuccessful backend response", async () => {
        fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
        await expect(getCourts()).rejects.toThrow("Failed to fetch courts: 503");
    });

    it("rejects a malformed non-array response", async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [apiCourt] }), { status: 200 }));
        await expect(getCourts()).rejects.toThrow("Invalid courts response");
    });
});
