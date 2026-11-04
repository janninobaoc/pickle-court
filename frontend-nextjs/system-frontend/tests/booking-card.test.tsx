import { beforeEach, describe, expect, it, vi } from "vitest";
import BookingCard from "../app/components/booking-card";
import { BookingApiError, type Booking } from "../app/lib/booking-api";
import { CourtAvailabilityApiError, type CourtAvailability } from "../app/lib/court-availability-api";

const harness = vi.hoisted(() => ({
  stateValues: [] as unknown[],
  stateSetters: [] as ReturnType<typeof vi.fn>[],
  stateCursor: 0,
  refs: [] as Array<{ current: unknown }>,
  refCursor: 0,
  effects: [] as Array<() => unknown>,
  useState: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useRef: vi.fn(),
  routerReplace: vi.fn(),
  clearAuthenticatedUser: vi.fn(),
  getBookingRescheduleAvailability: vi.fn(),
  onCancel: vi.fn(),
  onReschedule: vi.fn(),
  onRefreshBookings: vi.fn(),
  authStatus: "authenticated" as "authenticated" | "unauthenticated" | "loading" | "error",
  user: { id: 7, name: "Test Customer", email: "customer@example.test", role: "customer" },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (...args: unknown[]) => harness.useState(...args),
    useEffect: (...args: unknown[]) => harness.useEffect(...args),
    useCallback: (...args: unknown[]) => harness.useCallback(...args),
    useRef: (...args: unknown[]) => harness.useRef(...args),
    useSyncExternalStore: () => "2026-10-20T12:00:00.000Z",
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: harness.routerReplace }),
}));

vi.mock("next/link", () => ({ default: vi.fn() }));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: harness.user,
    status: harness.authStatus,
    clearAuthenticatedUser: harness.clearAuthenticatedUser,
  }),
}));

vi.mock("../app/lib/booking-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../app/lib/booking-api")>();
  return { ...actual };
});

vi.mock("../app/lib/court-availability-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../app/lib/court-availability-api")>();
  return {
    ...actual,
    getBookingRescheduleAvailability: harness.getBookingRescheduleAvailability,
    findAvailableSlot: () => ({ start_time: "09:00:00", end_time: "10:00:00", available: true }),
    getAvailableEndTimes: () => ["10:00"],
  };
});

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
  court: {
    id: 17,
    name: "Central Court",
    type: "Indoor",
    hourly_rate: 400,
    opening_time: "08:00:00",
    closing_time: "22:00:00",
  },
};

const rescheduleDate = "2026-11-02";
const availability: CourtAvailability = {
  court_id: 17,
  date: rescheduleDate,
  court_status: "available",
  opening_time: "08:00:00",
  closing_time: "10:00:00",
  slot_duration_minutes: 60,
  reason: null,
  slots: [{ start_time: "09:00:00", end_time: "10:00:00", available: true }],
};

type TestElement = { type?: unknown; props?: Record<string, unknown> };

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
    if (element.props?.children !== undefined) pending.push(element.props.children);
  }
  return null;
}

function textOf(root: unknown): string {
  if (typeof root === "string" || typeof root === "number") return String(root);
  if (Array.isArray(root)) return root.map(textOf).join(" ");
  if (!root || typeof root !== "object") return "";
  return textOf((root as TestElement).props?.children);
}

