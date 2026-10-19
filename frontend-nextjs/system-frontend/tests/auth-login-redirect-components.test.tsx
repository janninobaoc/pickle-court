import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginForm from "../app/components/login-form";
import GuestGuard from "../app/components/auth/guest-guard";

const harness = vi.hoisted(() => ({
  stateOverrides: [] as unknown[],
  stateCursor: 0,
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  replace: vi.fn(),
  setAuthenticatedUser: vi.fn(),
  refreshUser: vi.fn(),
  login: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  auth: {
    status: "unauthenticated" as "authenticated" | "unauthenticated" | "loading" | "error",
    user: null as null | { id: number; name: string; email: string; role: "admin" | "customer" },
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (...args: unknown[]) => harness.useState(...args),
    useEffect: (...args: unknown[]) => harness.useEffect(...args),
    useRef: (...args: unknown[]) => harness.useRef(...args),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: harness.replace, refresh: vi.fn() }),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    ...harness.auth,
    setAuthenticatedUser: harness.setAuthenticatedUser,
    refreshUser: harness.refreshUser,
  }),
}));

vi.mock("@/app/lib/auth-api", () => ({
  AuthApiError: class AuthApiError extends Error {},
  login: harness.login,
}));

vi.mock("sonner", () => ({
  toast: { success: harness.toastSuccess, error: harness.toastError },
}));

vi.mock("@/app/lib/auth-redirect", async () =>
  import("../app/lib/auth-redirect")
);

type TestUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "customer";
};

function makeUser(role: TestUser["role"]): TestUser {
  return {
    id: role === "admin" ? 2 : 1,
    name: role === "admin" ? "Court Administrator" : "Court Customer",
    email: `${role}@example.test`,
    role,
  };
}

function getLoginSubmitHandler(returnTo?: string | string[]) {
  const element = LoginForm(returnTo ? { returnTo } : {}) as unknown as {
    props: { children: { props: { onSubmit: (event: unknown) => Promise<void> } } };
  };
  return element.props.children.props.onSubmit;
}

async function submitLogin(role: TestUser["role"], returnTo?: string | string[]) {
  const user = makeUser(role);
  harness.login.mockResolvedValue({ message: "Logged in", user });
  await getLoginSubmitHandler(returnTo)({ preventDefault: vi.fn() });
  return user;
}

describe("login and guest guard role-aware redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.stateOverrides = [false, {}, "player@example.test", "valid-password", false];
    harness.stateCursor = 0;
    harness.auth.status = "unauthenticated";
    harness.auth.user = null;

    harness.useState.mockImplementation((initial: unknown) => {
      const index = harness.stateCursor++;
      const value = index < harness.stateOverrides.length
        ? harness.stateOverrides[index]
        : initial;
      return [value, vi.fn()];
    });
    harness.useEffect.mockImplementation((effect: () => void) => effect());
    harness.useRef.mockImplementation((initial: unknown) => ({ current: initial }));
  });

  it.each([
    ["admin", undefined, "/admin"],
    ["customer", undefined, "/courts"],
    ["admin", "/admin/courts", "/admin/courts"],
    ["customer", "/admin", "/courts"],
    ["admin", "https://evil.example/path", "/admin"],
    ["customer", "https://evil.example/path", "/courts"],
  ] as const)("logs in a %s to the role-safe destination for %s", async (role, returnTo, expectedPath) => {
    const user = await submitLogin(role, returnTo);

    expect(harness.replace).toHaveBeenCalledTimes(1);
    expect(harness.replace).toHaveBeenCalledWith(expectedPath);
    expect(harness.setAuthenticatedUser).toHaveBeenCalledWith(user);
    expect(harness.setAuthenticatedUser.mock.invocationCallOrder[0])
      .toBeLessThan(harness.replace.mock.invocationCallOrder[0]);
  });

  it.each([
    ["admin", "/admin"],
    ["customer", "/courts"],
  ] as const)("redirects an already-authenticated %s from the guest page", (role, expectedPath) => {
    harness.auth.status = "authenticated";
    harness.auth.user = makeUser(role);

    GuestGuard({ children: "Guest content", returnTo: undefined });

    expect(harness.replace).toHaveBeenCalledTimes(1);
    expect(harness.replace).toHaveBeenCalledWith(expectedPath);
  });
});
