import type { ApiCourt } from "../types/court";

export class AdminCourtsApiError extends Error {
    constructor(
        message: string,
        public readonly status: number
    ) {
        super(message);
        this.name = "AdminCourtsApiError";
    }
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