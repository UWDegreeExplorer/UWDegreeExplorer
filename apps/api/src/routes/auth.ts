import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import {
  RegisterUserBody,
  LoginUserBody,
  GoogleLoginBody,
  UpdateCurrentUserBody,
} from "@workspace/api-zod";
import { OAuth2Client } from "google-auth-library";
import { requestVerificationCode, verifyCode } from "../lib/verification-service";
import { emailVerificationsTable } from "@workspace/db";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyRecaptcha(token: string | undefined) {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    console.warn("RECAPTCHA_SECRET_KEY not set, skipping verification");
    return true;
  }
  if (!token) return false;

  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
    });
    const data = await response.json() as any;
    return data.success;
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return false;
  }
}

const router: IRouter = Router();

router.post("/register", async (req, res) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid registration data" });
    return;
  }
  const { username, displayName, email, password, recaptchaToken } = parsed.data;

  const isHuman = await verifyRecaptcha(recaptchaToken);
  if (!isHuman) {
    res.status(400).json({ message: "Please complete the CAPTCHA" });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.username, username), eq(usersTable.email, email)))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ message: "Username or email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      displayName,
      email,
      passwordHash,
    })
    .returning();

  if (!user) {
    res.status(500).json({ message: "Failed to create user" });
    return;
  }

  req.session.userId = user.id;
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    isAdmin: user.isAdmin,
    isStudentVerified: user.isStudentVerified,
    studentEmail: user.studentEmail,
    createdAt: user.createdAt,
  });
});

router.post("/login", async (req, res) => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }
  const { username, password, recaptchaToken } = parsed.data;

  const isHuman = await verifyRecaptcha(recaptchaToken);
  if (!isHuman) {
    res.status(400).json({ message: "Please complete the CAPTCHA" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const newAttempts = user.loginAttempts + 1;
    let lockoutUntil = user.lockoutUntil;
    if (newAttempts >= 5) {
      lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
    await db.update(usersTable).set({ loginAttempts: newAttempts, lockoutUntil }).where(eq(usersTable.id, user.id));
    res.status(401).json({ message: newAttempts >= 5 ? "Account locked for 15 minutes." : "Invalid credentials" });
    return;
  }

  if (user.loginAttempts > 0 || user.lockoutUntil) {
    await db.update(usersTable).set({ loginAttempts: 0, lockoutUntil: null }).where(eq(usersTable.id, user.id));
  }

  if (user.status === "blocked") {
    res.status(403).json({ message: "Your account has been blocked. Reason: " + (user.blockedReason || "No reason provided") });
    return;
  }

  req.session.userId = user.id;
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    isAdmin: user.isAdmin,
    isStudentVerified: user.isStudentVerified,
    studentEmail: user.studentEmail,
    createdAt: user.createdAt,
    status: user.status,
  });
});

router.post("/google", async (req, res) => {
  const parsed = GoogleLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid Google data" });
    return;
  }
  const { accessToken, password } = parsed.data;

  try {
    const userRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
    const googleUser = await userRes.json() as any;
    const { name, picture, email, email_verified } = googleUser;

    if (!email_verified) {
      res.status(401).json({ message: "Email not verified" });
      return;
    }

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    if (!user) {
      // New user: check if password was provided in the second step
      if (!password) {
        res.status(200).json({ 
          needsPassword: true, 
          email, 
          suggestedName: name 
        });
        return;
      }

      // Create new user with the user-provided password
      const baseUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const passwordHash = await bcrypt.hash(password, 10);
      [user] = await db.insert(usersTable).values({
        username: `${baseUsername}${Math.random().toString(36).slice(-4)}`,
        displayName: name || baseUsername,
        email,
        passwordHash,
        avatarUrl: picture || null,
      }).returning();
    }

    if (!user) {
      res.status(500).json({ message: "Auth failed" });
      return;
    }

    if (user.status === "blocked") {
      res.status(403).json({ message: "Your account has been blocked. Reason: " + (user.blockedReason || "No reason provided") });
      return;
    }

    req.session.userId = user.id;
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      isAdmin: user.isAdmin,
      isStudentVerified: user.isStudentVerified,
      studentEmail: user.studentEmail,
      createdAt: user.createdAt,
      avatarUrl: picture || user.avatarUrl || null,
      status: user.status,
    });
  } catch (error) {
    res.status(401).json({ message: "Google auth failed" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    res.json({ user: null });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user || user.status === "blocked") {
    if (user?.status === "blocked") req.session.destroy(() => {});
    res.json({ user: null });
    return;
  }
  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      isAdmin: user.isAdmin,
      isStudentVerified: user.isStudentVerified,
      studentEmail: user.studentEmail,
      createdAt: user.createdAt,
      avatarUrl: user.avatarUrl ?? null,
      status: user.status,
    },
  });
});

