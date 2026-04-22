import { Router, type IRouter } from "express";
import { db, postsTable, commentsTable, usersTable } from "@workspace/db";
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
  const { section, search } = parsed.data;

  const filters = [];
  if (section) filters.push(eq(postsTable.section, section));
  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    filters.push(
      sql`(${postsTable.title} ILIKE ${term} OR ${postsTable.body} ILIKE ${term})`,
    );
  }

  const rows = await db
    .select({
      id: postsTable.id,
      section: postsTable.section,
      title: postsTable.title,
      body: postsTable.body,
      authorNameSnapshot: postsTable.authorNameSnapshot,
      isAnonymous: postsTable.isAnonymous,
      createdAt: postsTable.createdAt,
      lastActivityAt: postsTable.lastActivityAt,
      commentCount: sql<number>`(SELECT COUNT(*) FROM ${commentsTable} WHERE ${commentsTable.postId} = ${postsTable.id})`,
    })
    .from(postsTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(postsTable.lastActivityAt));

  res.json(
    rows.map((p) => ({
      id: p.id,
      section: p.section,
      title: p.title,
      excerpt: excerpt(p.body, 160),
      authorName: p.authorNameSnapshot,
      isAnonymous: p.isAnonymous,
      commentCount: Number(p.commentCount),
      createdAt: p.createdAt.toISOString(),
      lastActivityAt: p.lastActivityAt.toISOString(),
    })),
  );
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

  res.json({
    post: {
      id: post.id,
      section: post.section,
      title: post.title,
      body: post.body,
      authorName: post.authorNameSnapshot,
      isAnonymous: post.isAnonymous,
      createdAt: post.createdAt.toISOString(),
    },
    comments: comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      parentId: c.parentId,
      body: c.body,
      authorName: c.authorNameSnapshot,
      isAnonymous: c.isAnonymous,
      createdAt: c.createdAt.toISOString(),
    })),
  });
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

export default router;
