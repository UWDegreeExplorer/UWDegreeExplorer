import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendVerificationEmail } from "../lib/email";

const router: IRouter = Router();

const SendCodeBody = z.object({
  email: z.string().email(),
});

const VerifyCodeBody = z.object({
  code: z.string().length(6),
});

router.post("/send-code", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = SendCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid email" });
    return;
  }

  const { email } = parsed.data;

  // Validate domain
  if (!email.endsWith("@uwaterloo.ca")) {
    res.status(400).json({ message: "Only @uwaterloo.ca emails are allowed." });
    return;
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db
    .update(usersTable)
    .set({
      verificationCode: code,
      verificationCodeExpiresAt: expiresAt,
      studentEmail: email, // Store the email temporarily, will be fully bound on verify
    })
    .where(eq(usersTable.id, userId));

  await sendVerificationEmail(email, code);

  res.json({ message: "Verification code sent" });
});

router.post("/verify-code", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = VerifyCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid code format" });
    return;
  }

  const { code } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  if (
    !user.verificationCode ||
    user.verificationCode !== code ||
    !user.verificationCodeExpiresAt ||
    user.verificationCodeExpiresAt < new Date()
  ) {
    res.status(400).json({ message: "Invalid or expired verification code" });
    return;
  }

  await db
    .update(usersTable)
    .set({
      isStudentVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
    })
    .where(eq(usersTable.id, userId));

  res.json({ message: "Successfully verified" });
});

export default router;
