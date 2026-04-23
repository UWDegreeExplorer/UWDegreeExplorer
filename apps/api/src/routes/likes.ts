import { Router, type IRouter } from "express";
import { db, likesTable, postsTable, commentsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

// Toggle like for a post
router.post("/posts/:id/toggle", async (req, res) => {
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

  const [existing] = await db
    .select()
    .from(likesTable)
    .where(and(eq(likesTable.postId, postId), eq(likesTable.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .delete(likesTable)
      .where(and(eq(likesTable.postId, postId), eq(likesTable.userId, userId)));
    res.json({ liked: false });
  } else {
    await db.insert(likesTable).values({
      postId,
      userId,
    });
    res.json({ liked: true });
  }
});

// Toggle like for a comment
router.post("/comments/:id/toggle", async (req, res) => {
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

  const [existing] = await db
    .select()
    .from(likesTable)
    .where(and(eq(likesTable.commentId, commentId), eq(likesTable.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .delete(likesTable)
      .where(and(eq(likesTable.commentId, commentId), eq(likesTable.userId, userId)));
    res.json({ liked: false });
  } else {
    await db.insert(likesTable).values({
      commentId,
      userId,
    });
    res.json({ liked: true });
  }
});

// Get user's liked posts and comments
router.get("/me", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const likedPosts = await db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      section: postsTable.section,
      isAnonymous: postsTable.isAnonymous,
      authorName: usersTable.displayName,
      authorNameSnapshot: postsTable.authorNameSnapshot,
      createdAt: postsTable.createdAt,
      likedAt: likesTable.createdAt,
    })
    .from(likesTable)
    .innerJoin(postsTable, eq(likesTable.postId, postsTable.id))
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(eq(likesTable.userId, userId))
    .orderBy(desc(likesTable.createdAt));

  const likedComments = await db
    .select({
      id: commentsTable.id,
      body: commentsTable.body,
      postId: commentsTable.postId,
      isAnonymous: commentsTable.isAnonymous,
      authorName: usersTable.displayName,
      authorNameSnapshot: commentsTable.authorNameSnapshot,
      createdAt: commentsTable.createdAt,
      likedAt: likesTable.createdAt,
    })
    .from(likesTable)
    .innerJoin(commentsTable, eq(likesTable.commentId, commentsTable.id))
    .leftJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
    .where(eq(likesTable.userId, userId))
    .orderBy(desc(likesTable.createdAt));

  res.json({
    posts: likedPosts.map(p => ({
      ...p,
      authorName: p.isAnonymous ? "Anonymous" : (p.authorName ?? p.authorNameSnapshot),
      createdAt: p.createdAt.toISOString(),
      likedAt: p.likedAt.toISOString(),
    })),
    comments: likedComments.map(c => ({
      ...c,
      authorName: c.isAnonymous ? "Anonymous" : (c.authorName ?? c.authorNameSnapshot),
      createdAt: c.createdAt.toISOString(),
      likedAt: c.likedAt.toISOString(),
    })),
  });
});

export default router;