router.patch("/me", async (req, res) => {
  if (!req.session.userId) res.status(401).json({ message: "Unauthorized" });
  if (!req.session.userId) return;
  const parsed = UpdateCurrentUserBody.safeParse(req.body);
  if (!parsed.success) res.status(400).json({ message: "Invalid data" });
  if (!parsed.success) return;
  const { username, displayName, email } = parsed.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
    if (!user) res.status(404).json({ message: "User not found" });
    if (!user) return;

    const [updatedUser] = await db.update(usersTable).set({
      ...(username && { username }),
      ...(displayName && { displayName }),
      ...(email && { email }),
    }).where(eq(usersTable.id, req.session.userId)).returning();

    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: "Internal error" });
  }
});

router.post("/register/send-code", async (req, res) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) res.status(400).json({ message: "Invalid data" });
  if (!parsed.success) return;
  const { username, email, password, recaptchaToken } = parsed.data;

  const isHuman = await verifyRecaptcha(recaptchaToken);
  if (!isHuman) {
    res.status(400).json({ message: "Please complete the CAPTCHA" });
    return;
  }
  const existing = await db.select().from(usersTable).where(or(eq(usersTable.username, username), eq(usersTable.email, email))).limit(1);
  if (existing.length > 0) res.status(409).json({ message: "In use" });
  if (existing.length > 0) return;

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await requestVerificationCode(email, { ...parsed.data, password: passwordHash });
  if (!result.success) res.status(429).json({ message: result.message });
  if (!result.success) return;
  res.json({ message: result.message });
});

router.post("/register/verify", async (req, res) => {
  const { email, code } = req.body;
  const result = await verifyCode(email, code);
  if (!result.success || !result.pendingUserData) res.status(400).json({ message: "Invalid" });
  if (!result.success || !result.pendingUserData) return;

  const { username, displayName, password: passwordHash } = result.pendingUserData;
  const isUWaterloo = email.endsWith("@uwaterloo.ca");

  const [user] = await db.insert(usersTable).values({
    username, displayName, email, passwordHash,
    studentEmail: isUWaterloo ? email : null,
    isStudentVerified: isUWaterloo,
  }).returning();

  await db.delete(emailVerificationsTable).where(eq(emailVerificationsTable.email, email));
  req.session.userId = user.id;
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    isAdmin: user.isAdmin,
    isStudentVerified: user.isStudentVerified,
    studentEmail: user.studentEmail,
    createdAt: user.createdAt,
  });
});

router.delete("/me", async (req, res) => {
  if (!req.session.userId) res.status(401).json({ message: "Unauthorized" });
  if (!req.session.userId) return;
  await db.delete(usersTable).where(eq(usersTable.id, req.session.userId));
  req.session.destroy(() => res.json({ message: "Deleted" }));
});

// --- Password Routes ---
router.post("/reset-password/send-code", async (req, res) => {
  const { email } = req.body;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) res.status(404).json({ message: "Not found" });
  if (!user) return;
  const result = await requestVerificationCode(email);
  if (!result.success) res.status(429).json({ message: result.message });
  if (!result.success) return;
  res.json({ message: "Sent" });
});

router.post("/reset-password/verify", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword || newPassword.length < 6) res.status(400).json({ message: "Invalid" });
  if (!email || !code || !newPassword || newPassword.length < 6) return;
  const result = await verifyCode(email, code);
  if (!result.success) res.status(400).json({ message: result.message });
  if (!result.success) return;
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash, loginAttempts: 0, lockoutUntil: null }).where(eq(usersTable.email, email));
  await db.delete(emailVerificationsTable).where(eq(emailVerificationsTable.email, email));
  res.json({ message: "Success" });
});

router.post("/change-password", async (req, res) => {
  if (!req.session.userId) res.status(401).json({ message: "Unauthorized" });
  if (!req.session.userId) return;
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) res.status(400).json({ message: "Invalid" });
  if (!newPassword || newPassword.length < 6) return;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user || !(await bcrypt.compare(currentPassword || "", user.passwordHash))) res.status(400).json({ message: "Incorrect password" });
  if (!user || !(await bcrypt.compare(currentPassword || "", user.passwordHash))) return;
  const newHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));
  res.json({ message: "Updated" });
});

export default router;
