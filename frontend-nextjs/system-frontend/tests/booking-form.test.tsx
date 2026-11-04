import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthToken, getAuthToken, setAuthToken } from "../app/lib/auth-token";
import BookingForm from "../app/components/booking-form";
import type { Court } from "../app/data/courts";
import { buildBookingReturnTo, buildLoginUrl } from "../app/lib/booking-selection";

const harness = vi.hoisted(() => ({
  stateValues: [] as unknown[],
  stateSetters: [] as ReturnType<typeof vi.fn>[],
  stateCursor: 0,
  useState: vi.fn(),
  useCallback: vi.fn(),
  useEffect: vi.fn(),
  useMemo: vi.fn(),
  useRef: vi.fn(),
  push: vi.fn(),
  clearAuthenticatedUser: vi.fn(),
  refreshUser: vi.fn(),
  createBooking: vi.fn(),
  getCourtAvailability: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  authStatus: "authenticated" as "authenticated" | "unauthenticated" | "loading" | "error",
  BookingApiError: class BookingApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
      public readonly errors: Record<string, string[]> = {},
    ) {
      super(message);
    }
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (...args: unknown[]) => harness.useState(...args),
    useCallback: (...args: unknown[]) => harness.useCallback(...args),
    useEffect: (...args: unknown[]) => harness.useEffect(...args),
    useMemo: (...args: unknown[]) => harness.useMemo(...args),
    useRef: (...args: unknown[]) => harness.useRef(...args),
    useSyncExternalStore: () => "2026-10-01",
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/courts/17/book",
  useRouter: () => ({ push: harness.push }),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    status: harness.authStatus,
    clearAuthenticatedUser: harness.clearAuthenticatedUser,
    refreshUser: harness.refreshUser,
  }),
}));

vi.mock("../app/lib/booking-api", () => ({
  BookingApiError: harness.BookingApiError,
  createBooking: harness.createBooking,
}));

vi.mock("../app/lib/court-availability-api", () => ({
  CourtAvailabilityApiError: class CourtAvailabilityApiError extends Error {
    constructor(public readonly status: number, message: string) {
      super(message);
    }
  },
  findAvailableSlot: () => ({ start_time: "09:00:00", end_time: "10:00:00", available: true }),
  getAvailableEndTimes: () => ["10:00"],
  getAvailableStartTimes: () => ["09:00"],
  getCourtAvailability: harness.getCourtAvailability,
  getNoSlotsMessage: () => "No slots are available.",
}));

vi.mock("sonner", () => ({
  toast: {
    error: harness.toastError,
    info: harness.toastInfo,
    success: harness.toastSuccess,
    warning: harness.toastWarning,
  },
}));

const court: Court = {
  id: "17",
  name: "Central Court",
  description: "A test court",
  category: "Indoor",
  pricePerHour: 400,
  location: "Makati City",
  amenities: [],
  operatingHours: "Daily, 9:00 AM - 11:00 AM",
  openingTime: "09:00",
  closingTime: "11:00",
  artwork: "indoor",
  available: true,
};

const date = "2026-10-15";
const availability = {
  court_id: 17,
  date,
  court_status: "available",
  opening_time: "09:00:00",
  closing_time: "10:00:00",
  slot_duration_minutes: 60,
  reason: null,
  slots: [{ start_time: "09:00:00", end_time: "10:00:00", available: true }],
};

function getSubmitHandler() {
  const root = BookingForm({ court, selectionParams: { date, start: "09:00", end: "10:00" } }) as unknown as {
    props: { children: unknown };
  };
  const pending = [root.props.children];
  while (pending.length > 0) {
    const child = pending.pop();
    if (Array.isArray(child)) {
      pending.push(...child);
      continue;
    }
    const element = child as { type?: unknown; props?: { children?: unknown; onSubmit?: unknown } };
    if (element?.type === "form") {
      return element.props?.onSubmit as (event: { preventDefault: () => void }) => Promise<void>;
    }
    const children = element?.props?.children;
    if (Array.isArray(children)) pending.push(...children);
    else if (children && typeof children === "object") pending.push(children);
  }
  throw new Error("Booking form submit handler was not found.");
}

async function submitBooking() {
  await getSubmitHandler()({ preventDefault: vi.fn() });
}

