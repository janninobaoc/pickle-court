import { ApiCourt } from "../types/court";


export async function getCourts(): Promise<ApiCourt[]> {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!baseUrl) {
        throw new Error("API base URL is not defined in environment variables.");
    }

    const response = await fetch(`${baseUrl}/courts`, {
        method: "GET",
        credentials: "include",
        headers: {
            Accept: "application/json",
        },
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch courts (${response.status})`);
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
        throw new Error("Invalid courts response: expected an array.");
    }

    return data as ApiCourt[];
}

export async function getCourtById(id: string): Promise<ApiCourt | null> {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!baseUrl) {
        throw new Error("API base URL is not defined in environment variables.");
    }

    const response = await fetch(`${baseUrl}/courts/${id}`, {
        method: "GET",
        credentials: "include",
        headers: {
            Accept: "application/json",
        },
        cache: "no-store",
    });

    if (!response.ok) {
        if (response.status === 404) {
            return null;
        }

        throw new Error(`Failed to fetch court by ID (${response.status})`);
    }

    const data: unknown = await response.json();

    if (typeof data !== "object" || data === null) {
        throw new Error("Invalid court response: expected an object.");
    }

    return data as ApiCourt;
}

