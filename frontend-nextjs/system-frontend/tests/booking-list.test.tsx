import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingApiError, type Booking } from "../app/lib/booking-api";
import BookingList from "../app/components/booking-list";

const harness = vi.hoisted(() => ({
  stateValues: [] as unknown[],
  stateSetters: [] as ReturnType<typeof vi.fn>[],
  stateCursor: 0,
  refs: [] as Array<{ current: unknown }>,
  refCursor: 0,
  effects: [] as Array<() => unknown>,
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  routerReplace: vi.fn(),
  clearAuthenticatedUser: vi.fn(),
  refreshUser: vi.fn(),
  getMyBookings: vi.fn(),
  cancelBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  authStatus: "authenticated" as "authenticated" | "unauthenticated" | "loading" | "error",
  user: { id: 7, name: "Test Customer", email: "customer@example.test", role: "customer" },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (...args: unknown[]) => harness.useState(...args),
    useEffect: (...args: unknown[]) => harness.useEffect(...args),
    useRef: (...args: unknown[]) => harness.useRef(...args),
    useSyncExternalStore: () => "2026-10-20T12:00:00.000Z",
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: harness.routerReplace }),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: harness.user,
    status: harness.authStatus,
    clearAuthenticatedUser: harness.clearAuthenticatedUser,
    refreshUser: harness.refreshUser,
  }),
}));

vi.mock("../app/lib/booking-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../app/lib/booking-api")>();
  return {
    ...actual,
    getMyBookings: harness.getMyBookings,
    cancelBooking: harness.cancelBooking,
    rescheduleBooking: harness.rescheduleBooking,
  };
});

vi.mock("sonner", () => ({
  toast: { error: harness.toastError, success: harness.toastSuccess },
}));

const booking: Booking = {
  id: 31,
  user_id: 7,
  court_id: 17,
  booking_date: "2026-11-01",
  start_time: "09:00:00",
  end_time: "10:00:00",
  status: "pending",
  total_amount: "400.00",
  created_at: null,
  updated_at: null,
  court: { id: 17, name: "Central Court", type: "Indoor", hourly_rate: 400 },
};

type TestElement = {
  type?: unknown;
  props?: Record<string, unknown>;
};

function findElement(root: unknown, predicate: (element: TestElement) => boolean): TestElement | null {
  const pending = [root];
  while (pending.length > 0) {
    const child = pending.pop();
    if (Array.isArray(child)) {
      pending.push(...child);
      continue;
    }
    if (!child || typeof child !== "object") continue;
    const element = child as TestElement;
    if (predicate(element)) return element;
    const children = element.props?.children;
    if (children !== undefined) pending.push(children);
  }
  return null;
}

function collectText(root: unknown): string {
  if (typeof root === "string" || typeof root === "number") return String(root);
  if (Array.isArray(root)) return root.map(collectText).join(" ");
  if (!root || typeof root !== "object") return "";
  return collectText((root as TestElement).props?.children);
}

function renderList(runEffects = false) {
  harness.stateCursor = 0;
  harness.refCursor = 0;
  harness.effects = [];
  const tree = BookingList();
  if (runEffects) harness.effects.forEach((effect) => { void effect(); });
  return tree;
}

