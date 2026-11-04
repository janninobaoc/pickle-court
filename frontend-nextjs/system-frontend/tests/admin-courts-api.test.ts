import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    AdminCourtsApiError,
    createAdminCourt,
    deleteAdminCourt,
    getAdminCourt,
    getAdminCourts,
    updateAdminCourt,
} from "../app/lib/admin-courts-api";
import { clearAuthToken, setAuthToken } from "../app/lib/auth-token";
import type { ApiCourt, CreateAdminCourtPayload } from "../app/types/court";

const testToken = "admin-test-bearer-token";

const courtPayload: CreateAdminCourtPayload = {
    name: "Riverside Indoor Court",
    type: "Indoor",
    hourly_rate: 350.5,
    status: "available",
    description: "Indoor courts near the river.",
    location: "Cebu City",
    amenities: ["Parking", "Lighting"],
    opening_time: "08:00",
    closing_time: "22:00",
    operating_days: ["Monday", "Tuesday"],
    image: null,
};

const court: ApiCourt = {
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
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

const protectedOperations: Array<[string, () => Promise<unknown>]> = [
    ["list courts", () => getAdminCourts()],
    ["retrieve court details", () => getAdminCourt(17)],
    ["create court", () => createAdminCourt(courtPayload)],
    ["update court", () => updateAdminCourt(17, courtPayload)],
    ["delete court", () => deleteAdminCourt(17)],
];

describe("admin courts API helper", () => {
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000/api/api/");
        vi.stubGlobal("fetch", fetchMock);
        setAuthToken(testToken);
    });

    afterEach(() => {
        clearAuthToken();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        fetchMock.mockReset();
    });

    function expectBearerRequest(
        url: string,
        method: string,
        body?: string,
    ): void {
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe(url);

        const options = fetchMock.mock.calls[0][1] as RequestInit;
        const headers = new Headers(options.headers);
        expect(options.method).toBe(method);
        expect(options.credentials).toBe("omit");
        expect(headers.get("Accept")).toBe("application/json");
        expect(headers.get("Authorization")).toBe(`Bearer ${testToken}`);
        expect(headers.has("X-XSRF-TOKEN")).toBe(false);
        expect(headers.has("Cookie")).toBe(false);

        if (body !== undefined) {
            expect(options.body).toBe(body);
            expect(headers.get("Content-Type")).toBe("application/json");
        }
    }

    it("lists courts with a bearer token and normalizes the API prefix once", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse([court]));

        await expect(getAdminCourts()).resolves.toEqual([court]);

        expectBearerRequest("http://localhost:8000/api/admin/courts", "GET");
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    });

    it("accepts an empty court list and rejects an object instead of an array", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse([]));
        await expect(getAdminCourts()).resolves.toEqual([]);

        fetchMock.mockResolvedValueOnce(jsonResponse({ data: [court] }));
        await expect(getAdminCourts()).rejects.toThrow(
            "Invalid admin courts response: expected an array.",
        );
    });

    it("retrieves court details with a bearer token", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(court));

        await expect(getAdminCourt(17)).resolves.toEqual(court);

        expectBearerRequest("http://localhost:8000/api/admin/courts/17", "GET");
    });

    it("preserves a court detail 404 response", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Court not found." }, 404));

        await expect(getAdminCourt(17)).rejects.toMatchObject({
            status: 404,
            message: "Failed to fetch admin court (404)",
        });
    });

    it("creates a court with the existing payload and response contract", async () => {
        const responseBody = { status: 200, message: "Court created successfully." };
        fetchMock.mockResolvedValueOnce(jsonResponse(responseBody, 201));

        await expect(createAdminCourt(courtPayload)).resolves.toEqual(responseBody);

        expectBearerRequest(
            "http://localhost:8000/api/admin/courts",
            "POST",
            JSON.stringify(courtPayload),
        );
    });

    it("updates a court with the existing payload and response contract", async () => {
        const responseBody = { status: 200, message: "Court updated.", data: court };
        fetchMock.mockResolvedValueOnce(jsonResponse(responseBody));

        await expect(updateAdminCourt(17, courtPayload)).resolves.toEqual(responseBody);

        expectBearerRequest(
            "http://localhost:8000/api/admin/courts/17",
            "PUT",
            JSON.stringify(courtPayload),
        );
    });

    it("deletes a court and returns Laravel's message", async () => {
        const responseBody = { message: "Court deleted successfully." };
        fetchMock.mockResolvedValueOnce(jsonResponse(responseBody));

        await expect(deleteAdminCourt(17)).resolves.toEqual(responseBody);

        expectBearerRequest("http://localhost:8000/api/admin/courts/17", "DELETE");
    });

    it.each(protectedOperations)(
        "%s does not send a malformed Authorization header when no token exists",
        async (_operation, invoke) => {
            clearAuthToken();
            fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Unauthenticated." }, 401));

            const error = await invoke().catch((reason: unknown) => reason);

            expect(error).toBeInstanceOf(AdminCourtsApiError);
            const options = fetchMock.mock.calls[0][1] as RequestInit;
            const headers = new Headers(options.headers);
            expect(options.credentials).toBe("omit");
            expect(headers.has("Authorization")).toBe(false);
        },
    );

    it.each(protectedOperations)(
        "%s preserves the distinction between HTTP 401 and 403",
        async (_operation, invoke) => {
            for (const status of [401, 403]) {
                fetchMock.mockReset();
                fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Request denied." }, status));

                const error = await invoke().catch((reason: unknown) => reason);

                expect(error).toBeInstanceOf(AdminCourtsApiError);
                expect(error).toHaveProperty("status", status);
                expect(fetchMock).toHaveBeenCalledTimes(1);
                expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization"))
                    .toBe(`Bearer ${testToken}`);
            }
        },
    );

    it("preserves court creation validation errors", async () => {
        const errors = { name: ["The name field is required."] };
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Invalid data.", errors }, 422));

        await expect(createAdminCourt(courtPayload)).rejects.toMatchObject({
            status: 422,
            message: "Invalid data.",
            errors,
        });
    });

    it.each([
        ["missing errors", { message: "Invalid court." }],
        ["null errors", { message: "Invalid court.", errors: null }],
        ["array errors", { message: "Invalid court.", errors: ["invalid"] }],
        ["non-string field messages", { message: "Invalid court.", errors: { name: ["Required", 3] } }],
    ])("uses an empty validation map for %s", async (_case, body) => {
        fetchMock.mockResolvedValueOnce(jsonResponse(body, 422));

        await expect(createAdminCourt(courtPayload)).rejects.toMatchObject({
            status: 422,
            errors: {},
        });
    });

    it("preserves court update validation errors", async () => {
        const errors = { hourly_rate: ["The hourly rate must be positive."] };
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Invalid data.", errors }, 422));

        await expect(updateAdminCourt(17, courtPayload)).rejects.toMatchObject({
            status: 422,
            message: "Invalid data.",
            errors,
        });
    });

    it.each([401, 403, 500])("preserves update HTTP %i and the server message", async (status) => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Update rejected." }, status));

        await expect(updateAdminCourt(17, courtPayload)).rejects.toMatchObject({
            status,
            message: "Update rejected.",
        });
    });

    it.each([
        ["invalid JSON", "not JSON"],
        ["null body", "null"],
        ["array body", "[]"],
        ["missing status", JSON.stringify({ message: "Updated", data: court })],
        ["non-numeric status", JSON.stringify({ status: "200", message: "Updated", data: court })],
        ["missing message", JSON.stringify({ status: 200, data: court })],
        ["non-string message", JSON.stringify({ status: 200, message: 12, data: court })],
        ["missing court data", JSON.stringify({ status: 200, message: "Updated" })],
        ["malformed court data", JSON.stringify({ status: 200, message: "Updated", data: { id: 17 } })],
    ])("rejects an update response with %s", async (_case, body) => {
        fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));

        await expect(updateAdminCourt(17, courtPayload)).rejects.toMatchObject({
            status: 200,
            message: "Invalid court update response (200)",
        });
    });

    it("rejects malformed court-detail responses", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ id: 17 }));

        await expect(getAdminCourt(17)).rejects.toMatchObject({
            status: 200,
            message: "Invalid admin court response: expected a court object.",
        });
    });

    it("rejects malformed create, update, and delete success responses", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));
        await expect(createAdminCourt(courtPayload)).rejects.toMatchObject({ status: 200 });

        fetchMock.mockResolvedValueOnce(jsonResponse({ status: 200, message: "Updated", data: { id: 17 } }));
        await expect(updateAdminCourt(17, courtPayload)).rejects.toMatchObject({ status: 200 });

        fetchMock.mockResolvedValueOnce(jsonResponse({}));
        await expect(deleteAdminCourt(17)).rejects.toMatchObject({ status: 200 });
    });

    it("preserves delete not-found errors", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Court not found." }, 404));

        await expect(deleteAdminCourt(17)).rejects.toMatchObject({
            status: 404,
            message: "Court not found.",
        });
    });

    it("rejects a missing API base URL without making a request", async () => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", undefined);

        await expect(getAdminCourts()).rejects.toThrow(
            "API base URL is not defined in environment variables.",
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not request a CSRF cookie for any protected operation", async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse([court]))
            .mockResolvedValueOnce(jsonResponse(court))
            .mockResolvedValueOnce(jsonResponse({ status: 200, message: "Created" }, 201))
            .mockResolvedValueOnce(jsonResponse({ status: 200, message: "Updated", data: court }))
            .mockResolvedValueOnce(jsonResponse({ message: "Deleted" }));

        await getAdminCourts();
        await getAdminCourt(17);
        await createAdminCourt(courtPayload);
        await updateAdminCourt(17, courtPayload);
        await deleteAdminCourt(17);

        expect(fetchMock).toHaveBeenCalledTimes(5);
        for (const [url, init] of fetchMock.mock.calls) {
            expect(String(url)).not.toContain("csrf-cookie");
            expect(new Headers(init?.headers).has("X-XSRF-TOKEN")).toBe(false);
            expect((init as RequestInit).credentials).toBe("omit");
        }
    });
});
