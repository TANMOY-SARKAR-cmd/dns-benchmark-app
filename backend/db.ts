import { InsertUser } from "../shared/types";
import { ENV } from "./_core/env";
import { supabase } from "../shared/supabaseClient";

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const values: any = {
    openId: user.openId,
  };

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field as keyof InsertUser];
    if (value !== undefined) {
      values[field] = value ?? null;
    }
  };

  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
  } else {
    values.lastSignedIn = new Date().toISOString();
  }

  if (user.role !== undefined) {
    values.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
  }

  const { error } = await supabase
    .from("users")
    .upsert(values, { onConflict: "openId" });
  if (error) {
    console.error("[Database] Failed to upsert user:", error);
  }
}

export async function getUserByOpenId(openId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("openId", openId)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is no rows returned
    console.error("[Database] Failed to get user:", error);
  }

  return data || undefined;
}
