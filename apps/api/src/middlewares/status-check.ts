import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Middleware to check if the current user is blocked.
 * If blocked, the session is destroyed and a 403 response is returned.
 */
export async function statusCheck(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    try {
      const [user] = await db
        .select({ status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, req.session.userId));

      if (user && user.status === "blocked") {
        req.session.destroy((err) => {
          if (err) {
            console.error("Error destroying session for blocked user:", err);
          }
          res.status(403).json({ 
            message: "Your account has been blocked by an administrator." 
          });
        });
        return;
      }
    } catch (error) {
      console.error("Status check middleware error:", error);
      // We continue to not block the user if the DB check fails, 
      // but maybe we should return 500? For now, next() is safer for availability.
    }
  }
  next();
}
