import { Router, type IRouter } from "express";
import { db, notificationsTable, usersTable, postsTable } from "@workspace/db";
import { eq, desc, and, count } from "drizzle-orm";

const router: IRouter = Router();

// Get notification count
router.get("/unread-count", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.json({ count: 0 });
  }

  const [row] = await db
    .select({ value: count() })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));
  
  res.json({ count: row?.value ?? 0 });
});

// Get notifications
router.get("/", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const rows = await db
    .select({
      id: notificationsTable.id,
      type: notificationsTable.type,
      postId: notificationsTable.postId,
      postTitle: postsTable.title,
      actorName: usersTable.displayName,
      isRead: notificationsTable.isRead,
      createdAt: notificationsTable.createdAt,
    })
    .from(notificationsTable)
    .innerJoin(postsTable, eq(notificationsTable.postId, postsTable.id))
    .leftJoin(usersTable, eq(notificationsTable.actorId, usersTable.id))
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(rows.map(r => ({
    ...r,
    actorName: r.actorName || "Anonymous",
    createdAt: r.createdAt.toISOString()
  })));
});

// Mark all as read
router.post("/read-all", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).end();

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, userId));

  res.json({ ok: true });
});

export default router;