describe("BookingForm bearer authentication error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthToken();
    harness.stateValues = [
      date,
      "09:00",
      "10:00",
      null,
      false,
      null,
      {},
      false,
      false,
      { date, status: "success", data: availability },
    ];
    harness.stateSetters = [];
    harness.stateCursor = 0;
    harness.authStatus = "authenticated";
    harness.useState.mockImplementation((initial: unknown) => {
      const index = harness.stateCursor++;
      const setter = vi.fn();
      harness.stateSetters[index] = setter;
      return [index < harness.stateValues.length ? harness.stateValues[index] : initial, setter];
    });
    harness.useCallback.mockImplementation((callback: unknown) => callback);
    harness.useEffect.mockImplementation(() => undefined);
    harness.useMemo.mockImplementation((callback: () => unknown) => callback());
    harness.useRef.mockImplementation((initial: unknown) => ({ current: initial }));
    harness.clearAuthenticatedUser.mockImplementation(() => clearAuthToken());
    harness.getCourtAvailability.mockResolvedValue(availability);
  });

  it("clears auth state and the in-memory token before safe login navigation after 401", async () => {
    setAuthToken("expired-test-token");
    harness.createBooking.mockRejectedValue(new harness.BookingApiError(401, "Unauthenticated."));

    await submitBooking();

    const expectedReturnTo = buildBookingReturnTo("/courts/17/book", date, "09:00", "10:00");
    expect(harness.clearAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(getAuthToken()).toBeNull();
    expect(harness.push).toHaveBeenCalledWith(buildLoginUrl(expectedReturnTo));
    expect(harness.clearAuthenticatedUser.mock.invocationCallOrder[0])
      .toBeLessThan(harness.push.mock.invocationCallOrder[0]);
  });

  it("keeps auth state and does not redirect after 403", async () => {
    setAuthToken("still-valid-test-token");
    harness.createBooking.mockRejectedValue(new harness.BookingApiError(403, "You may not book this court."));

    await submitBooking();

    expect(harness.clearAuthenticatedUser).not.toHaveBeenCalled();
    expect(getAuthToken()).toBe("still-valid-test-token");
    expect(harness.push).not.toHaveBeenCalled();
    expect(harness.toastError).toHaveBeenCalledWith("You may not book this court.");
  });

  it("uses generic operation feedback for 419 without session-expired messaging", async () => {
    harness.createBooking.mockRejectedValue(
      new harness.BookingApiError(419, "Unable to process your booking. Please try again."),
    );

    await submitBooking();

    expect(harness.toastError).toHaveBeenCalledWith("Unable to process your booking. Please try again.");
    expect(harness.toastError.mock.calls.flat().join(" ")).not.toMatch(/session expired|csrf/i);
    expect(harness.clearAuthenticatedUser).not.toHaveBeenCalled();
    expect(harness.push).not.toHaveBeenCalled();
  });

  it("preserves field validation feedback for 422", async () => {
    const errors = { booking_date: ["The booking date is invalid."] };
    harness.createBooking.mockRejectedValue(
      new harness.BookingApiError(422, "The given data was invalid.", errors),
    );

    await submitBooking();

    expect(harness.stateSetters[6]).toHaveBeenCalledWith(errors);
    expect(harness.toastError).toHaveBeenCalledWith("Please review the highlighted booking details.");
    expect(harness.push).not.toHaveBeenCalled();
  });

  it("preserves conflict feedback and refreshes availability after 409", async () => {
    harness.createBooking.mockRejectedValue(new harness.BookingApiError(409, "That time is no longer available."));

    await submitBooking();

    expect(harness.toastWarning).toHaveBeenCalledWith("That time is no longer available.");
    expect(harness.getCourtAvailability).toHaveBeenCalledWith(17, date, expect.any(AbortSignal));
    expect(harness.push).not.toHaveBeenCalled();
  });

  it("preserves successful booking feedback and result state", async () => {
    const booking = { id: 32, status: "pending" };
    harness.createBooking.mockResolvedValue({ data: booking });

    await submitBooking();

    expect(harness.stateSetters[5]).toHaveBeenCalledWith(booking);
    expect(harness.toastSuccess).toHaveBeenCalledWith("Your booking has been submitted successfully!");
    expect(harness.push).not.toHaveBeenCalled();
  });
});
