
import type { ApiCourt } from "../types/court";
import type { Court } from "../data/courts";

export type MappedCourt = Court;

const weekdayNumbers: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
};

export function mapOperatingDays(operatingDays: string[] | null): number[] {
    if (!operatingDays) {
        return [];
    }

    return operatingDays.flatMap((day) => {
        const weekdayNumber = weekdayNumbers[day.trim().toLowerCase()];
        return weekdayNumber === undefined ? [] : [weekdayNumber];
    });
}

function mapOperatingTime(time: string | null): string {
    if (!time) {
        return "";
    }

    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
    if (!match) {
        return "";
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = match[3] === undefined ? 0 : Number(match[3]);
    return hours <= 23 && minutes <= 59 && seconds <= 59 ? `${match[1]}:${match[2]}` : "";
}

function formatOperatingTime(time: string): string {
    if (!time) {
        return "";
    }

    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatOperatingDays(days: number[]): string {
    const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days.map((day) => names[day]).join(", ");
}

export function mapApiCourt(apiCourt: ApiCourt): Court {
    // Normalize the court type
    const category = apiCourt.type.trim().toLowerCase();

    if (category !== "indoor" && category !== "outdoor") {
        throw new Error(`Unsupported court type: ${apiCourt.type}`);
    }

    // Validate the hourly rate

    const rawRate: unknown = apiCourt.hourly_rate;

    if (typeof rawRate !== "string" && typeof rawRate !== "number") {
        throw new Error(`Invalid hourly rate for court ${apiCourt.id}`);
    }

    if (typeof rawRate === "string") {
        const decimalPattern = /^\d+(\.\d{1,2})?$/;

        if (!decimalPattern.test(rawRate.trim())) {
            throw new Error(`Invalid hourly rate format for court ${apiCourt.id}`);
        }
    }

    const pricePerHour = Number(rawRate);

    if (!Number.isFinite(pricePerHour) || pricePerHour < 0) {
        throw new Error(`Invalid hourly rate for court ${apiCourt.id}`);
    }


    // Normalize and validate availability
    const status = apiCourt.status.trim().toLowerCase();

    if (status !== "available" && status !== "unavailable") {
        throw new Error(`Unsupported court status: ${apiCourt.status}`);
    }

    const operatingDays = mapOperatingDays(apiCourt.operating_days);
    const openingTime = mapOperatingTime(apiCourt.opening_time);
    const closingTime = mapOperatingTime(apiCourt.closing_time);
    const formattedOpeningTime = formatOperatingTime(openingTime);
    const formattedClosingTime = formatOperatingTime(closingTime);
    const operatingHours = formattedOpeningTime && formattedClosingTime
        ? `${operatingDays.length > 0 ? `${formatOperatingDays(operatingDays)} · ` : "Operating days not specified · "}${formattedOpeningTime}–${formattedClosingTime}`
        : "Operating hours not provided";

    return {
        id: String(apiCourt.id),
        name: apiCourt.name,
        description: apiCourt.description ?? "",
        category: category === "indoor" ? "Indoor" : "Outdoor",
        pricePerHour,
        available: status === "available",
        location: apiCourt.location?.trim() || "Location not provided",
        amenities: apiCourt.amenities ? [...apiCourt.amenities] : [],
        operatingHours,
        openingTime,
        closingTime,
        // An empty list preserves the fact that no usable operating days are configured.
        operatingDays,
        artwork: category === "indoor" ? "indoor" : "outdoor",
        // Laravel image paths are not assumed to be served by Next.js. Leaving this unset
        // deliberately uses CourtImage's existing category artwork fallback.
        image: undefined,
    };
}
