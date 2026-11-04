import {
    clearAuthToken,
    getAuthToken,
    setAuthToken,
} from "./auth-token";

function getApiBaseUrl(): string {
    const configuredBaseUrl = (
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        process.env.NEXT_PUBLIC_API_URL ??
        "http://localhost:8000"
    ).replace(/\/+$/, "");

    return `${configuredBaseUrl.replace(/(?:\/api)+$/i, "")}/api`;
}

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    role: "admin" | "customer";
}

export interface AuthResponse {
    message: string;
    token: string;
    user: AuthUser;
}

export interface CurrentUserResponse {
    user: AuthUser;
}

export interface LogoutResponse {
    message: string;
}

export interface RegisterPayload {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
}

export interface LoginPayload {
    email: string;
    password: string;
}

export type ValidationErrors = Record<string, string[]>;

export class AuthApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public errors: ValidationErrors = {},
    ) {
        super(message);
        this.name = "AuthApiError";
    }
}

function authHeaders(headers?: HeadersInit): Headers {
    const result = new Headers(headers);
    result.set("Accept", "application/json");

    const token = getAuthToken();
    if (token) {
        result.set("Authorization", `Bearer ${token}`);
    } else {
        result.delete("Authorization");
    }

    return result;
}

function storeAuthResponse(data: unknown): AuthResponse {
    const response = data as AuthResponse | null;

    if (!response || typeof response.token !== "string" || response.token.length === 0) {
        throw new AuthApiError(500, "The authentication response was invalid.");
    }

    setAuthToken(response.token);
    return response;
}

export async function register(
    payload: RegisterPayload,
): Promise<AuthResponse> {
    const response = await fetch(`${getApiBaseUrl()}/register`, {
        method: "POST",
        credentials: "omit",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new AuthApiError(
            response.status,
            data?.message ?? "Registration failed. Please try again.",
            data?.errors ?? {},
        );
    }

    return storeAuthResponse(data);
}

export async function login(
    payload: LoginPayload,
): Promise<AuthResponse> {
    const response = await fetch(`${getApiBaseUrl()}/login`, {
        method: "POST",
        credentials: "omit",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const message = response.status === 401
            ? "Invalid email or password."
            : (data?.message ?? "Login failed. Please try again.");

        throw new AuthApiError(response.status, message, data?.errors ?? {});
    }

    return storeAuthResponse(data);
}

let currentUserRequest: Promise<AuthUser | null> | null = null;

export function invalidateCurrentUserRequest(): void {
    currentUserRequest = null;
}

export function getCurrentUser(): Promise<AuthUser | null> {
    if (!getAuthToken()) {
        invalidateCurrentUserRequest();
        return Promise.resolve(null);
    }

    if (currentUserRequest) {
        return currentUserRequest;
    }

    const request = (async (): Promise<AuthUser | null> => {
        const response = await fetch(`${getApiBaseUrl()}/user`, {
            method: "GET",
            credentials: "omit",
            headers: authHeaders(),
            cache: "no-store",
        });

        if (response.status === 401) {
            clearAuthToken();
            return null;
        }

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            throw new AuthApiError(
                response.status,
                data?.message ?? "Unable to check your authentication. Please try again.",
            );
        }

        return (data as CurrentUserResponse).user;
    })();

    const sharedRequest = request.finally(() => {
        if (currentUserRequest === sharedRequest) {
            currentUserRequest = null;
        }
    });
    currentUserRequest = sharedRequest;

    return sharedRequest;
}

export async function logout(): Promise<LogoutResponse> {
    const token = getAuthToken();

    if (!token) {
        clearAuthToken();
        throw new AuthApiError(401, "Your authentication could not be verified. Please log in again.");
    }

    let response: Response;

    try {
        response = await fetch(`${getApiBaseUrl()}/logout`, {
            method: "POST",
            credentials: "omit",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    } catch {
        throw new AuthApiError(
            0,
            "Server-side token revocation could not be confirmed because the request failed.",
        );
    } finally {
        clearAuthToken();
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const message = response.status === 401
            ? "Your authentication could not be verified. Please log in again."
            : (data?.message ?? "Logout failed. Please try again.");

        throw new AuthApiError(response.status, message);
    }

    return data as LogoutResponse;
}
