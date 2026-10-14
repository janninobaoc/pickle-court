
export type ApiCourt = {
    id: number;
    name: string;
    type: string;
    description: string | null;
    hourly_rate: string | number;
    status: string;

    // Additional court details
    location: string | null;
    amenities: string[] | null;
    opening_time: string | null;
    closing_time: string | null;
    operating_days: string[] | null;
    image: string | null;

    // Laravel timestamps
    created_at: string | null;
    updated_at: string | null;
};


export async function getCourts(): Promise<ApiCourt[]> {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!baseUrl) {
        throw new Error("API base URL is not configured");
    }

    const response = await fetch(`${baseUrl}/courts`, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch courts: ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
        throw new Error("Invalid courts response");
    }

    return payload as ApiCourt[];
}

export async function getCourtById(id: string): Promise<ApiCourt | null> {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!baseUrl) {
        throw new Error("API base URL is not configured");
    }

    const response = await fetch(`${baseUrl}/courts/${id}`, {
        cache: "no-store",
    });

    if (!response.ok) {
        if (response.status === 404) {
            return null; // Court not found
        }
        throw new Error(`Failed to fetch court with ID ${id}: ${response.status}`);
    }

    const court: ApiCourt = await response.json();

    return court;
}

