import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../contexts/auth-context";
import { clearAuthToken, getAuthToken, setAuthToken } from "../app/lib/auth-token";

const harness = vi.hoisted(() => ({
    stateSetters: [] as ReturnType<typeof vi.fn>[],
    useState: vi.fn(),
    useCallback: vi.fn(),
    useEffect: vi.fn(),
    useRef: vi.fn(),
    getCurrentUser: vi.fn(),
    invalidateCurrentUserRequest: vi.fn(),
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

vi.mock("@/app/lib/auth-api", () => ({
    getCurrentUser: harness.getCurrentUser,
    invalidateCurrentUserRequest: harness.invalidateCurrentUserRequest,
}));

vi.mock("@/app/lib/auth-token", async () => import("../app/lib/auth-token"));

describe("bearer-token authentication context", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        clearAuthToken();
        fetchMock.mockReset();
        harness.getCurrentUser.mockResolvedValue(null);
        harness.stateSetters = [];
        harness.useState.mockImplementation((initial: unknown) => {
            const setter = vi.fn();
            harness.stateSetters.push(setter);
            return [initial, setter];
        });
        harness.useCallback.mockImplementation((callback: unknown) => callback);
        harness.useEffect.mockImplementation((effect: () => void) => effect());
        harness.useRef.mockImplementation((initial: unknown) => ({ current: initial }));
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        clearAuthToken();
        vi.unstubAllGlobals();
    });

    it("initializes as unauthenticated after a reload with no in-memory token", async () => {
        AuthProvider({ children: null });

        expect(harness.getCurrentUser).toHaveBeenCalledTimes(1);
        await vi.waitFor(() => {
            expect(harness.stateSetters[1]).toHaveBeenCalledWith("unauthenticated");
        });

        expect(getAuthToken()).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("clears the in-memory token and user state when auth is cleared", () => {
        setAuthToken("context-test-token");
        const provider = AuthProvider({ children: null }) as unknown as {
            props: {
                value: {
                    clearAuthenticatedUser: () => void;
                };
            };
        };

        provider.props.value.clearAuthenticatedUser();

        expect(getAuthToken()).toBeNull();
        expect(harness.stateSetters[0]).toHaveBeenCalledWith(null);
        expect(harness.stateSetters[1]).toHaveBeenCalledWith("unauthenticated");
    });
});
