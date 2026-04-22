import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import {
  RegisterUserBody,
  LoginUserBody,
} from "@workspace/api-zod";

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
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  req.session.userId = user.id;
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    res.json({ user: null });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId))
    .limit(1);
  if (!user) {
    res.json({ user: null });
    return;
  }
  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
    },
  });
});

export default router;
