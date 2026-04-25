import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  studentEmail: text("student_email"),
  isStudentVerified: boolean("is_student_verified").notNull().default(false),
  verificationCode: text("verification_code"),
  verificationCodeExpiresAt: timestamp("verification_code_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  loginAttempts: integer("login_attempts").notNull().default(0),
  lockoutUntil: timestamp("lockout_until", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  blockedReason: text("blocked_reason"),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
