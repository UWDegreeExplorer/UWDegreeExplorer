import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.session.userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  next();
}

export function publicAuthorName(opts: {
  isAnonymous: boolean;
  realName: string | null;
}): string {
  if (opts.isAnonymous || !opts.realName) return "Anonymous";
  return opts.realName;
}
