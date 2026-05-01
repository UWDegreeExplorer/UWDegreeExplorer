import { Router, type IRouter } from "express";
import { db, postsTable, commentsTable, usersTable, notificationsTable, bookmarksTable, draftsTable, likesTable, reportsTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  CreatePostBody,
  ListPostsQueryParams,
  CreateCommentBody,
  ReportPostBody,
} from "@workspace/api-zod";
import { isValidSection, excerpt } from "../lib/sections";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const parsed = ListPostsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid query parameters" });
    return;
  }
  const { section, search, authorId } = parsed.data;

  const filters = [sql`${postsTable.status} != 'hidden'`];
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
      isStudentVerified: usersTable.isStudentVerified,
      authorNameSnapshot: postsTable.authorNameSnapshot,
      createdAt: postsTable.createdAt,
      lastActivityAt: postsTable.lastActivityAt,
      commentCount: sql<number>`(SELECT COUNT(*) FROM ${commentsTable} WHERE post_id = ${postsTable.id})`,
      bookmarkCount: sql<number>`(SELECT COUNT(*) FROM ${bookmarksTable} WHERE post_id = ${postsTable.id})`,
      isBookmarked: sql<boolean>`CASE WHEN ${bookmarksTable.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
      likeCount: sql<number>`(SELECT COUNT(*) FROM ${likesTable} WHERE post_id = ${postsTable.id})`,
      isLiked: sql<boolean>`CASE WHEN ${likesTable.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .leftJoin(bookmarksTable, and(
      eq(bookmarksTable.postId, postsTable.id),
      eq(bookmarksTable.userId, userId || -1)
    ))
    .leftJoin(likesTable, and(
      eq(likesTable.postId, postsTable.id),
      eq(likesTable.userId, userId || -1)
    ))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(postsTable.lastActivityAt));

  res.json(
    rows.map((r) => ({
      ...r,
      authorName: r.isAnonymous ? "Anonymous" : (r.authorName ?? r.authorNameSnapshot),
      excerpt: "",
      commentCount: Number(r.commentCount),
      bookmarkCount: Number(r.bookmarkCount),
      isBookmarked: Boolean(r.isBookmarked),
      likeCount: Number(r.likeCount),
      isLiked: Boolean(r.isLiked),
      isStudentVerified: Boolean(r.isStudentVerified),
      createdAt: r.createdAt.toISOString(),
      lastActivityAt: r.lastActivityAt.toISOString(),
    })),
  );
});


router.post("/", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Only logged-in users can create posts" });
    return;
  }

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

  let realName: string | null = null;
  if (userId) {
    const [u] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    realName = u?.displayName ?? null;
  }

  const authorNameSnapshot = anonymous ? "Anonymous" : (realName || "Unknown User");
  const effectiveAnonymous = !!anonymous;

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

