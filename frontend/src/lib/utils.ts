import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks if a username is a default fallback username (e.g. user_a1b2c3)
 * @param username The username to check
 * @returns boolean indicating if it's a default username
 */
export function isDefaultUsername(username?: string | null): boolean {
  if (!username) return true;
  return /^user_[a-f0-9]{6}$/i.test(username);
}
