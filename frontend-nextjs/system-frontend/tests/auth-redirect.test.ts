import { describe, expect, it } from "vitest";
import {
    DEFAULT_AUTH_REDIRECT,
    getRoleAwareAuthRedirect,
    getSafeReturnTo,
} from "../app/lib/auth-redirect";

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

    it("preserves the existing default fallback for missing and unsafe destinations", () => {
        expect(getSafeReturnTo(undefined)).toBe("/courts");
        expect(getSafeReturnTo("https://evil.example/path")).toBe("/courts");
        expect(getSafeReturnTo("//evil.example/path")).toBe("/courts");
    });

    it("uses a supplied fallback for relative destinations", () => {
        expect(getSafeReturnTo("courts", "/admin")).toBe("/admin");
    });
});

describe("getRoleAwareAuthRedirect", () => {
    it("uses the role-specific default when returnTo is missing", () => {
        expect(getRoleAwareAuthRedirect(undefined, "admin")).toBe("/admin");
        expect(getRoleAwareAuthRedirect(undefined, "customer")).toBe("/courts");
    });

    it("uses the administrator fallback for external, relative, and protocol-relative URLs", () => {
        expect(getRoleAwareAuthRedirect("https://evil.com", "admin")).toBe("/admin");
        expect(getRoleAwareAuthRedirect("courts", "admin")).toBe("/admin");
        expect(getRoleAwareAuthRedirect("//evil.com", "admin")).toBe("/admin");
    });

    it("preserves a valid normalized destination for an administrator", () => {
        expect(getRoleAwareAuthRedirect("/foo/../courts", "admin")).toBe("/courts");
    });

    it("blocks encoded and literal admin destinations for customers", () => {
        expect(getRoleAwareAuthRedirect("/%61dmin", "customer")).toBe("/courts");
        expect(getRoleAwareAuthRedirect("/admin/courts", "customer")).toBe("/courts");
    });

    it("preserves admin destinations for administrators", () => {
        expect(getRoleAwareAuthRedirect("/admin/courts", "admin")).toBe("/admin/courts");
    });

    it("preserves an explicit public courts destination for administrators", () => {
        expect(getRoleAwareAuthRedirect("/courts", "admin")).toBe("/courts");
    });

    it("does not treat a similarly named public route as an admin route", () => {
        expect(getRoleAwareAuthRedirect("/administrator", "customer")).toBe("/administrator");
    });

    it("uses the administrator fallback for malformed and unsafe URLs", () => {
        expect(getRoleAwareAuthRedirect("/courts/%ZZ", "admin")).toBe("/admin");
        expect(getRoleAwareAuthRedirect("/\\evil.com", "admin")).toBe("/admin");
    });
});
