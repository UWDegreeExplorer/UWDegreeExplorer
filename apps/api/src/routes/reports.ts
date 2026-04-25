import { Router, type IRouter } from "express";
import { db, reportsTable, postsTable, commentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ReportPostBody, ReportCommentBody } from "@workspace/api-zod";

const router: IRouter = Router();

// Report a post
router.post("/posts/:id/report", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const postId = parseInt(req.params.id);
  if (isNaN(postId)) {
    res.status(400).json({ message: "Invalid post ID" });
    return;
  }

  const parsed = ReportPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid report data" });
    return;
  }

  // Check if post exists
  const [post] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, postId))
    .limit(1);

  if (!post) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  // Anti-spam check
  const [existing] = await db
    .select()
    .from(reportsTable)
    .where(
      and(
        eq(reportsTable.reporterId, userId),
        eq(reportsTable.targetType, "post"),
        eq(reportsTable.targetId, postId),
        eq(reportsTable.status, "pending")
      )
    )
    .limit(1);

  if (existing) {
    res.status(409).json({ message: "You have already reported this post and it is pending review." });
    return;
  }

  await db.insert(reportsTable).values({
    reporterId: userId,
    targetType: "post",
    targetId: postId,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });

  res.json({ ok: true });
});

// Report a comment
router.post("/comments/:id/report", async (req, res) => {
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

export default router;
