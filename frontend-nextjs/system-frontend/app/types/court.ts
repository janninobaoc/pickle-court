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