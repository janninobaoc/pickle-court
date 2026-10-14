import type { Court } from "../data/courts";
import { parseLocalDate, timeToMinutes } from "./booking-utils";
import { getSafeReturnTo } from "./auth-redirect";

export interface BookingSelectionParams {
    date?: unknown;
    start?: unknown;
    end?: unknown;
}

export interface RestoredBookingSelection {
    date: string;
    startTime: string;
    endTime: string;
    notice: string | null;
}

const selectionWarning =
    "Your previous booking selection is incomplete or no longer valid. Please choose a date and time again.";

function isValidTime(value: unknown): value is string {
    if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        return false;
    }

    return true;
}

function getStartSlots(court: Court): string[] {
    const openingMinutes = timeToMinutes(court.openingTime);
    const closingMinutes = timeToMinutes(court.closingTime);
    const slots: string[] = [];

    for (let minutes = openingMinutes; minutes < closingMinutes; minutes += 60) {
        const hour = Math.floor(minutes / 60).toString().padStart(2, "0");
        const minute = (minutes % 60).toString().padStart(2, "0");
        slots.push(`${hour}:${minute}`);
    }

    return slots;
}

export function restoreBookingSelection(
    params: BookingSelectionParams,
    court: Court,
    today?: string,
): RestoredBookingSelection {
    const hasAnyParameter = [params.date, params.start, params.end]
        .some((value) => value !== undefined);
    let invalidSelection = false;
    let date = "";
    let startTime = "";
    let endTime = "";

    if (params.date !== undefined) {
        const parsedDate = typeof params.date === "string"
            && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
            ? parseLocalDate(params.date)
            : null;

        const dateValue = params.date;
        if (
            !parsedDate ||
            (today !== undefined && typeof dateValue === "string" && dateValue < today)
        ) {
            invalidSelection = true;
        } else if (
            court.operatingDays &&
            !court.operatingDays.includes(parsedDate.getDay())
        ) {
            invalidSelection = true;
        } else {
            date = dateValue as string;
        }
    }

    const startSlots = getStartSlots(court);
    if (params.start !== undefined) {
        if (!date || !isValidTime(params.start) || !startSlots.includes(params.start)) {
            invalidSelection = true;
        } else {
            startTime = params.start;
        }
    }

    if (params.end !== undefined) {
        if (!date || !startTime || !isValidTime(params.end)) {
            invalidSelection = true;
        } else {
            const startMinutes = timeToMinutes(startTime);
            const endMinutes = timeToMinutes(params.end);
            const closingMinutes = timeToMinutes(court.closingTime);
            const allowedEndTimes: string[] = [];

            for (let minutes = startMinutes + 60; minutes < closingMinutes; minutes += 60) {
                const hour = Math.floor(minutes / 60).toString().padStart(2, "0");
                const minute = (minutes % 60).toString().padStart(2, "0");
                allowedEndTimes.push(`${hour}:${minute}`);
            }

            const closingHour = Math.floor(closingMinutes / 60).toString().padStart(2, "0");
            const closingMinute = (closingMinutes % 60).toString().padStart(2, "0");
            allowedEndTimes.push(`${closingHour}:${closingMinute}`);

            if (
                endMinutes <= startMinutes ||
                !allowedEndTimes.includes(params.end)
            ) {
                invalidSelection = true;
            } else {
                endTime = params.end;
            }
        }
    }

    return {
        date,
        startTime,
        endTime,
        notice: hasAnyParameter && invalidSelection ? selectionWarning : null,
    };
}

export function buildBookingReturnTo(
    pathname: string,
    date: string,
    startTime: string,
    endTime: string,
): string {
    const safePath = getSafeReturnTo(pathname);
    const query = new URLSearchParams({
        date,
        start: startTime,
        end: endTime,
    });

    return getSafeReturnTo(`${safePath}?${query.toString()}`);
}

export function buildLoginUrl(returnTo: string): string {
    const query = new URLSearchParams({ returnTo: getSafeReturnTo(returnTo) });
    return `/login?${query.toString()}`;
}
