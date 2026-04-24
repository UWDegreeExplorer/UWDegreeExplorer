import { Router } from "express";
import { db, postsTable, commentsTable, bookmarksTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

// GET /api/posts/activity - Unified feed of user's posts and comments
router.get("/", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const userPosts = await db
    .select({
      id: postsTable.id,
      postId: postsTable.id,
      section: postsTable.section,
      title: postsTable.title,
      content: postsTable.body,
      isAnonymous: postsTable.isAnonymous,
      authorName: postsTable.authorNameSnapshot,
      createdAt: postsTable.createdAt,
      type: sql<string>`'post'`,
      commentCount: sql<number>`(SELECT COUNT(*) FROM ${commentsTable} WHERE post_id = ${postsTable.id})`,
      bookmarkCount: sql<number>`(SELECT COUNT(*) FROM ${bookmarksTable} WHERE post_id = ${postsTable.id})`,
      isBookmarked: userId ? sql<boolean>`EXISTS(SELECT 1 FROM ${bookmarksTable} WHERE post_id = ${postsTable.id} AND user_id = ${userId})` : sql<boolean>`false`,
    })
    .from(postsTable)
    .where(eq(postsTable.authorId, userId));

  const userComments = await db
    .select({
      id: commentsTable.id,
      postId: commentsTable.postId,
      section: postsTable.section,
      title: postsTable.title,
      content: commentsTable.body,
      isAnonymous: commentsTable.isAnonymous,
      authorName: commentsTable.authorNameSnapshot,
      createdAt: commentsTable.createdAt,
      type: sql<string>`'comment'`,
      commentCount: sql<number>`(SELECT COUNT(*) FROM ${commentsTable} WHERE post_id = ${postsTable.id})`,
      bookmarkCount: sql<number>`(SELECT COUNT(*) FROM ${bookmarksTable} WHERE post_id = ${postsTable.id})`,
      isBookmarked: userId ? sql<boolean>`EXISTS(SELECT 1 FROM ${bookmarksTable} WHERE post_id = ${postsTable.id} AND user_id = ${userId})` : sql<boolean>`false`,
    })
    .from(commentsTable)
    .leftJoin(postsTable, eq(commentsTable.postId, postsTable.id))
    .where(eq(commentsTable.authorId, userId));

  const combined = [...userPosts, ...userComments].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  res.json(combined.map(item => ({
    ...item,
    commentCount: Number(item.commentCount),
    bookmarkCount: Number(item.bookmarkCount),
    isBookmarked: Boolean(item.isBookmarked),
    createdAt: item.createdAt.toISOString()
  })));
});

export default router;
