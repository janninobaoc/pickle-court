export type Court = {
  id: string;
  name: string;
  description: string;
  category: "Indoor" | "Outdoor";
  pricePerHour: number;
  location: string;
  amenities: string[];
  operatingHours: string;
  openingTime: string;
  closingTime: string;
  operatingDays?: number[];
  artwork: "indoor" | "outdoor" | "championship";
  image?: string;
  available: boolean;
};

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

export type CreateAdminCourtPayload = {
    name: string;
    type: "Indoor" | "Outdoor";
    hourly_rate: number;
    status: "available" | "unavailable";
    description?: string | null;
    location?: string | null;
    amenities?: string[] | null;
    opening_time?: string | null;
    closing_time?: string | null;
    operating_days?: string[] | null;
    image?: string | null;
};

export type UpdateAdminCourtPayload = CreateAdminCourtPayload;

export type CreateAdminCourtResponse = {
    status: number;
    message: string;
};

export type UpdateAdminCourtResponse = {
    status: number;
    message: string;
    data: ApiCourt;
};
