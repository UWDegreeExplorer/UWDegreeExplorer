import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { z } from "zod";
import { requestVerificationCode, verifyCode } from "../lib/verification-service";

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

  // Check if this student email is already used by another verified account
  const existingVerified = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.studentEmail, email),
        eq(usersTable.isStudentVerified, true),
        ne(usersTable.id, userId) // Allow current user to retry/re-verify their own
      )
    )
    .limit(1);

  if (existingVerified.length > 0) {
    res.status(409).json({ 
      message: "This student email is already bound to another account." 
    });
    return;
  }

  const allowedDomains = ["@uwaterloo.ca", "@edu.uwaterloo.ca"];
  const isAllowed = allowedDomains.some(domain => email.endsWith(domain));

  if (!isAllowed) {
    res.status(400).json({ 
      message: "Only University of Waterloo emails (@uwaterloo.ca) are allowed for student verification." 
    });
    return;
  }

  const result = await requestVerificationCode(email);
  if (!result.success) {
    res.status(429).json({ message: result.message });
    return;
  }

  // Also update user's studentEmail field temporarily
  await db
    .update(usersTable)
    .set({ studentEmail: email })
    .where(eq(usersTable.id, userId));

  res.json({ message: result.message });
});

router.post("/verify-code", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user || !user.studentEmail) {
    res.status(400).json({ message: "No pending verification found." });
    return;
  }

  const parsed = VerifyCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid code format" });
    return;
  }

  const result = await verifyCode(user.studentEmail, parsed.data.code);
  if (!result.success) {
    res.status(400).json({ message: result.message });
    return;
  }

  await db
    .update(usersTable)
    .set({
      isStudentVerified: true,
      // No need to clear studentEmail, we want to keep it bound
    })
    .where(eq(usersTable.id, userId));

  res.json({ message: "Successfully verified" });
});

export default router;
