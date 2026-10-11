import { describe, expect, it } from "vitest";
import { mapRegistrationErrors } from "../app/lib/register-validation";

describe("mapRegistrationErrors", () => {
  it("maps Laravel field errors to their registration fields", () => {
    expect(mapRegistrationErrors({
      name: ["The name field is required."],
      email: ["This email address is already registered."],
      password: ["The password field must be at least 8 characters."],
      password_confirmation: ["Please confirm your password."],
    })).toEqual({
      name: "The name field is required.",
      email: "This email address is already registered.",
      password: "The password field must be at least 8 characters.",
      password_confirmation: "Please confirm your password.",
    });
  });

  it("ignores unknown keys and empty or non-string messages", () => {
    const malformedErrors = {
      name: ["", "  ", "Valid name error"],
      email: [],
      password: [null, 12],
      password_confirmation: "not-an-array",
      role: ["Raw role key must not be displayed"],
    } as unknown as Record<string, string[]>;

    expect(mapRegistrationErrors(malformedErrors)).toEqual({
      name: "Valid name error",
    });
  });

  it("returns no field errors for a missing or empty validation payload", () => {
    expect(mapRegistrationErrors(null)).toEqual({});
    expect(mapRegistrationErrors({})).toEqual({});
  });
});
