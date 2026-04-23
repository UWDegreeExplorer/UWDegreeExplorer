import { Router, type IRouter } from "express";
import { db, postsTable, commentsTable, usersTable, notificationsTable, bookmarksTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  CreatePostBody,
  ListPostsQueryParams,
  CreateCommentBody,
} from "@workspace/api-zod";
import { isValidSection, excerpt } from "../lib/sections";
import { publicAuthorName } from "../lib/auth";
import { sendReplyNotification } from "../lib/email";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const parsed = ListPostsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid query parameters" });
    return;
  }
  const { section, search, authorId } = parsed.data;

  const filters = [];
  if (section) filters.push(eq(postsTable.section, section));
  if (authorId) filters.push(eq(postsTable.authorId, Number(authorId)));
  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    filters.push(
      sql`(${postsTable.title} ILIKE ${term} OR ${postsTable.body} ILIKE ${term})`,
    );
  }

  const userId = req.session.userId;

  const rows = await db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      section: postsTable.section,
      authorId: postsTable.authorId,
      isAnonymous: postsTable.isAnonymous,
      authorName: usersTable.displayName,
      createdAt: postsTable.createdAt,
      lastActivityAt: postsTable.lastActivityAt,
      commentCount: sql<number>`(SELECT COUNT(*) FROM ${commentsTable} WHERE post_id = ${postsTable.id})`,
      bookmarkCount: sql<number>`(SELECT COUNT(*) FROM ${bookmarksTable} WHERE post_id = ${postsTable.id})`,
      isBookmarked: userId ? sql<boolean>`EXISTS(SELECT 1 FROM ${bookmarksTable} WHERE post_id = ${postsTable.id} AND user_id = ${userId})` : sql<boolean>`false`,
    })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(postsTable.lastActivityAt));

  res.json(
    rows.map((r) => ({
      ...r,
      authorName: r.isAnonymous ? "Anonymous" : r.authorName,
      excerpt: "", // Excerpt is derived on frontend if needed, or we can add it here if schema supported it
      createdAt: r.createdAt.toISOString(),
      lastActivityAt: r.lastActivityAt.toISOString(),
    })),
  );
});

// GET /api/me/activity - Unified feed of user's posts and comments
router.get("/activity", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const userPosts = await db
    .select({
      id: postsTable.id,
      postId: postsTable.id, // 对于 Post，postId 就是 id
      title: postsTable.title,
      content: postsTable.body,
      createdAt: postsTable.createdAt,
      type: sql<string>`'post'`,
    })
    .from(postsTable)
    .where(eq(postsTable.authorId, userId));

  const userComments = await db
    .select({
      id: commentsTable.id,
      postId: commentsTable.postId, // 关键补全
      title: sql<string>`(SELECT title FROM ${postsTable} WHERE id = ${commentsTable.postId})`,
      content: commentsTable.body,
      createdAt: commentsTable.createdAt,
      type: sql<string>`'comment'`,
    })
    .from(commentsTable)
    .where(eq(commentsTable.authorId, userId));

  const combined = [...userPosts, ...userComments].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  res.json(combined.map(item => ({
    ...item,
    createdAt: item.createdAt.toISOString()
  })));
});

router.post("/", async (req, res) => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid post data" });
    return;
  }
  const { section, title, body, anonymous } = parsed.data;
  if (!isValidSection(section)) {
    res.status(400).json({ message: "Invalid section" });
    return;
  }

  const userId = req.session.userId ?? null;
  let realName: string | null = null;
  if (userId) {
    const [u] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    realName = u?.displayName ?? null;
  }

  const effectiveAnonymous = !userId || anonymous;
  const authorNameSnapshot = publicAuthorName({
    isAnonymous: effectiveAnonymous,
    realName,
  });

  const [post] = await db
    .insert(postsTable)
    .values({
      section,
      title,
      body,
      authorId: userId,
      authorNameSnapshot,
      isAnonymous: effectiveAnonymous,
    })
    .returning();

  if (!post) {
    res.status(500).json({ message: "Failed to create post" });
    return;
  }

  res.json({
    id: post.id,
    section: post.section,
    title: post.title,
    body: post.body,
    authorName: post.authorNameSnapshot,
    isAnonymous: post.isAnonymous,
    createdAt: post.createdAt.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  const [post] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, id))
    .limit(1);

  if (!post) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  const comments = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.postId, id))
    .orderBy(commentsTable.createdAt);

  const sessionUserId = req.session.userId ?? null;
  let viewerIsAdmin = false;
  if (sessionUserId) {
    const [viewer] = await db
      .select({ isAdmin: usersTable.isAdmin })
      .from(usersTable)
      .where(eq(usersTable.id, sessionUserId))
      .limit(1);
    viewerIsAdmin = viewer?.isAdmin ?? false;
  }
  const canDelete =
    viewerIsAdmin ||
    (sessionUserId != null && post.authorId === sessionUserId);

  const userId = req.session.userId;
  const [metadata] = await db
    .select({
      bookmarkCount: sql<number>`(SELECT COUNT(*) FROM ${bookmarksTable} WHERE post_id = ${postsTable.id})`,
      isBookmarked: userId ? sql<boolean>`EXISTS(SELECT 1 FROM ${bookmarksTable} WHERE post_id = ${postsTable.id} AND user_id = ${userId})` : sql<boolean>`false`,
    })
    .from(postsTable)
    .where(eq(postsTable.id, id));

  res.json({
    post: {
      id: post.id,
      section: post.section,
      title: post.title,
      body: post.body,
      authorId: post.authorId,
      authorName: post.isAnonymous ? "Anonymous" : post.authorNameSnapshot,
      isAnonymous: post.isAnonymous,
      createdAt: post.createdAt.toISOString(),
      canDelete,
      ...metadata,
    },
    comments: comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      parentId: c.parentId,
      body: c.body,
      authorName: c.isAnonymous ? "Anonymous" : c.authorNameSnapshot,
      isAnonymous: c.isAnonymous,
      createdAt: c.createdAt.toISOString(),
    })),
  });
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  const sessionUserId = req.session.userId;
  if (!sessionUserId) {
    res.status(401).json({ message: "You must be signed in to delete posts" });
    return;
  }

  const [post] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, id))
    .limit(1);
  if (!post) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  const [viewer] = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, sessionUserId))
    .limit(1);
  const isAdmin = viewer?.isAdmin ?? false;
  const isAuthor = post.authorId != null && post.authorId === sessionUserId;

  if (!isAdmin && !isAuthor) {
    res
      .status(403)
      .json({ message: "You don't have permission to delete this post" });
    return;
  }

  await db.delete(commentsTable).where(eq(commentsTable.postId, id));
  await db.delete(postsTable).where(eq(postsTable.id, id));

  res.json({ ok: true });
});

