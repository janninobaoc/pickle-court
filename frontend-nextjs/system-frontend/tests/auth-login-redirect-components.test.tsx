import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginForm from "../app/components/login-form";
import RegisterForm from "../app/components/register-form";
import GuestGuard from "../app/components/auth/guest-guard";
import { useLogout } from "../app/hooks/use-logout";

const harness = vi.hoisted(() => ({
  stateOverrides: [] as unknown[],
  stateCursor: 0,
  useState: vi.fn(),
  useCallback: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  replace: vi.fn(),
  setAuthenticatedUser: vi.fn(),
  clearAuthenticatedUser: vi.fn(),
  setLogoutRedirectPending: vi.fn(),
  refreshUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  AuthApiError: class AuthApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
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
    useCallback: (...args: unknown[]) => harness.useCallback(...args),
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
    clearAuthenticatedUser: harness.clearAuthenticatedUser,
    refreshUser: harness.refreshUser,
    setLogoutRedirectPending: harness.setLogoutRedirectPending,
  }),
}));

vi.mock("@/app/lib/auth-api", () => ({
  AuthApiError: harness.AuthApiError,
  login: harness.login,
  register: harness.register,
  logout: harness.logout,
}));

vi.mock("@/app/lib/register-validation", () => ({
  mapRegistrationErrors: () => ({}),
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

function getRegisterSubmitHandler(returnTo?: string) {
  const element = RegisterForm(returnTo ? { returnTo } : {}) as unknown as {
    props: { children: { props: { onSubmit: (event: unknown) => Promise<void> } } };
  };
  return element.props.children.props.onSubmit;
}

async function submitLogin(role: TestUser["role"], returnTo?: string | string[]) {
  const user = makeUser(role);
  harness.login.mockResolvedValue({ message: "Logged in", token: "test-token", user });
  await getLoginSubmitHandler(returnTo)({ preventDefault: vi.fn() });
  return user;
}

async function submitRegistration(returnTo?: string) {
  const user = makeUser("customer");
  harness.register.mockResolvedValue({ message: "Registered", token: "test-token", user });
  await getRegisterSubmitHandler(returnTo)({ preventDefault: vi.fn() });
  return user;
}

describe("login and guest guard role-aware redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.stateOverrides = [false, {}, "player@example.test", "valid-password", false];
    harness.stateCursor = 0;
    harness.auth.status = "unauthenticated";
    harness.auth.user = null;
    harness.useCallback.mockImplementation((callback: unknown) => callback);

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

  it("sets the registered user in auth state after registration succeeds", async () => {
    harness.stateOverrides = [false, {}, "Court Customer", "customer@example.test", "valid-password", "valid-password", false];
    harness.stateCursor = 0;

    const user = await submitRegistration("/courts");

    expect(harness.register).toHaveBeenCalledTimes(1);
    expect(harness.setAuthenticatedUser).toHaveBeenCalledWith(user);
    expect(harness.register.mock.invocationCallOrder[0])
      .toBeLessThan(harness.setAuthenticatedUser.mock.invocationCallOrder[0]);
    expect(harness.replace).toHaveBeenCalledWith("/courts");
  });

  it("clears auth state after logout succeeds", async () => {
    harness.auth.status = "authenticated";
    harness.auth.user = makeUser("customer");
    harness.stateOverrides = [false];
    harness.stateCursor = 0;
    harness.logout.mockResolvedValue({ message: "Logout successful." });

    const { handleLogout } = useLogout();

    await expect(handleLogout()).resolves.toBe(true);

    expect(harness.clearAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(harness.setLogoutRedirectPending).toHaveBeenCalledWith(true);
    expect(harness.replace).toHaveBeenCalledWith("/login");
  });

  it("clears auth state when logout reports an invalid or revoked token", async () => {
    harness.auth.status = "authenticated";
    harness.auth.user = makeUser("customer");
    harness.stateOverrides = [false];
    harness.stateCursor = 0;
    harness.logout.mockRejectedValue(new harness.AuthApiError(401, "Unauthenticated."));

    const { handleLogout } = useLogout();

    await expect(handleLogout()).resolves.toBe(true);

    expect(harness.clearAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(harness.replace).toHaveBeenCalledWith("/login");
  });

  it("handles a forbidden logout response without showing a session error", async () => {
    harness.auth.status = "authenticated";
    harness.auth.user = makeUser("customer");
    harness.stateOverrides = [false];
    harness.stateCursor = 0;
    harness.logout.mockRejectedValue(new harness.AuthApiError(403, "Forbidden."));

    const { handleLogout } = useLogout();

    await expect(handleLogout()).resolves.toBe(true);

    expect(harness.toastError).toHaveBeenCalledWith(
      "You were signed out locally, but the server denied the logout request.",
    );
    expect(harness.clearAuthenticatedUser).toHaveBeenCalledTimes(1);
  });

  it("clears local auth and navigates after logout network failure without claiming revocation", async () => {
    harness.auth.status = "authenticated";
    harness.auth.user = makeUser("customer");
    harness.stateOverrides = [false];
    harness.stateCursor = 0;
    harness.logout.mockRejectedValue(new harness.AuthApiError(0, "Network failure."));

    const { handleLogout } = useLogout();

    await expect(handleLogout()).resolves.toBe(true);

    expect(harness.toastError).toHaveBeenCalledWith(
      "You were signed out locally, but server-side token revocation could not be confirmed. Please check your connection.",
    );
    expect(harness.clearAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(harness.replace).toHaveBeenCalledWith("/login");
    expect(harness.replace).not.toHaveBeenCalledWith(expect.stringContaining("token"));
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
