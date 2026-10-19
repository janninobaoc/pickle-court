import type {
    ApiCourt,
    CreateAdminCourtPayload,
    CreateAdminCourtResponse,
} from "../types/court";
import { fetchWithCsrf, type ValidationErrors } from "./auth-api";

export class AdminCourtsApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly errors: ValidationErrors = {},
    ) {
        super(message);
        this.name = "AdminCourtsApiError";
    }
}

function isValidationErrors(value: unknown): value is ValidationErrors {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    return Object.values(value as Record<string, unknown>).every(
        (fieldErrors) =>
            Array.isArray(fieldErrors) &&
            fieldErrors.every((message) => typeof message === "string"),
    );
}

export async function getAdminCourts(): Promise<ApiCourt[]> {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!baseUrl) {
        throw new Error("API base URL is not defined in environment variables.");
    }

    const response = await fetch(`${baseUrl}/admin/courts`, {
        method: "GET",
        credentials: "include",
        headers: {
            Accept: "application/json",
        },
        cache: "no-store",
    });

    if (!response.ok) {
        throw new AdminCourtsApiError(
            `Failed to fetch admin courts (${response.status})`,
            response.status
        );
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
        throw new Error("Invalid admin courts response: expected an array.");
    }

    return data as ApiCourt[];
}

export async function createAdminCourt(
    payload: CreateAdminCourtPayload,
): Promise<CreateAdminCourtResponse> {
    const response = await fetchWithCsrf("/admin/courts", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const responseBody =
            body !== null && typeof body === "object" && !Array.isArray(body)
                ? (body as { message?: unknown; errors?: unknown })
                : null;

        const responseMessage = responseBody?.message;
        const message =
            typeof responseMessage === "string" && responseMessage.trim().length > 0
                ? responseMessage
                : `Failed to create admin court (${response.status})`;

        const errors =
            response.status === 422 && isValidationErrors(responseBody?.errors)
                ? responseBody.errors
                : {};

        throw new AdminCourtsApiError(message, response.status, errors);
    }

    let data: unknown;

    try {
        data = await response.json();
    } catch {
        throw new AdminCourtsApiError(
            `Invalid court creation response (${response.status})`,
            response.status,
        );
    }

    if (data === null || typeof data !== "object" || Array.isArray(data)) {
        throw new AdminCourtsApiError(
            `Invalid court creation response (${response.status})`,
            response.status,
        );
    }

    const responseBody = data as Record<string, unknown>;

    if (
        typeof responseBody.status !== "number" ||
        typeof responseBody.message !== "string"
    ) {
        throw new AdminCourtsApiError(
            `Invalid court creation response (${response.status})`,
            response.status,
        );
    }

    return {
        status: responseBody.status,
        message: responseBody.message,
    };
}
