import { describe, expect, it } from "vitest";
import type { AuthUser } from "../app/lib/auth-api";

const customerUser = {
    id: 1,
    name: "Court Customer",
    email: "customer@example.test",
    role: "customer",
} satisfies AuthUser;

const adminUser = {
    id: 2,
    name: "Court Administrator",
    email: "admin@example.test",
    role: "admin",
} satisfies AuthUser;

describe("authenticated user role contract", () => {
    it("accepts a customer user response", () => {
        expect(customerUser).toMatchObject({
            id: 1,
            name: "Court Customer",
            email: "customer@example.test",
            role: "customer",
        });
    });

    it("accepts an administrator user response", () => {
        expect(adminUser).toMatchObject({
            id: 2,
            name: "Court Administrator",
            email: "admin@example.test",
            role: "admin",
        });
    });
});
