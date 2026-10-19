import type { ApiCourt } from "../types/court";
import { mapApiCourt } from "./court-mapper";
import type { Court } from "../data/courts";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
    return value === null || typeof value === "string";
}

function isStringArrayOrNull(value: unknown): value is string[] | null {
    return value === null || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

function isUsableAvailableCourt(value: unknown): value is ApiCourt {
    return isRecord(value) &&
        Number.isSafeInteger(value.id) && Number(value.id) > 0 &&
        typeof value.name === "string" && value.name.trim().length > 0 &&
        typeof value.type === "string" &&
        (typeof value.hourly_rate === "string" || typeof value.hourly_rate === "number") &&
        value.status === "available" &&
        isStringOrNull(value.description) &&
        isStringOrNull(value.location) &&
        isStringArrayOrNull(value.amenities) &&
        isStringOrNull(value.opening_time) &&
        isStringOrNull(value.closing_time) &&
        isStringArrayOrNull(value.operating_days) &&
        isStringOrNull(value.image) &&
        isStringOrNull(value.created_at) &&
        isStringOrNull(value.updated_at);
}

/** Selects the first mappable, exactly-available backend courts without reordering them. */
export function selectFeaturedCourts(records: unknown, limit = 3): Court[] {
    if (!Array.isArray(records) || !Number.isSafeInteger(limit) || limit <= 0) return [];

    const selected: Court[] = [];
    for (const record of records) {
        if (!isUsableAvailableCourt(record)) continue;
        try {
            const court = mapApiCourt(record);
            if (court.available) selected.push(court);
        } catch {
            // A malformed or unsupported court should not make other featured courts disappear.
        }
        if (selected.length === limit) break;
    }

    return selected;
}
