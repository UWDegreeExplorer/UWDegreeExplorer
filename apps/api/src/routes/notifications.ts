import { Router, type IRouter } from "express";
import { db, notificationsTable, usersTable, postsTable } from "@workspace/db";
import { eq, desc, and, count } from "drizzle-orm";

const router: IRouter = Router();

// Get notification count
router.get("/unread-count", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.json({ count: 0 });
    return;
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
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const rows = await db
    .select({
      id: notificationsTable.id,
      type: notificationsTable.type,
      postId: notificationsTable.postId,
      postTitle: postsTable.title,
      savedPostTitle: notificationsTable.postTitle,
      actorName: usersTable.displayName,
      savedActorName: notificationsTable.actorName,
      commentId: notificationsTable.commentId,
      connectRequestId: notificationsTable.connectRequestId,
      conversationId: notificationsTable.conversationId,
      metadata: notificationsTable.metadata,
      isRead: notificationsTable.isRead,
      createdAt: notificationsTable.createdAt,
    })
    .from(notificationsTable)
    .leftJoin(postsTable, eq(notificationsTable.postId, postsTable.id))
    .leftJoin(usersTable, eq(notificationsTable.actorId, usersTable.id))
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(rows.map(r => ({
    ...r,
    postTitle: r.postTitle || r.savedPostTitle || "Deleted Post",
    actorName: r.actorName || r.savedActorName || "Anonymous",
    createdAt: r.createdAt.toISOString(),
    postDeleted: !r.postTitle
  })));
});

// Mark single notification as read
router.post("/:id/read", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).end();
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid ID" });
    return;
  }

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));

  res.json({ ok: true });
});

// Mark all as read
router.post("/read-all", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).end();
    return;
  }

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, userId));

  res.json({ ok: true });
});

export default router;
