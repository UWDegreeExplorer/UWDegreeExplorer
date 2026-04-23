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

const router: IRouter = Router();

router.post("/register", async (req, res) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid registration data" });
    return;
  }
  const { username, displayName, email, password } = parsed.data;

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
  const { username, password } = parsed.data;

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

router.post("/google", async (req, res) => {
  const parsed = GoogleLoginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid Google data" });
  const { accessToken } = parsed.data;

  try {
    const userRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
    const googleUser = await userRes.json() as any;
    const { name, picture, email, email_verified } = googleUser;

    if (!email_verified) return res.status(401).json({ message: "Email not verified" });

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    if (!user) {
      const baseUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const randomPass = Math.random().toString(36).slice(-16);
      const passwordHash = await bcrypt.hash(randomPass, 10);
      [user] = await db.insert(usersTable).values({
        username: `${baseUsername}${Math.random().toString(36).slice(-4)}`,
        displayName: name || baseUsername,
        email,
        passwordHash,
        avatarUrl: picture || null,
      }).returning();
    }

    if (!user) return res.status(500).json({ message: "Auth failed" });

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
    });
  } catch (error) {
    res.status(401).json({ message: "Google auth failed" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) return res.json({ user: null });
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
    },
  });
});

router.patch("/me", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
  const parsed = UpdateCurrentUserBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
  const { username, displayName, email } = parsed.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
    if (!user) return res.status(404).json({ message: "User not found" });

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
  if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
  const { username, email, password } = parsed.data;
  const existing = await db.select().from(usersTable).where(or(eq(usersTable.username, username), eq(usersTable.email, email))).limit(1);
  if (existing.length > 0) return res.status(409).json({ message: "In use" });

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await requestVerificationCode(email, { ...parsed.data, password: passwordHash });
  if (!result.success) return res.status(429).json({ message: result.message });
  res.json({ message: result.message });
});

router.post("/register/verify", async (req, res) => {
  const { email, code } = req.body;
  const result = await verifyCode(email, code);
  if (!result.success || !result.pendingUserData) return res.status(400).json({ message: "Invalid" });

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
  if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
  await db.delete(usersTable).where(eq(usersTable.id, req.session.userId));
  req.session.destroy(() => res.json({ message: "Deleted" }));
});

// --- Password Routes ---
router.post("/reset-password/send-code", async (req, res) => {
  const { email } = req.body;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) return res.status(404).json({ message: "Not found" });
  const result = await requestVerificationCode(email);
  if (!result.success) return res.status(429).json({ message: result.message });
  res.json({ message: "Sent" });
});

router.post("/reset-password/verify", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword || newPassword.length < 6) return res.status(400).json({ message: "Invalid" });
  const result = await verifyCode(email, code);
  if (!result.success) return res.status(400).json({ message: result.message });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash, loginAttempts: 0, lockoutUntil: null }).where(eq(usersTable.email, email));
  await db.delete(emailVerificationsTable).where(eq(emailVerificationsTable.email, email));
  res.json({ message: "Success" });
});

router.post("/change-password", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: "Invalid" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user || !(await bcrypt.compare(currentPassword || "", user.passwordHash))) return res.status(400).json({ message: "Incorrect password" });
  const newHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));
  res.json({ message: "Updated" });
});

export default router;
