export const DEFAULT_AUTH_REDIRECT = "/courts";

const INTERNAL_ORIGIN = "https://picklecourt.invalid";
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

/** Return a safe same-origin path for post-authentication navigation. */
export function getSafeReturnTo(value: unknown): string {
    if (
        typeof value !== "string" ||
        !value.startsWith("/") ||
        value.startsWith("//") ||
        value.includes("\\") ||
        CONTROL_CHARACTERS.test(value)
    ) {
        return DEFAULT_AUTH_REDIRECT;
    }

    let decodedValue: string;
    let destination: URL;

    try {
        decodedValue = decodeURIComponent(value);
        destination = new URL(value, INTERNAL_ORIGIN);
    } catch {
        return DEFAULT_AUTH_REDIRECT;
    }

    if (
        decodedValue.startsWith("//") ||
        decodedValue.includes("\\") ||
        CONTROL_CHARACTERS.test(decodedValue) ||
        destination.origin !== INTERNAL_ORIGIN ||
        destination.username !== "" ||
        destination.password !== ""
    ) {
        return DEFAULT_AUTH_REDIRECT;
    }

    let decodedPath: string;
    try {
        decodedPath = decodeURIComponent(destination.pathname);
    } catch {
        return DEFAULT_AUTH_REDIRECT;
    }

    if (decodedPath.includes("\\") || CONTROL_CHARACTERS.test(decodedPath)) {
        return DEFAULT_AUTH_REDIRECT;
    }

    const normalizedPath = decodedPath.replace(/\/+$/, "").toLowerCase() || "/";
    if (normalizedPath === "/login" || normalizedPath === "/register") {
        return DEFAULT_AUTH_REDIRECT;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
}
