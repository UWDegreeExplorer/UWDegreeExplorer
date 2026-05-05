import { Router, type IRouter } from "express";
import { db, reportsTable, commentsTable, usersTable, postsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { ReportCommentBody } from "@workspace/api-zod";

const router: IRouter = Router();

// Report a comment
router.post("/:id/report", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const commentId = parseInt(req.params.id);
  if (isNaN(commentId)) {
    res.status(400).json({ message: "Invalid comment ID" });
    return;
  }

  const parsed = ReportCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid report data" });
    return;
  }

  // Check if comment exists
  const [comment] = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.id, commentId))
    .limit(1);

  if (!comment) {
    res.status(404).json({ message: "Comment not found" });
    return;
  }

  // Anti-spam check
  const [existing] = await db
    .select()
    .from(reportsTable)
    .where(
      and(
        eq(reportsTable.reporterId, userId),
        eq(reportsTable.targetType, "comment"),
        eq(reportsTable.targetId, commentId),
        eq(reportsTable.status, "pending")
      )
    )
    .limit(1);

  if (existing) {
    res.status(409).json({ message: "You have already reported this comment and it is pending review." });
    return;
  }

  await db.insert(reportsTable).values({
    reporterId: userId,
    targetType: "comment",
    targetId: commentId,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });

  res.json({ ok: true });
});

// Delete a comment
router.delete("/:id", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const commentId = parseInt(req.params.id);
  if (isNaN(commentId)) {
    res.status(400).json({ message: "Invalid comment ID" });
    return;
  }

  const [comment] = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.id, commentId))
    .limit(1);

  if (!comment || comment.status === "hidden") {
    res.status(404).json({ message: "Comment not found" });
    return;
  }

  const [user] = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const allowed = comment.authorId === userId || user?.isAdmin;
  if (!allowed) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  // Soft delete comment and all descendants recursively using CTE
  const result = await db.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM ${commentsTable} WHERE id = ${commentId}
      UNION ALL
      SELECT c.id FROM ${commentsTable} c
      INNER JOIN descendants d ON c.parent_id = d.id
    )
    UPDATE ${commentsTable}
    SET status = 'hidden'
    WHERE id IN (SELECT id FROM descendants)
  `);

  const deletedCount = result.rowCount;

  // Update post's lastActivityAt
  const [latestComment] = await db
    .select({ createdAt: commentsTable.createdAt })
    .from(commentsTable)
    .where(
      and(
        eq(commentsTable.postId, comment.postId),
        eq(commentsTable.status, "visible")
      )
    )
    .orderBy(sql`${commentsTable.createdAt} DESC`)
    .limit(1);

  if (latestComment) {
    await db
      .update(postsTable)
      .set({ lastActivityAt: latestComment.createdAt })
      .where(eq(postsTable.id, comment.postId));
  } else {
    // Revert to post.createdAt
    await db
      .update(postsTable)
      .set({ lastActivityAt: sql`${postsTable.createdAt}` })
      .where(eq(postsTable.id, comment.postId));
  }

  res.json({ ok: true, deletedCount, postId: comment.postId });
});

export default router;
