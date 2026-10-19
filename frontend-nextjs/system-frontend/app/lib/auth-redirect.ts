export const DEFAULT_AUTH_REDIRECT = "/courts";
import type { AuthUser } from "@/app/lib/auth-api";

const INTERNAL_ORIGIN = "https://picklecourt.invalid";
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

/** Return a safe same-origin path for post-authentication navigation. */
export function getSafeReturnTo(
    returnTo: unknown,
    fallback = DEFAULT_AUTH_REDIRECT
): string {
    if (typeof returnTo !== "string") {
        return fallback;
    }

    let decodedValue: string;
    let destination: URL;

    try {
        decodedValue = decodeURIComponent(returnTo);
        destination = new URL(returnTo, INTERNAL_ORIGIN);
    } catch {
        return fallback;
    }

    if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
        return fallback;
    }

    if (
        decodedValue.startsWith("//") ||
        decodedValue.includes("\\") ||
        CONTROL_CHARACTERS.test(decodedValue) ||
        destination.origin !== INTERNAL_ORIGIN ||
        destination.username !== "" ||
        destination.password !== ""
    ) {
        return fallback;
    }

    let decodedPath: string;
    try {
        decodedPath = decodeURIComponent(destination.pathname);
    } catch {
        return fallback;
    }

    if (decodedPath.includes("\\") || CONTROL_CHARACTERS.test(decodedPath)) {
        return fallback;
    }

    const normalizedPath = decodedPath.replace(/\/+$/, "").toLowerCase() || "/";
    if (normalizedPath === "/login" || normalizedPath === "/register") {
        return fallback;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
}

export function getRoleAwareAuthRedirect(
    returnTo: unknown,
    role: AuthUser["role"]
): string {
    const fallback = role === "admin" ? "/admin" : "/courts";

    const destination = getSafeReturnTo(returnTo, fallback);

    if (role === "admin") {
        return destination;
    }

    const pathname = new URL(destination, "http://localhost").pathname;

    let decodedPathname: string;

    try {
        decodedPathname = decodeURIComponent(pathname);
    } catch {
        return fallback;
    }

    if (
        decodedPathname === "/admin" ||
        decodedPathname.startsWith("/admin/")
    ) {
        return "/courts";
    }

    return destination;
}
