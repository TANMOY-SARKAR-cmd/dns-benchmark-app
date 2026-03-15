/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export * from "./_core/errors";

export interface InsertUser {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date | string | null;
  role?: string | null;
}