// Report a post
router.post("/:id/report", async (req, res) => {
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

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

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

  const [postData] = await db
    .select({
      post: postsTable,
      isStudentVerified: usersTable.isStudentVerified,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(eq(postsTable.id, id))
    .limit(1);
  const post = postData ? { ...postData.post, isStudentVerified: postData.isStudentVerified } : null;

  if (!post || (post.status === "hidden" && !viewerIsAdmin && post.authorId !== sessionUserId)) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  const commentsData = await db
    .select({
      comment: commentsTable,
      isStudentVerified: usersTable.isStudentVerified,
      likeCount: sql<number>`(SELECT COUNT(*) FROM ${likesTable} WHERE comment_id = ${commentsTable.id})`,
      isLiked: sql<boolean>`CASE WHEN ${likesTable.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
    })
    .from(commentsTable)
    .leftJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
    .leftJoin(likesTable, and(
      eq(likesTable.commentId, commentsTable.id),
      eq(likesTable.userId, sessionUserId || -1)
    ))
    .where(and(eq(commentsTable.postId, id), sql`${commentsTable.status} != 'hidden'`))
    .orderBy(commentsTable.createdAt);

  const comments = commentsData.map(c => ({ 
    ...c.comment, 
    isStudentVerified: c.isStudentVerified,
    likeCount: Number(c.likeCount),
    isLiked: Boolean(c.isLiked)
  }));

  const canDelete =
    viewerIsAdmin ||
    (sessionUserId != null && post.authorId === sessionUserId);

  const userId = req.session.userId;
  const [data] = await db
    .select({
      bookmarkCount: sql<number>`CAST((SELECT COUNT(*) FROM ${bookmarksTable} WHERE post_id = ${postsTable.id}) AS INTEGER)`,
      isBookmarked: sql<boolean>`CASE WHEN ${bookmarksTable.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
      likeCount: sql<number>`CAST((SELECT COUNT(*) FROM ${likesTable} WHERE post_id = ${postsTable.id}) AS INTEGER)`,
      isLiked: sql<boolean>`CASE WHEN ${likesTable.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
    })
    .from(postsTable)
    .leftJoin(bookmarksTable, and(
      eq(bookmarksTable.postId, postsTable.id),
      eq(bookmarksTable.userId, userId || -1)
    ))
    .leftJoin(likesTable, and(
      eq(likesTable.postId, postsTable.id),
      eq(likesTable.userId, userId || -1)
    ))
    .where(eq(postsTable.id, id))
    .limit(1);

  // Explicitly ensure boolean and number types
  const finalMetadata = {
    bookmarkCount: Number(data?.bookmarkCount ?? 0),
    isBookmarked: Boolean(data?.isBookmarked),
    likeCount: Number(data?.likeCount ?? 0),
    isLiked: Boolean(data?.isLiked),
  };

  res.json({
    post: {
      ...post,
      ...finalMetadata,
      authorName: post.isAnonymous ? "Anonymous" : (post.authorId ? post.authorNameSnapshot : "Deleted User"),
      createdAt: post.createdAt.toISOString(),
      canDelete,
    },
    comments: comments.map((c) => ({
      ...c,
      authorName: c.isAnonymous ? "Anonymous" : (c.authorId ? c.authorNameSnapshot : "Deleted User"),
      createdAt: c.createdAt.toISOString(),
    })),
  });
});

router.delete("/:id", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id);
  const [post] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, id))
    .limit(1);

  if (!post) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (post.authorId !== userId && !user?.isAdmin) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  // 1. Mark reports for the post itself as resolved
  await db.update(reportsTable).set({ status: "resolved" }).where(
    and(
      eq(reportsTable.targetType, "post"),
      eq(reportsTable.targetId, id)
    )
  );

  // 2. Mark reports for all comments belonging to this post as resolved
  await db.update(reportsTable).set({ status: "resolved" }).where(
    and(
      eq(reportsTable.targetType, "comment"),
      sql`target_id IN (SELECT id FROM ${commentsTable} WHERE post_id = ${id})`
    )
  );

  // 3. Cleanup likes for all comments (MUST be before deleting comments)
  await db.delete(likesTable).where(
    sql`comment_id IN (SELECT id FROM ${commentsTable} WHERE post_id = ${id})`
  );

  // 4. Delete associated post data
  await db.delete(commentsTable).where(eq(commentsTable.postId, id));
  await db.delete(bookmarksTable).where(eq(bookmarksTable.postId, id));
  await db.delete(notificationsTable).where(eq(notificationsTable.postId, id));
  await db.delete(draftsTable).where(eq(draftsTable.postId, id));
  await db.delete(likesTable).where(eq(likesTable.postId, id));

  // 5. Finally delete the post
  await db.delete(postsTable).where(eq(postsTable.id, id));

  res.json({ message: "Post deleted" });
});

router.post("/:id/comments", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const postId = parseInt(req.params.id);
  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid comment data" });
    return;
  }
  const { body, anonymous, parentId } = parsed.data;

  let realName: string | null = null;
  if (userId) {
    const [u] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    realName = u?.displayName ?? null;
  }

  const authorNameSnapshot = anonymous ? "Anonymous" : (realName || "Unknown User");
  const effectiveAnonymous = !!anonymous;

  const [comment] = await db
    .insert(commentsTable)
    .values({
      postId,
      parentId: parentId || null,
      authorId: userId,
      authorNameSnapshot,
      isAnonymous: effectiveAnonymous,
      body,
    })
    .returning();

  await db
    .update(postsTable)
    .set({ lastActivityAt: new Date() })
    .where(eq(postsTable.id, postId));

  const [post] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, postId))
    .limit(1);

  // Collect user IDs to notify to avoid duplicates
  const notifiedUserIds = new Set<number>();
  notifiedUserIds.add(userId); // Don't notify the person who commented

  if (post && post.authorId && !notifiedUserIds.has(post.authorId)) {
    await db.insert(notificationsTable).values({
      userId: post.authorId,
      actorId: effectiveAnonymous ? null : userId,
      actorName: authorNameSnapshot,
      type: "reply_to_post",
      postId: post.id,
      postTitle: post.title,
      commentId: comment.id,
    });
    notifiedUserIds.add(post.authorId);
  }

  if (parentId) {
    const [parentComment] = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.id, parentId))
      .limit(1);
    if (parentComment && parentComment.authorId && !notifiedUserIds.has(parentComment.authorId)) {
      await db.insert(notificationsTable).values({
        userId: parentComment.authorId,
        actorId: effectiveAnonymous ? null : userId,
        actorName: authorNameSnapshot,
        type: "reply_to_comment",
        postId: postId,
        postTitle: post?.title || "Post",
        commentId: comment.id,
      });
      notifiedUserIds.add(parentComment.authorId);
    }
  }

  res.json({
    ...comment,
    authorName: comment.authorNameSnapshot,
    createdAt: comment.createdAt.toISOString(),
  });
});

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

export default router;
