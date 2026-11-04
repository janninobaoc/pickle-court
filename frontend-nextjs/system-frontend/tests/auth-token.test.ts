import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAuthToken, getAuthToken, setAuthToken } from "../app/lib/auth-token";

describe("in-memory auth token", () => {
  beforeEach(() => {
    clearAuthToken();
  });

  afterEach(() => {
    clearAuthToken();
  });

  it("starts with no token", () => {
    expect(getAuthToken()).toBeNull();
  });

  it("returns a token after it is set", () => {
    setAuthToken("first-token");

    expect(getAuthToken()).toBe("first-token");
  });

  it("replaces a previously set token", () => {
    setAuthToken("first-token");
    setAuthToken("replacement-token");

    expect(getAuthToken()).toBe("replacement-token");
  });

  it("clears the token", () => {
    setAuthToken("first-token");
    clearAuthToken();

    expect(getAuthToken()).toBeNull();
  });
});
