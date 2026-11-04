import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    AuthApiError,
    getCurrentUser,
    invalidateCurrentUserRequest,
    login,
    logout,
    register,
} from "../app/lib/auth-api";
import { clearAuthToken, getAuthToken, setAuthToken } from "../app/lib/auth-token";

const user = {
    id: 12,
    name: "Court Customer",
    email: "customer@example.test",
    role: "customer" as const,
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

describe("authentication API bearer token handling", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        clearAuthToken();
        invalidateCurrentUserRequest();
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000");
        vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        clearAuthToken();
        invalidateCurrentUserRequest();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        fetchMock.mockReset();
    });

    it("stores the token returned by successful registration", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({
            message: "Registration successful.",
            token: "registration-token",
            user,
        }, 201));

        const response = await register({
            name: user.name,
            email: user.email,
            password: "safe-test-password",
            password_confirmation: "safe-test-password",
        });

        expect(response).toMatchObject({ message: "Registration successful.", user });
        expect(getAuthToken()).toBe("registration-token");
        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:8000/api/register",
            expect.objectContaining({ method: "POST", credentials: "omit" }),
        );
    });

    it("stores the token returned by successful login and adds the API prefix only once", async () => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000/api/api/");
        fetchMock.mockResolvedValueOnce(jsonResponse({
            message: "Login successful.",
            token: "login-token",
            user,
        }));

        await login({ email: user.email, password: "safe-test-password" });

        expect(getAuthToken()).toBe("login-token");
        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:8000/api/login",
            expect.objectContaining({ method: "POST", credentials: "omit" }),
        );
    });

    it("does not store a token after failed login", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Invalid email or password." }, 401));

        await expect(login({ email: user.email, password: "incorrect" })).rejects.toMatchObject({
            status: 401,
            message: "Invalid email or password.",
        });

        expect(getAuthToken()).toBeNull();
    });

    it("preserves registration validation errors without storing a token", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({
            message: "The given data was invalid.",
            errors: { email: ["The email has already been taken."] },
        }, 422));

        await expect(register({
            name: user.name,
            email: user.email,
            password: "safe-test-password",
            password_confirmation: "safe-test-password",
        })).rejects.toMatchObject({
            status: 422,
            errors: { email: ["The email has already been taken."] },
        });

        expect(getAuthToken()).toBeNull();
    });

    it("uses the bearer token to load the current user", async () => {
        const token = "current-user-token";
        const expectedUser = { ...user };
        setAuthToken(token);
        fetchMock.mockResolvedValueOnce(jsonResponse({ user: expectedUser }));

        await expect(getCurrentUser()).resolves.toEqual(expectedUser);

        expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/api/user");
        const options = fetchMock.mock.calls[0][1] as RequestInit;
        const headers = new Headers(options.headers);
        expect(options).toMatchObject({ method: "GET", credentials: "omit" });
        expect(headers.get("Accept")).toBe("application/json");
        expect(headers.get("Authorization")).toBe(`Bearer ${token}`);
    });

    it("clears the in-memory token when the current-user request is unauthorized", async () => {
        const token = "expired-current-user-token";
        setAuthToken(token);
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Unauthenticated." }, 401));

        await expect(getCurrentUser()).resolves.toBeNull();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/api/user");
        const options = fetchMock.mock.calls[0][1] as RequestInit;
        expect(new Headers(options.headers).get("Authorization")).toBe(`Bearer ${token}`);
        expect(getAuthToken()).toBeNull();
    });

    it("does not request the current user without a token", async () => {
        await expect(getCurrentUser()).resolves.toBeNull();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends the bearer token for logout and clears it after success", async () => {
        setAuthToken("logout-token");
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Logout successful." }));

        await expect(logout()).resolves.toEqual({ message: "Logout successful." });

        expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/api/logout");
        const options = fetchMock.mock.calls[0][1] as RequestInit;
        expect(options).toMatchObject({ method: "POST", credentials: "omit" });
        expect(new Headers(options.headers).get("Authorization")).toBe("Bearer logout-token");
        expect(getAuthToken()).toBeNull();
    });

    it("clears the token when logout reports that it is invalid or revoked", async () => {
        setAuthToken("revoked-token");
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Unauthenticated." }, 401));

        await expect(logout()).rejects.toBeInstanceOf(AuthApiError);

        expect(getAuthToken()).toBeNull();
    });

    it("clears the token when logout receives a forbidden response", async () => {
        setAuthToken("forbidden-logout-token");
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Forbidden." }, 403));

        await expect(logout()).rejects.toMatchObject({ status: 403 });

        expect(getAuthToken()).toBeNull();
    });

    it("clears the token after a network failure without exposing it in the error", async () => {
        const token = "network-failure-token";
        setAuthToken(token);
        fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

        const error = await logout().catch((caught: unknown) => caught as AuthApiError);

        expect(error).toBeInstanceOf(AuthApiError);
        expect(error).toMatchObject({
            status: 0,
            message: "Server-side token revocation could not be confirmed because the request failed.",
        });
        expect(error.message).not.toContain(token);
        expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/api/logout");
        const options = fetchMock.mock.calls[0][1] as RequestInit;
        expect(options.credentials).toBe("omit");
        expect(new Headers(options.headers).get("Authorization")).toBe(`Bearer ${token}`);
        expect(new Headers(options.headers).has("X-XSRF-TOKEN")).toBe(false);
        expect(getAuthToken()).toBeNull();
    });

    it("does not send CSRF requests or XSRF headers", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({
            message: "Login successful.",
            token: "no-csrf-token",
            user,
        }));

        await login({ email: user.email, password: "safe-test-password" });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).not.toContain("csrf-cookie");
        expect(new Headers(fetchMock.mock.calls[0][1].headers).has("X-XSRF-TOKEN")).toBe(false);
    });
});
