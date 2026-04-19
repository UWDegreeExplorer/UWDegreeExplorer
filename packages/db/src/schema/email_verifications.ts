import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const emailVerificationsTable = pgTable("email_verifications", {
  email: text("email").primaryKey(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  dailyCount: integer("daily_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  resetAt: timestamp("reset_at").notNull(),
  // For registration, we might need to store the pending user data JSON
  pendingUserData: text("pending_user_data"),
});
