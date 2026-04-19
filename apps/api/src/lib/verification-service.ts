import { db, emailVerificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendVerificationEmail } from "./email";
import crypto from "crypto";
import { logger } from "./logger";

export async function requestVerificationCode(email: string, pendingUserData?: any): Promise<{ success: boolean; message: string }> {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // 1. Get existing attempt
  let [attempt] = await db
    .select()
    .from(emailVerificationsTable)
    .where(eq(emailVerificationsTable.email, email))
    .limit(1);

  // 2. Check daily limit and cool-down
  if (attempt) {
    // Reset daily count if reset_at is passed
    if (attempt.resetAt < now) {
      await db
        .update(emailVerificationsTable)
        .set({ dailyCount: 0, resetAt: tomorrow })
        .where(eq(emailVerificationsTable.email, email));
      attempt.dailyCount = 0;
    }

    if (attempt.dailyCount >= 5) {
      return { success: false, message: "Daily verification limit reached (5 per day). Please try again tomorrow." };
    }

    if (attempt.lastAttemptAt && attempt.lastAttemptAt > fiveMinutesAgo) {
      const waitSeconds = Math.ceil((attempt.lastAttemptAt.getTime() + 5 * 60 * 1000 - now.getTime()) / 1000);
      return { success: false, message: `Please wait ${waitSeconds} seconds before requesting another code.` };
    }
  }

  // 3. Generate code
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

  // 4. Update or Insert
  if (attempt) {
    await db
      .update(emailVerificationsTable)
      .set({
        code,
        expiresAt,
        dailyCount: attempt.dailyCount + 1,
        lastAttemptAt: now,
        pendingUserData: pendingUserData ? JSON.stringify(pendingUserData) : null,
      })
      .where(eq(emailVerificationsTable.email, email));
  } else {
    await db
      .insert(emailVerificationsTable)
      .values({
        email,
        code,
        expiresAt,
        dailyCount: 1,
        lastAttemptAt: now,
        resetAt: tomorrow,
        pendingUserData: pendingUserData ? JSON.stringify(pendingUserData) : null,
      });
  }

  // 5. Send Email
  try {
    await sendVerificationEmail(email, code);
    return { success: true, message: "Verification code sent." };
  } catch (err) {
    logger.error({ err, email }, "Failed to send verification email");
    return { success: false, message: "Failed to send email. Please try again later." };
  }
}

export async function verifyCode(email: string, code: string): Promise<{ success: boolean; message: string; pendingUserData?: any }> {
  const [attempt] = await db
    .select()
    .from(emailVerificationsTable)
    .where(eq(emailVerificationsTable.email, email))
    .limit(1);

  if (!attempt || attempt.code !== code || attempt.expiresAt < new Date()) {
    return { success: false, message: "Invalid or expired verification code." };
  }

  // Clear the code after successful verification (optional, but safer)
  await db
    .update(emailVerificationsTable)
    .set({ code: "", expiresAt: new Date(0) })
    .where(eq(emailVerificationsTable.email, email));

  return { 
    success: true, 
    message: "Verified.", 
    pendingUserData: attempt.pendingUserData ? JSON.parse(attempt.pendingUserData) : null 
  };
}