function renderCard(options: {
  cancelError?: BookingApiError | null;
  rescheduleError?: BookingApiError | null;
  rescheduleOpen?: boolean;
  rescheduleDate?: string;
  availabilityState?: { date: string; status: "idle" | "loading" | "success" | "error"; data?: CourtAvailability; error?: CourtAvailabilityApiError };
} = {}) {
  const defaults: unknown[] = [
    false,
    false,
    null,
    false,
    booking.booking_date,
    "09:00",
    "10:00",
    {},
    null,
    { date: "", status: "idle" },
  ];
  if (options.cancelError !== undefined) defaults[2] = options.cancelError;
  if (options.rescheduleOpen !== undefined) defaults[3] = options.rescheduleOpen;
  if (options.rescheduleDate !== undefined) defaults[4] = options.rescheduleDate;
  if (options.rescheduleError !== undefined) defaults[8] = options.rescheduleError;
  if (options.availabilityState !== undefined) defaults[9] = options.availabilityState;

  harness.stateValues = defaults;
  harness.stateCursor = 0;
  harness.refCursor = 0;
  harness.effects = [];
  const tree = BookingCard({
    booking,
    now: new Date("2026-10-20T12:00:00.000Z"),
    canCancel: true,
    isCancelling: false,
    canReschedule: true,
    isRescheduling: false,
    onCancel: harness.onCancel,
    onReschedule: harness.onReschedule,
    onRefreshBookings: harness.onRefreshBookings,
  });
  return tree;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function getRescheduleSubmitHandler(tree: unknown) {
  const form = findElement(tree, (element) => typeof element.props?.onSubmit === "function");
  if (!form) throw new Error("Reschedule form submit handler was not found.");
  return form.props?.onSubmit as (event: { preventDefault: () => void }) => Promise<void>;
}

describe("BookingCard bearer authentication error handling", () => {
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
      const setter = vi.fn((next: unknown) => {
        harness.stateValues[index] = typeof next === "function"
          ? (next as (previous: unknown) => unknown)(harness.stateValues[index])
          : next;
      });
      harness.stateSetters[index] = setter;
      return [harness.stateValues[index] ?? initial, setter];
    });
    harness.useEffect.mockImplementation((effect: () => unknown) => {
      harness.effects.push(effect);
    });
    harness.useCallback.mockImplementation((callback: unknown) => callback);
    harness.useRef.mockImplementation((initial: unknown) => {
      const index = harness.refCursor++;
      if (!harness.refs[index]) harness.refs[index] = { current: initial };
      return harness.refs[index];
    });
    harness.getBookingRescheduleAvailability.mockResolvedValue(availability);
    harness.onCancel.mockResolvedValue(null);
    harness.onReschedule.mockResolvedValue(null);
  });

  it("shows generic cancellation and rescheduling feedback for 419 without retry labels", () => {
    const tree = renderCard({
      cancelError: new BookingApiError(419, "Unable to cancel this booking right now. Please try again."),
      rescheduleOpen: true,
      rescheduleDate,
      rescheduleError: new BookingApiError(419, "Unable to reschedule this booking right now. Please try again."),
      availabilityState: { date: rescheduleDate, status: "success", data: availability },
    });
    const text = textOf(tree);

    expect(text).toContain("Unable to cancel this booking right now. Please try again.");
    expect(text).toContain("Unable to reschedule this booking right now. Please try again.");
    expect(text).toContain("Yes, Cancel Booking");
    expect(text).toContain("Confirm Reschedule");
    expect(text).not.toMatch(/retry cancellation|retry reschedule|retry the cancellation|retry the reschedule|session expired/i);
    expect(harness.clearAuthenticatedUser).not.toHaveBeenCalled();
    expect(harness.routerReplace).not.toHaveBeenCalled();
  });

  it("preserves the availability 401 authentication clearing and login redirect", async () => {
    harness.getBookingRescheduleAvailability.mockRejectedValue(
      new CourtAvailabilityApiError(401, "Please log in to book a court."),
    );
    renderCard({ rescheduleOpen: true, rescheduleDate });
    harness.effects.forEach((effect) => { void effect(); });
    await flushPromises();

    expect(harness.clearAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(harness.routerReplace).toHaveBeenCalledWith("/login?returnTo=%2Fbookings");
  });

  it("keeps 403 reschedule errors as operation feedback without login navigation", async () => {
    const error = new BookingApiError(403, "You may not reschedule this booking.");
    harness.onReschedule.mockResolvedValue(error);
    const tree = renderCard({
      rescheduleOpen: true,
      rescheduleDate,
      availabilityState: { date: rescheduleDate, status: "success", data: availability },
    });

    await getRescheduleSubmitHandler(tree)({ preventDefault: vi.fn() });

    expect(harness.stateValues[8]).toBe(error);
    expect(harness.clearAuthenticatedUser).not.toHaveBeenCalled();
    expect(harness.routerReplace).not.toHaveBeenCalled();
  });

  it("refreshes availability after a 409 conflict", async () => {
    harness.onReschedule.mockResolvedValue(new BookingApiError(409, "This booking conflicts with availability."));
    const tree = renderCard({
      rescheduleOpen: true,
      rescheduleDate,
      availabilityState: { date: rescheduleDate, status: "success", data: availability },
    });

    await getRescheduleSubmitHandler(tree)({ preventDefault: vi.fn() });
    await flushPromises();

    expect(harness.getBookingRescheduleAvailability).toHaveBeenCalledWith(booking.id, rescheduleDate, expect.any(AbortSignal));
  });

  it("preserves 422 field validation messages", async () => {
    const errors = { booking_date: ["Choose another date."] };
    harness.onReschedule.mockResolvedValue(new BookingApiError(422, "Please check the booking details.", errors));
    const tree = renderCard({
      rescheduleOpen: true,
      rescheduleDate,
      availabilityState: { date: rescheduleDate, status: "success", data: availability },
    });

    await getRescheduleSubmitHandler(tree)({ preventDefault: vi.fn() });

    expect(harness.stateValues[7]).toEqual({ booking_date: "Choose another date." });
    expect(harness.stateValues[8]).toBeInstanceOf(BookingApiError);
    expect(harness.clearAuthenticatedUser).not.toHaveBeenCalled();
    expect(harness.routerReplace).not.toHaveBeenCalled();
  });

  it("keeps normal cancel and reschedule controls and successful actions", async () => {
    const tree = renderCard({
      rescheduleOpen: true,
      rescheduleDate,
      availabilityState: { date: rescheduleDate, status: "success", data: availability },
    });
    const cancelButton = findElement(tree, (element) => element.props?.children === "Yes, Cancel Booking");
    const rescheduleForm = getRescheduleSubmitHandler(tree);

    expect(textOf(tree)).toContain("Cancel Booking");
    expect(textOf(tree)).toContain("Reschedule");
    await (cancelButton?.props?.onClick as () => Promise<void>)();
    expect(harness.onCancel).toHaveBeenCalledWith(booking);
    expect(harness.stateValues[1]).toBe(false);

    await rescheduleForm({ preventDefault: vi.fn() });
    expect(harness.onReschedule).toHaveBeenCalledWith(booking, {
      booking_date: rescheduleDate,
      start_time: "09:00",
      end_time: "10:00",
    });
    expect(harness.stateValues[3]).toBe(false);
  });

  it("keeps the standard availability retry action available", async () => {
    const tree = renderCard({
      rescheduleOpen: true,
      rescheduleDate,
      availabilityState: {
        date: rescheduleDate,
        status: "error",
        error: new CourtAvailabilityApiError(500, "Unable to load court availability. Please try again."),
      },
    });
    const retryButton = findElement(tree, (element) => element.props?.children === "Retry availability");

    expect(retryButton).not.toBeNull();
    await (retryButton?.props?.onClick as () => void)();
    await flushPromises();
    expect(harness.getBookingRescheduleAvailability).toHaveBeenCalledWith(booking.id, rescheduleDate, expect.any(AbortSignal));
  });

  it("preserves booking refresh actions for 404 operation errors", () => {
    const tree = renderCard({
      cancelError: new BookingApiError(404, "The booking could not be found."),
      rescheduleOpen: true,
      rescheduleDate,
      rescheduleError: new BookingApiError(404, "The booking could not be found."),
    });
    const refresh = findElement(tree, (element) => element.props?.children === "Refresh bookings");

    expect(refresh).not.toBeNull();
    (refresh?.props?.onClick as () => void)();
    expect(harness.onRefreshBookings).toHaveBeenCalledTimes(1);
  });
});
