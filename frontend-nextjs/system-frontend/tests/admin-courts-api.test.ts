import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    AdminCourtsApiError,
    createAdminCourt,
    getAdminCourts,
    updateAdminCourt,
} from "../app/lib/admin-courts-api";
import { AuthApiError } from "../app/lib/auth-api";
import type { ApiCourt, CreateAdminCourtPayload } from "../app/types/court";

const apiBaseUrl = (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000/api"
).replace(/\/+$/, "");
const backendOrigin = new URL(apiBaseUrl).origin;

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

function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

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
        vi.stubGlobal("document", { cookie: "XSRF-TOKEN=csrf%20token" });
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

    describe("createAdminCourt", () => {
        it("initializes Sanctum and posts the typed payload with session and CSRF headers", async () => {
            const responseBody = {
                status: 200,
                message: "Court created succesfully",
            };
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(jsonResponse(responseBody, 201));

            await expect(createAdminCourt(courtPayload)).resolves.toEqual(responseBody);

            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(fetchMock.mock.calls[0][0]).toBe(`${backendOrigin}/sanctum/csrf-cookie`);
            expect(fetchMock.mock.calls[0][1]).toMatchObject({
                method: "GET",
                credentials: "include",
                headers: { Accept: "application/json" },
            });
            expect(fetchMock.mock.calls[1][0]).toBe(`${apiBaseUrl}/admin/courts`);
            const protectedRequest = fetchMock.mock.calls[1][1] as RequestInit;
            const requestHeaders = new Headers(protectedRequest.headers);
            expect(protectedRequest).toMatchObject({
                method: "POST",
                credentials: "include",
                body: JSON.stringify(courtPayload),
            });
            expect(requestHeaders.get("Accept")).toBe("application/json");
            expect(requestHeaders.get("Content-Type")).toBe("application/json");
            expect(requestHeaders.get("X-XSRF-TOKEN")).toBe("csrf token");
        });

        it.each([
            [401, "Unauthenticated."],
            [403, "This action is unauthorized."],
            [419, "Your session expired."],
            [500, "Unable to create court."],
        ])("preserves the HTTP %i status and Laravel message", async (status, message) => {
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(jsonResponse({ message }, status));

            const error = await createAdminCourt(courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AdminCourtsApiError);
            expect(error).toMatchObject({ status, message });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("preserves Laravel field errors from a 422 response", async () => {
            const validationErrors = {
                name: ["The name field is required."],
                hourly_rate: ["The hourly rate must be at least 0."],
            };
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(
                    jsonResponse(
                        { message: "The given data was invalid.", errors: validationErrors },
                        422,
                    ),
                );

            const error = await createAdminCourt(courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AdminCourtsApiError);
            expect(error).toMatchObject({
                status: 422,
                message: "The given data was invalid.",
                errors: validationErrors,
            });
        });

        it.each([
            ["missing errors", { message: "Invalid court." }],
            ["null errors", { message: "Invalid court.", errors: null }],
            ["array errors", { message: "Invalid court.", errors: ["invalid"] }],
            [
                "non-string field messages",
                { message: "Invalid court.", errors: { name: ["Required", 3] } },
            ],
        ])("uses an empty validation map for %s", async (_case, body) => {
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(jsonResponse(body, 422));

            const error = await createAdminCourt(courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AdminCourtsApiError);
            expect(error).toMatchObject({ status: 422, errors: {} });
        });

        it.each(["", "   "])("uses the status fallback for a blank error message", async (message) => {
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(jsonResponse({ message }, 500));

            const error = await createAdminCourt(courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AdminCourtsApiError);
            expect(error).toMatchObject({
                status: 500,
                message: "Failed to create admin court (500)",
            });
        });

        it("uses a status fallback for a non-JSON error response", async () => {
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(new Response("not JSON", { status: 500 }));

            const error = await createAdminCourt(courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AdminCourtsApiError);
            expect(error).toMatchObject({
                status: 500,
                message: "Failed to create admin court (500)",
            });
        });

        it.each([
            ["null body", "null"],
            ["array body", "[]"],
            ["missing status", JSON.stringify({ message: "Created" })],
            ["non-numeric status", JSON.stringify({ status: "200", message: "Created" })],
            ["missing message", JSON.stringify({ status: 200 })],
            ["non-string message", JSON.stringify({ status: 200, message: 12 })],
        ])("rejects a successful response with %s", async (_case, body) => {
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(new Response(body, { status: 201 }));

            const error = await createAdminCourt(courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AdminCourtsApiError);
            expect(error).toMatchObject({
                status: 201,
                message: "Invalid court creation response (201)",
            });
        });

        it("rejects invalid JSON from a successful response with its HTTP status", async () => {
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(new Response("not JSON", { status: 201 }));

            const error = await createAdminCourt(courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AdminCourtsApiError);
            expect(error).toMatchObject({
                status: 201,
                message: "Invalid court creation response (201)",
            });
        });

        it.each([undefined, null])(
            "allows operating_days to be omitted or null (%s)",
            async (operatingDays) => {
                const payload = { ...courtPayload };
                if (operatingDays === undefined) {
                    delete payload.operating_days;
                } else {
                    payload.operating_days = operatingDays;
                }

                fetchMock
                    .mockResolvedValueOnce(new Response(null, { status: 204 }))
                    .mockResolvedValueOnce(
                        jsonResponse({ status: 200, message: "Court created" }, 201),
                    );

                await expect(createAdminCourt(payload)).resolves.toMatchObject({
                    status: 200,
                    message: "Court created",
                });
                const requestBody = fetchMock.mock.calls[1]?.[1]?.body;
                expect(typeof requestBody).toBe("string");
                expect(JSON.parse(requestBody as string)).toEqual(payload);
            },
        );

        it("does not send the protected POST when CSRF initialization fails", async () => {
            fetchMock.mockResolvedValueOnce(new Response(null, { status: 419 }));

            const error = await createAdminCourt(courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AuthApiError);
            expect(error).toHaveProperty("status", 419);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it("does not send the protected POST when the CSRF cookie is missing", async () => {
            vi.stubGlobal("document", { cookie: "" });
            fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

            await expect(createAdminCourt(courtPayload)).rejects.toThrow(
                "CSRF cookie was not received.",
            );
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it("propagates a CSRF initialization network failure without retrying", async () => {
            const networkError = new TypeError("Network unavailable");
            fetchMock.mockRejectedValueOnce(networkError);

            await expect(createAdminCourt(courtPayload)).rejects.toBe(networkError);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it("propagates a protected request network failure without retrying", async () => {
            const networkError = new TypeError("Network unavailable");
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockRejectedValueOnce(networkError);

            await expect(createAdminCourt(courtPayload)).rejects.toBe(networkError);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("sends only one POST after an HTTP failure", async () => {
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(jsonResponse({ message: "Server error" }, 500));

            await expect(createAdminCourt(courtPayload)).rejects.toBeInstanceOf(
                AdminCourtsApiError,
            );

            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(
                fetchMock.mock.calls.filter(
                    ([, init]) => (init as RequestInit | undefined)?.method === "POST",
                ),
            ).toHaveLength(1);
        });

        it("uses the helper's localhost API fallback when both API environment variables are missing", async () => {
            vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", undefined);
            vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
            vi.resetModules();

            const { createAdminCourt: createWithFallback } = await import(
                "../app/lib/admin-courts-api"
            );
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(
                    jsonResponse({ status: 200, message: "Court created" }, 201),
                );

            await expect(createWithFallback(courtPayload)).resolves.toMatchObject({
                status: 200,
                message: "Court created",
            });
            expect(fetchMock.mock.calls[0][0]).toBe(
                "http://localhost:8000/sanctum/csrf-cookie",
            );
            expect(fetchMock.mock.calls[1][0]).toBe(
                "http://localhost:8000/api/admin/courts",
            );
            vi.resetModules();
        });
    });

    describe("updateAdminCourt", () => {
        const updatedCourt: ApiCourt = {
            ...apiCourts[0],
            name: "Riverside Updated Court",
            hourly_rate: "375.00",
            updated_at: "2026-10-21T09:30:00.000000Z",
        };
        const updateResponse = {
            status: 200,
            message: "Court updated successfully",
            data: updatedCourt,
        };

        it("initializes Sanctum and sends one typed PUT with credentials and CSRF headers", async () => {
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(jsonResponse(updateResponse, 200));

            await expect(updateAdminCourt("17", courtPayload)).resolves.toEqual(updateResponse);

            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(fetchMock.mock.calls[0][0]).toBe(`${backendOrigin}/sanctum/csrf-cookie`);
            expect(fetchMock.mock.calls[0][1]).toMatchObject({
                method: "GET",
                credentials: "include",
                headers: { Accept: "application/json" },
            });
            expect(fetchMock.mock.calls[1][0]).toBe(`${apiBaseUrl}/admin/courts/17`);
            const protectedRequest = fetchMock.mock.calls[1][1] as RequestInit;
            const requestHeaders = new Headers(protectedRequest.headers);
            expect(protectedRequest).toMatchObject({
                method: "PUT",
                credentials: "include",
                body: JSON.stringify(courtPayload),
            });
            expect(requestHeaders.get("Accept")).toBe("application/json");
            expect(requestHeaders.get("Content-Type")).toBe("application/json");
            expect(requestHeaders.get("X-XSRF-TOKEN")).toBe("csrf token");
        });

        it.each([
            [401, "Unauthenticated."],
            [403, "This action is unauthorized."],
            [419, "Your session expired."],
            [500, "Unable to update court."],
        ])("preserves the HTTP %i status and Laravel message", async (status, message) => {
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(jsonResponse({ message }, status));

            const error = await updateAdminCourt(17, courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AdminCourtsApiError);
            expect(error).toMatchObject({ status, message });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("preserves Laravel field errors from an HTTP 422 response", async () => {
            const validationErrors = {
                name: ["The name has already been taken."],
                hourly_rate: ["The hourly rate must have at most two decimal places."],
            };
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(jsonResponse({
                    message: "The given data was invalid.",
                    errors: validationErrors,
                }, 422));

            const error = await updateAdminCourt(17, courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AdminCourtsApiError);
            expect(error).toMatchObject({
                status: 422,
                message: "The given data was invalid.",
                errors: validationErrors,
            });
        });

        it("uses a status fallback for non-JSON error responses", async () => {
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(new Response("not JSON", { status: 500 }));

            const error = await updateAdminCourt(17, courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AdminCourtsApiError);
            expect(error).toMatchObject({
                status: 500,
                message: "Failed to update admin court (500)",
            });
        });

        it.each([
            ["invalid JSON", "not JSON"],
            ["null body", "null"],
            ["array body", "[]"],
            ["missing status", JSON.stringify({ message: "Updated", data: updatedCourt })],
            ["non-numeric status", JSON.stringify({ status: "200", message: "Updated", data: updatedCourt })],
            ["missing message", JSON.stringify({ status: 200, data: updatedCourt })],
            ["non-string message", JSON.stringify({ status: 200, message: 12, data: updatedCourt })],
            ["missing court data", JSON.stringify({ status: 200, message: "Updated" })],
            ["malformed court data", JSON.stringify({ status: 200, message: "Updated", data: { id: 17 } })],
        ])("rejects a successful response with %s", async (_case, body) => {
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockResolvedValueOnce(new Response(body, { status: 200 }));

            const error = await updateAdminCourt(17, courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AdminCourtsApiError);
            expect(error).toMatchObject({
                status: 200,
                message: "Invalid court update response (200)",
            });
        });

        it("does not send the protected PUT when CSRF initialization fails", async () => {
            fetchMock.mockResolvedValueOnce(new Response(null, { status: 419 }));

            const error = await updateAdminCourt(17, courtPayload).catch(
                (reason: unknown) => reason,
            );

            expect(error).toBeInstanceOf(AuthApiError);
            expect(error).toHaveProperty("status", 419);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it("propagates protected-request network failures without retrying the PUT", async () => {
            const networkError = new TypeError("Network unavailable");
            fetchMock
                .mockResolvedValueOnce(new Response(null, { status: 204 }))
                .mockRejectedValueOnce(networkError);

            await expect(updateAdminCourt(17, courtPayload)).rejects.toBe(networkError);
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(
                fetchMock.mock.calls.filter(
                    ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
                ),
            ).toHaveLength(1);
        });
    });
});
