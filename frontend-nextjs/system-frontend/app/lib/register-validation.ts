import type { ValidationErrors } from "./auth-api";

export type RegistrationField = "name" | "email" | "password" | "password_confirmation";
export type RegistrationFieldErrors = Partial<Record<RegistrationField, string>>;

export function mapRegistrationErrors(
  errors: ValidationErrors | null | undefined,
): RegistrationFieldErrors {
  const mapped: RegistrationFieldErrors = {};

  if (!errors || typeof errors !== "object") return mapped;

  const fields: RegistrationField[] = [
    "name",
    "email",
    "password",
    "password_confirmation",
  ];

  for (const field of fields) {
    const messages: unknown = errors[field];

    if (!Array.isArray(messages)) continue;

    const message = messages.find(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    );

    if (message) mapped[field] = message;
  }

  return mapped;
}
