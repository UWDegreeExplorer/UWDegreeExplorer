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
    isAdmin: user.isAdmin,
    isStudentVerified: user.isStudentVerified,
    studentEmail: user.studentEmail,
  });
});

router.post("/google", async (req, res) => {
  const parsed = GoogleLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid Google token data" });
    return;
  }
  const { accessToken } = parsed.data;

  try {
    const tokenInfo = await googleClient.getTokenInfo(accessToken);
    
    if (!tokenInfo.email) {
      res.status(401).json({ message: "Invalid Google token (no email)" });
      return;
    }

    const email = tokenInfo.email;
    // Note: getTokenInfo doesn't give name/picture easily.
    // We might need to fetch userinfo with the token.
    const userRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
    const googleUser = await userRes.json() as any;
    
    const { name, picture, email_verified } = googleUser;

    if (!email_verified) {
      res.status(401).json({ message: "Google email is not verified" });
      return;
    }

    // 1. Find existing user by email
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user) {
      // 2. Create new user if not found
      const baseUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      let username = baseUsername;
      let attempts = 0;
      const randomPass = Math.random().toString(36).slice(-16);
      const passwordHash = await bcrypt.hash(randomPass, 10);

      while (attempts < 5) {
        try {
          [user] = await db
            .insert(usersTable)
            .values({
              username,
              displayName: name || username,
              email,
              passwordHash,
              avatarUrl: picture || null,
            })
            .returning();
          break; // Success!
        } catch (err: any) {
          // PostgreSQL unique_violation error code is 23505
          const isUsernameCollision = err.code === "23505" && (err.detail?.includes("username") || err.message?.includes("username"));
          
          if (isUsernameCollision && attempts < 4) {
            username = `${baseUsername}${Math.random().toString(36).slice(-4)}`;
            attempts++;
          } else {
            throw err; // Re-throw if it's not a username collision or we're out of attempts
          }
        }
      }
    }

    if (!user) {
      res.status(500).json({ message: "Failed to process Google login" });
      return;
    }

    req.session.userId = user.id;
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      isAdmin: user.isAdmin,
      avatarUrl: picture || user.avatarUrl || null,
      isStudentVerified: user.isStudentVerified,
      studentEmail: user.studentEmail,
    });
  } catch (error) {
    console.error("Google verify error:", error);
    res.status(401).json({ message: "Google authentication failed" });
  }
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
      isAdmin: user.isAdmin,
      avatarUrl: user.avatarUrl ?? null,
      isStudentVerified: user.isStudentVerified,
      studentEmail: user.studentEmail,
    },
  });
});

router.patch("/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = UpdateCurrentUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid update data" });
    return;
  }

  const { username, displayName, email } = parsed.data;

  try {
    // 1. Check if user exists
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // 2. Check for username/email collisions if they are changing
    if (username && username !== user.username) {
      const [collision] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.username, username))
        .limit(1);
      if (collision) {
        res.status(400).json({ message: "Username already taken" });
        return;
      }
    }

    if (email && email !== user.email) {
      const [collision] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);
      if (collision) {
        res.status(400).json({ message: "Email already taken" });
        return;
      }
    }

    // 3. Update user
    const [updatedUser] = await db
      .update(usersTable)
      .set({
        ...(username && { username }),
        ...(displayName && { displayName }),
        ...(email && { email }),
      })
      .where(eq(usersTable.id, req.session.userId))
      .returning();

    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


router.post("/register/send-code", async (req, res) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid registration data" });
    return;
  }
  const { username, email } = parsed.data;

  // Check if username or email already in use
  const existing = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.username, username), eq(usersTable.email, email)))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ message: "Username or email already in use" });
    return;
  }

  const result = await requestVerificationCode(email, req.body);
  if (!result.success) {
    res.status(429).json({ message: result.message });
    return;
  }

  res.json({ message: result.message });
});

router.post("/register/verify", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    res.status(400).json({ message: "Email and code are required" });
    return;
  }

  const result = await verifyCode(email, code);
  if (!result.success) {
    res.status(400).json({ message: result.message });
    return;
  }

  const userData = result.pendingUserData;
  if (!userData) {
    res.status(400).json({ message: "No pending registration found for this email" });
    return;
  }

  const { username, displayName, password } = userData;
  const passwordHash = await bcrypt.hash(password, 10);
  
  const isUWaterloo = email.endsWith("@uwaterloo.ca");

  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      displayName,
      email,
      passwordHash,
      studentEmail: isUWaterloo ? email : null,
      isStudentVerified: isUWaterloo,
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
  });
});

export default router;
