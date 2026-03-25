import { describe, it, expect } from "vitest";
import { isDefaultUsername, cn } from "./utils";

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

describe("cn", () => {
  it("merges basic class names", () => {
    expect(cn("class1", "class2")).toBe("class1 class2");
  });

  it("handles conditional classes", () => {
    expect(cn("class1", { class2: true, class3: false })).toBe("class1 class2");
  });

  it("merges conflicting Tailwind classes using twMerge", () => {
    // twMerge will override px-2 with px-4
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    // twMerge will override bg-red-500 with bg-blue-500
    expect(cn("bg-red-500 text-white", "bg-blue-500")).toBe("text-white bg-blue-500");
  });

  it("handles arrays and nested arrays", () => {
    expect(cn(["class1", "class2"], "class3")).toBe("class1 class2 class3");
    expect(cn(["class1", ["class2", "class3"]])).toBe("class1 class2 class3");
  });

  it("ignores null, undefined, and boolean values", () => {
    expect(cn("class1", null, undefined, false, true, "class2")).toBe("class1 class2");
  });
});
