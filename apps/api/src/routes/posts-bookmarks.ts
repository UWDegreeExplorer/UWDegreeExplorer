import { Router } from "express";
import { db, postsTable, commentsTable, usersTable, bookmarksTable, likesTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";

const router = Router();

// GET /api/posts/bookmarks - Get user's bookmarked posts
router.get("/", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const rows = await db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      section: postsTable.section,
      authorId: postsTable.authorId,
      body: postsTable.body,
      isAnonymous: postsTable.isAnonymous,
      authorName: usersTable.displayName,
      authorNameSnapshot: postsTable.authorNameSnapshot,
      createdAt: postsTable.createdAt,
      lastActivityAt: postsTable.lastActivityAt,
      commentCount: sql<number>`(SELECT COUNT(*) FROM ${commentsTable} WHERE post_id = ${postsTable.id})`,
      bookmarkCount: sql<number>`(SELECT COUNT(*) FROM ${bookmarksTable} WHERE post_id = ${postsTable.id})`,
      likeCount: sql<number>`(SELECT COUNT(*) FROM ${likesTable} WHERE post_id = ${postsTable.id})`,
      isBookmarked: sql<boolean>`true`,
      isLiked: userId ? sql<boolean>`EXISTS(SELECT 1 FROM ${likesTable} WHERE post_id = ${postsTable.id} AND user_id = ${userId})` : sql<boolean>`false`,
    })
    .from(bookmarksTable)
    .innerJoin(postsTable, eq(bookmarksTable.postId, postsTable.id))
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(eq(bookmarksTable.userId, userId))
    .orderBy(desc(bookmarksTable.createdAt));

  res.json(rows.map(r => ({
    ...r,
    authorName: r.isAnonymous ? "Anonymous" : (r.authorName ?? r.authorNameSnapshot),
    excerpt: r.body.slice(0, 160) + (r.body.length > 160 ? "..." : ""),
    commentCount: Number(r.commentCount),
    bookmarkCount: Number(r.bookmarkCount),
    likeCount: Number(r.likeCount),
    isBookmarked: Boolean(r.isBookmarked),
    isLiked: Boolean(r.isLiked),
    createdAt: r.createdAt.toISOString(),
    lastActivityAt: r.lastActivityAt.toISOString(),
  })));
});

export default router;