function renderWithBookings() {
  harness.stateValues[5] = { userId: 7, items: [booking] };
  const tree = renderList();
  harness.refs[3].current = true;
  return tree;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function getBookingCardCallbacks(tree: unknown) {
  const card = findElement(tree, (element) => typeof element.props?.onCancel === "function");
  if (!card?.props) throw new Error("Booking card callbacks were not found.");
  return card.props as {
    onCancel: (item: Booking) => Promise<BookingApiError | null>;
    onReschedule: (item: Booking, payload: { booking_date: string; start_time: string; end_time: string }) => Promise<BookingApiError | null>;
  };
}

describe("BookingList bearer authentication error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.stateValues = [];
    harness.stateSetters = [];
    harness.stateCursor = 0;
    harness.refs = [];
    harness.refCursor = 0;
    harness.effects = [];
    harness.authStatus = "authenticated";
    harness.user = { id: 7, name: "Test Customer", email: "customer@example.test", role: "customer" };
    harness.useState.mockImplementation((initial: unknown) => {
      const index = harness.stateCursor++;
      if (harness.stateValues[index] === undefined) {
        harness.stateValues[index] = typeof initial === "function"
          ? (initial as () => unknown)()
          : initial;
      }
      const setter = vi.fn((next: unknown) => {
        harness.stateValues[index] = typeof next === "function"
          ? (next as (previous: unknown) => unknown)(harness.stateValues[index])
          : next;
      });
      harness.stateSetters[index] = setter;
      return [harness.stateValues[index], setter];
    });
    harness.useEffect.mockImplementation((effect: () => unknown) => {
      harness.effects.push(effect);
    });
    harness.useRef.mockImplementation((initial: unknown) => {
      const index = harness.refCursor++;
      if (!harness.refs[index]) harness.refs[index] = { current: initial };
      return harness.refs[index];
    });
    harness.clearAuthenticatedUser.mockImplementation(() => {
      harness.authStatus = "unauthenticated";
    });
    harness.getMyBookings.mockResolvedValue([booking]);
    harness.cancelBooking.mockResolvedValue({ message: "Booking cancelled.", data: { ...booking, status: "cancelled" } });
    harness.rescheduleBooking.mockResolvedValue({ message: "Booking rescheduled.", data: { ...booking, booking_date: "2026-11-02" } });
  });

  it("uses the generic booking-list heading and retry action after a 419", async () => {
    harness.getMyBookings.mockRejectedValue(
      new BookingApiError(419, "Unable to load your bookings. Please try again."),
    );

    renderList(true);
    await flushPromises();
    const tree = renderList();

    expect(collectText(tree)).toMatch(/couldn.t load your bookings/i);
    expect(collectText(tree)).not.toMatch(/session expired/i);
    const retry = findElement(tree, (element) => element.props?.children === "Retry" && typeof element.props?.onClick === "function");
    expect(retry).not.toBeNull();
    (retry?.props?.onClick as () => void)();
    expect(harness.stateValues[2]).toBe(1);
    expect(harness.clearAuthenticatedUser).not.toHaveBeenCalled();
    expect(harness.routerReplace).not.toHaveBeenCalled();
  });

  it("clears authentication after a booking-list 401 and redirects when auth becomes unauthenticated", async () => {
    harness.getMyBookings.mockRejectedValue(new BookingApiError(401, "Please log in to book a court."));

    renderList(true);
    await flushPromises();

    expect(harness.clearAuthenticatedUser).toHaveBeenCalledTimes(1);
    renderList(true);
    expect(harness.routerReplace).toHaveBeenCalledWith("/login?returnTo=%2Fbookings");
  });

  it("preserves successful booking-list loading", async () => {
    renderList(true);
    await flushPromises();

    expect(harness.stateValues[5]).toEqual({ userId: 7, items: [booking] });
  });

  it("keeps 403 cancellation failures as operation errors without login navigation", async () => {
    const callbacks = getBookingCardCallbacks(renderWithBookings());
    harness.cancelBooking.mockRejectedValue(new BookingApiError(403, "You may not cancel this booking."));

    await callbacks.onCancel(booking);

    expect(harness.toastError).toHaveBeenCalledWith("You may not cancel this booking.", { id: "booking-cancel-error-31" });
    expect(harness.clearAuthenticatedUser).not.toHaveBeenCalled();
    expect(harness.routerReplace).not.toHaveBeenCalled();
  });

  it("preserves successful cancellation and rescheduling outcomes", async () => {
    const callbacks = getBookingCardCallbacks(renderWithBookings());

    await callbacks.onCancel(booking);
    expect(harness.stateValues[5]).toEqual({ userId: 7, items: [{ ...booking, status: "cancelled" }] });
    expect(harness.toastSuccess).toHaveBeenCalledWith("Booking cancelled.", { id: "booking-cancelled-31" });

    harness.stateValues[5] = { userId: 7, items: [booking] };
    await callbacks.onReschedule(booking, {
      booking_date: "2026-11-02",
      start_time: "09:00:00",
      end_time: "10:00:00",
    });
    expect(harness.stateValues[5]).toEqual({ userId: 7, items: [{ ...booking, booking_date: "2026-11-02" }] });
    expect(harness.toastSuccess).toHaveBeenCalledWith("Booking rescheduled.", { id: "booking-rescheduled-31" });
  });

  it("clears authentication and navigates to login for a rescheduling 401", async () => {
    const callbacks = getBookingCardCallbacks(renderWithBookings());
    harness.rescheduleBooking.mockRejectedValue(new BookingApiError(401, "Please log in to book a court."));

    await callbacks.onReschedule(booking, {
      booking_date: "2026-11-02",
      start_time: "09:00:00",
      end_time: "10:00:00",
    });

    expect(harness.clearAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(harness.routerReplace).toHaveBeenCalledWith("/login?returnTo=%2Fbookings");
  });

  it("refreshes the booking list after a rescheduling 404", async () => {
    const callbacks = getBookingCardCallbacks(renderWithBookings());
    harness.rescheduleBooking.mockRejectedValue(new BookingApiError(404, "The booking could not be found."));

    await callbacks.onReschedule(booking, {
      booking_date: "2026-11-02",
      start_time: "09:00:00",
      end_time: "10:00:00",
    });

    expect(harness.stateValues[2]).toBe(1);
    expect(harness.toastError).toHaveBeenCalledWith("The booking could not be found.", { id: "booking-reschedule-error-31" });
  });

  it.each([409, 422])("keeps rescheduling %i responses as operation errors", async (status) => {
    const callbacks = getBookingCardCallbacks(renderWithBookings());
    const message = status === 409 ? "This booking conflicts with availability." : "Please check the booking details.";
    harness.rescheduleBooking.mockRejectedValue(new BookingApiError(status, message));

    await callbacks.onReschedule(booking, {
      booking_date: "2026-11-02",
      start_time: "09:00:00",
      end_time: "10:00:00",
    });

    expect(harness.toastError).toHaveBeenCalledWith(message, { id: "booking-reschedule-error-31" });
    expect(harness.clearAuthenticatedUser).not.toHaveBeenCalled();
    expect(harness.routerReplace).not.toHaveBeenCalled();
  });
});
