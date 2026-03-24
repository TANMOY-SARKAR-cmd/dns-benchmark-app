import { describe, it, expect } from "vitest";
import { isDefaultUsername } from "./utils";

describe("isDefaultUsername", () => {
  it("returns true for null or undefined", () => {
    expect(isDefaultUsername(null)).toBe(true);
    expect(isDefaultUsername(undefined)).toBe(true);
    expect(isDefaultUsername("")).toBe(true);
  });

  it("returns true for default user_XXXXXX format", () => {
    expect(isDefaultUsername("user_a1b2c3")).toBe(true);
    expect(isDefaultUsername("user_000000")).toBe(true);
    expect(isDefaultUsername("user_ffffff")).toBe(true);
    expect(isDefaultUsername("USER_ABC123")).toBe(true);
  });

  it("returns false for non-default usernames", () => {
    expect(isDefaultUsername("johndoe")).toBe(false);
    expect(isDefaultUsername("user123")).toBe(false);
    expect(isDefaultUsername("user_")).toBe(false);
    expect(isDefaultUsername("user_abc")).toBe(false);
    expect(isDefaultUsername("user_abcdefg")).toBe(false);
    expect(isDefaultUsername("user_abc12z")).toBe(false); // z is not hex
    expect(isDefaultUsername("my_user_a1b2c3")).toBe(false);
  });
});