router.post("/:id/comments", async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid comment data" });
    return;
  }
  const { body, anonymous, parentId } = parsed.data;

  const [post] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, postId))
    .limit(1);
  if (!post) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  if (parentId != null) {
    const [parent] = await db
      .select()
      .from(commentsTable)
      .where(
        and(eq(commentsTable.id, parentId), eq(commentsTable.postId, postId)),
      )
      .limit(1);
    if (!parent) {
      res.status(400).json({ message: "Parent comment not found" });
      return;
    }
  }

  const userId = req.session.userId ?? null;
  let realName: string | null = null;
  if (userId) {
    const [u] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    realName = u?.displayName ?? null;
  }

  const effectiveAnonymous = !userId || anonymous;
  const authorNameSnapshot = publicAuthorName({
    isAnonymous: effectiveAnonymous,
    realName,
  });

  const [comment] = await db
    .insert(commentsTable)
    .values({
      postId,
      parentId: parentId ?? null,
      authorId: userId,
      authorNameSnapshot,
      isAnonymous: effectiveAnonymous,
      body,
    })
    .returning();

  if (!comment) {
    res.status(500).json({ message: "Failed to create comment" });
    return;
  }

  await db
    .update(postsTable)
    .set({ lastActivityAt: new Date() })
    .where(eq(postsTable.id, postId));

  // Email notification: notify the post author when someone else replies
  if (post.authorId && post.authorId !== userId) {
    const [authorUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, post.authorId))
      .limit(1);
    if (authorUser) {
      // Create in-app notification
      await db.insert(notificationsTable).values({
        userId: post.authorId,
        actorId: userId,
        type: "reply_to_post",
        postId: post.id,
        commentId: comment.id,
      });

      const replyExcerpt = excerpt(body, 240);
      void sendReplyNotification({
        toEmail: authorUser.email,
        toName: authorUser.displayName,
        postTitle: post.title,
        postId: post.id,
        replierName: authorNameSnapshot,
        replyExcerpt,
      });
    }
  }

  if (parentId != null) {
    const [parentComment] = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.id, parentId))
      .limit(1);
    
    if (parentComment && parentComment.authorId && parentComment.authorId !== userId) {
      await db.insert(notificationsTable).values({
        userId: parentComment.authorId,
        actorId: userId,
        type: "reply_to_comment",
        postId: post.id,
        commentId: comment.id,
      });
    }
  }

  res.json({
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    body: comment.body,
    authorName: comment.authorNameSnapshot,
    isAnonymous: comment.isAnonymous,
    createdAt: comment.createdAt.toISOString(),
  });
});

// POST /api/posts/:id/bookmark - Toggle bookmark
router.post("/:id/bookmark", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(bookmarksTable)
    .where(and(eq(bookmarksTable.postId, id), eq(bookmarksTable.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .delete(bookmarksTable)
      .where(and(eq(bookmarksTable.postId, id), eq(bookmarksTable.userId, userId)));
    res.json({ bookmarked: false });
  } else {
    await db.insert(bookmarksTable).values({
      postId: id,
      userId: userId,
    });
    res.json({ bookmarked: true });
  }
});

// GET /api/posts/bookmarks - Get user's bookmarked posts
router.get("/bookmarks", async (req, res) => {
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
      createdAt: postsTable.createdAt,
      lastActivityAt: postsTable.lastActivityAt,
      commentCount: sql<number>`(SELECT COUNT(*) FROM ${commentsTable} WHERE post_id = ${postsTable.id})`,
      bookmarkCount: sql<number>`(SELECT COUNT(*) FROM ${bookmarksTable} WHERE post_id = ${postsTable.id})`,
      isBookmarked: sql<boolean>`true`,
    })
    .from(bookmarksTable)
    .innerJoin(postsTable, eq(bookmarksTable.postId, postsTable.id))
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(eq(bookmarksTable.userId, userId))
    .orderBy(desc(bookmarksTable.createdAt));

  res.json(rows.map(r => ({
    ...r,
    excerpt: r.body.slice(0, 160) + (r.body.length > 160 ? "..." : ""),
    createdAt: r.createdAt.toISOString(),
    lastActivityAt: r.lastActivityAt.toISOString(),
  })));
});

export default router;
