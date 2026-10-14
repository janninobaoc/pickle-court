import { describe, expect, it } from "vitest";
import { DEFAULT_AUTH_REDIRECT, getSafeReturnTo } from "../app/lib/auth-redirect";

describe("getSafeReturnTo", () => {
    it("allows an internal booking path", () => {
        expect(getSafeReturnTo("/courts/1/book")).toBe("/courts/1/book");
    });

    it("uses the default when returnTo is missing or not a string", () => {
        expect(getSafeReturnTo(undefined)).toBe(DEFAULT_AUTH_REDIRECT);
        expect(getSafeReturnTo(["/courts/1/book"])).toBe(DEFAULT_AUTH_REDIRECT);
    });

    it.each([
        "https://evil.example/path",
        "//evil.example/path",
        "/\\evil.example/path",
        "/%2F%2Fevil.example/path",
        "/courts/1/book%0Aheader",
        "/courts/%ZZ/book",
        "/login",
        "/register",
        "/LOGIN/",
        "/register?from=login",
    ])("rejects unsafe or looping destination %s", (value) => {
        expect(getSafeReturnTo(value)).toBe(DEFAULT_AUTH_REDIRECT);
    });

    it("preserves a safe internal query string and hash", () => {
        expect(getSafeReturnTo("/courts/1/book?date=2026-10-15&start=09%3A00#schedule"))
            .toBe("/courts/1/book?date=2026-10-15&start=09%3A00#schedule");
    });
});
