import { Router, type IRouter } from "express";
import { db, reportsTable, commentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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

export default router;
