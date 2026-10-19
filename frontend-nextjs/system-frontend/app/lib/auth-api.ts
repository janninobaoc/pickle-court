
const API_BASE_URL = (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000/api"
).replace(/\/+$/, "");

const BACKEND_ORIGIN = new URL(API_BASE_URL).origin;

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    role: "admin" | "customer";
}

export interface AuthResponse {
    message: string;
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

function getXsrfToken(): string {
    const cookie = document.cookie
        .split("; ")
        .find((item) => item.startsWith("XSRF-TOKEN="));

    if (!cookie) {
        throw new Error(
            "CSRF cookie was not received. Please refresh the page and try again.",
        );
    }

    return decodeURIComponent(cookie.substring("XSRF-TOKEN=".length));
}

async function initializeCsrf(): Promise<void> {
    const response = await fetch(
        `${BACKEND_ORIGIN}/sanctum/csrf-cookie`,
        {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json",
            },
        },
    );

    if (!response.ok) {
        throw new AuthApiError(
            response.status,
            response.status === 419
                ? "Your session expired. Please refresh the page and try again."
                : "Unable to initialize a secure session. Please try again.",
        );
    }
}

export async function register(
    payload: RegisterPayload,
): Promise<AuthResponse> {
    await initializeCsrf();

    const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        credentials: "include",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": getXsrfToken(),
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new AuthApiError(
            response.status,
            data?.message ??
            (response.status === 419
                ? "Your session expired. Please refresh the page and try again."
                : (data?.message ?? "Registration failed. Please try again.")),
            data?.errors ?? {},
        );
    }

    return data as AuthResponse;
}


export async function login(
    payload: LoginPayload,
): Promise<AuthResponse> {
    await initializeCsrf();

    const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        credentials: "include",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": getXsrfToken(),
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            response.status === 419
                ? "Your session expired. Please refresh the page and try again."
                : response.status === 401
                    ? "Invalid email or password."
                    : (data?.message ?? "Login failed. Please try again.");

        throw new AuthApiError(
            response.status,
            message,
            data?.errors ?? {},
        );
    }

    return data as AuthResponse;
}


let currentUserRequest: Promise<AuthUser | null> | null = null;

export function invalidateCurrentUserRequest(): void {
    currentUserRequest = null;
}

export function getCurrentUser(): Promise<AuthUser | null> {
    if (currentUserRequest) {
        return currentUserRequest;
    }

    const request = (async (): Promise<AuthUser | null> => {
        const response = await fetch(`${API_BASE_URL}/user`, {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json",
            },
            cache: "no-store",
        });

        if (response.status === 401) {
            return null;
        }

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            throw new AuthApiError(
                response.status,
                data?.message ??
                "Unable to check your session. Please try again.",
            );
        }

        return (data as CurrentUserResponse).user;
    })();

    let sharedRequest: Promise<AuthUser | null>;
    sharedRequest = request.finally(() => {
        if (currentUserRequest === sharedRequest) {
            currentUserRequest = null;
        }
    });
    currentUserRequest = sharedRequest;

    return sharedRequest;
}


export async function logout(): Promise<LogoutResponse> {
    await initializeCsrf();

    const response = await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": getXsrfToken(),
        },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            response.status === 419
                ? "Your session expired. Please refresh the page and try again."
                : response.status === 401
                    ? "Your session could not be verified. Please refresh the page."
                    : (data?.message ?? "Logout failed. Please try again.");

        throw new AuthApiError(response.status, message);
    }

    return data as LogoutResponse;
}



