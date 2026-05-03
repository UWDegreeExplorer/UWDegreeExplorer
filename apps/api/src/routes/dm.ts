import { Router, type IRouter } from "express";
import { 
  db, 
  conversationsTable, 
  conversationParticipantsTable, 
  messagesTable, 
  usersTable,
  postsTable,
  commentsTable,
  connectRequestsTable,
  notificationsTable
} from "@workspace/db";
import { eq, and, ne, desc, sql, aliasedTable, lt, or } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

// Middleware to ensure user is logged in
router.use((req, res, next) => {
  if (!req.session.userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
});

// 0. GET /unread-count - 获取总未读数 (Moved up for clarity)
router.get("/unread-count", async (req, res) => {
  const userId = req.session.userId!;

  const [result] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(messagesTable)
    .innerJoin(
      conversationParticipantsTable,
      eq(messagesTable.conversationId, conversationParticipantsTable.conversationId)
    )
    .where(
      and(
        eq(conversationParticipantsTable.userId, userId),
        ne(messagesTable.senderId, userId),
        sql`${messagesTable.deletedAt} IS NULL`,
        sql`(${conversationParticipantsTable.lastReadAt} IS NULL OR ${messagesTable.createdAt} > ${conversationParticipantsTable.lastReadAt})`
      )
    );

  res.json({ count: result?.count || 0 });
});

// 1. GET /conversations - 获取当前用户会话列表
router.get("/conversations", async (req, res) => {
  const userId = req.session.userId!;

  // We want to find all conversations the user is in,
  // and for each, get the information of the OTHER participant.
  const otherParticipants = aliasedTable(conversationParticipantsTable, "other_participants");

  const results = await db
    .select({
      id: conversationsTable.id,
      updatedAt: conversationsTable.updatedAt,
      otherUser: {
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
      },
      lastMessage: {
        body: sql<string>`(
          SELECT body FROM ${messagesTable} 
          WHERE conversation_id = ${conversationsTable.id} 
          AND deleted_at IS NULL 
          ORDER BY created_at DESC LIMIT 1
        )`,
        createdAt: sql<Date>`(
          SELECT created_at FROM ${messagesTable} 
          WHERE conversation_id = ${conversationsTable.id} 
          AND deleted_at IS NULL 
          ORDER BY created_at DESC LIMIT 1
        )`,
        senderId: sql<number>`(
          SELECT sender_id FROM ${messagesTable} 
          WHERE conversation_id = ${conversationsTable.id} 
          AND deleted_at IS NULL 
          ORDER BY created_at DESC LIMIT 1
        )`,
      },
      unreadCount: sql<number>`(
        SELECT count(*)::int FROM ${messagesTable} m
        WHERE m.conversation_id = ${conversationsTable.id}
        AND m.sender_id != ${userId}
        AND m.deleted_at IS NULL
        AND (
          ${conversationParticipantsTable.lastReadAt} IS NULL 
          OR m.created_at > ${conversationParticipantsTable.lastReadAt}
        )
      )`,
    })
    .from(conversationsTable)
    .innerJoin(
      conversationParticipantsTable,
      eq(conversationsTable.id, conversationParticipantsTable.conversationId)
    )
    .innerJoin(
      otherParticipants,
      and(
        eq(conversationsTable.id, otherParticipants.conversationId),
        ne(otherParticipants.userId, userId)
      )
    )
    .innerJoin(usersTable, eq(otherParticipants.userId, usersTable.id))
    .where(eq(conversationParticipantsTable.userId, userId))
    .orderBy(desc(conversationsTable.updatedAt));

  res.json(results);
});

// 2. POST /conversations - 创建或获取与某个用户的会话 (非匿名)
const CreateConversationSchema = z.object({
  targetUserId: z.number(),
});

router.post("/conversations", async (req, res) => {
  const userId = req.session.userId!;
  const parsed = CreateConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid target user ID" });
    return;
  }

  const { targetUserId } = parsed.data;

  if (targetUserId === userId) {
    res.status(400).json({ message: "You cannot message yourself" });
    return;
  }

  // Check if user exists and is not blocked
  const [targetUser] = await db
    .select({ status: usersTable.status })
    .from(usersTable)
    .where(eq(usersTable.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    res.status(404).json({ message: "Target user not found" });
    return;
  }

  if (targetUser.status === "blocked") {
    res.status(403).json({ message: "This user is blocked and cannot receive messages" });
    return;
  }

  // Find existing conversation
  const p1 = aliasedTable(conversationParticipantsTable, "p1");
  const p2 = aliasedTable(conversationParticipantsTable, "p2");

  const [existing] = await db
    .select({ id: p1.conversationId })
    .from(p1)
    .innerJoin(p2, eq(p1.conversationId, p2.conversationId))
    .where(and(eq(p1.userId, userId), eq(p2.userId, targetUserId)))
    .limit(1);

  if (existing) {
    res.json({ id: existing.id });
    return;
  }

  // Create new conversation
  const newConversationId = await db.transaction(async (tx) => {
    const [conv] = await tx
      .insert(conversationsTable)
      .values({})
      .returning({ id: conversationsTable.id });

    await tx.insert(conversationParticipantsTable).values([
      { conversationId: conv.id, userId: userId },
      { conversationId: conv.id, userId: targetUserId },
    ]);

    return conv.id;
  });

  res.status(201).json({ id: newConversationId });
});

// 2.1 POST /connect-requests - 发起连接请求 (匿名)
const CreateConnectRequestSchema = z.object({
  sourcePostId: z.number(),
  sourceCommentId: z.number().optional(),
});

router.post("/connect-requests", async (req, res) => {
  const userId = req.session.userId!;
  const parsed = CreateConnectRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request parameters" });
    return;
  }

  const { sourcePostId, sourceCommentId } = parsed.data;

  // 1. Find target user from post/comment
  let targetUserId: number | null = null;
  let isAnonymous = false;
  let postTitle = "";

  if (sourceCommentId) {
    const [comment] = await db
      .select({ 
        authorId: commentsTable.authorId, 
        isAnonymous: commentsTable.isAnonymous,
        postTitle: postsTable.title 
      })
      .from(commentsTable)
      .innerJoin(postsTable, eq(commentsTable.postId, postsTable.id))
      .where(and(eq(commentsTable.id, sourceCommentId), eq(commentsTable.postId, sourcePostId)))
      .limit(1);
    
    if (comment) {
      targetUserId = comment.authorId;
      isAnonymous = !!comment.isAnonymous;
      postTitle = comment.postTitle;
    }
  } else {
    const [post] = await db
      .select({ authorId: postsTable.authorId, isAnonymous: postsTable.isAnonymous, title: postsTable.title })
      .from(postsTable)
      .where(eq(postsTable.id, sourcePostId))
      .limit(1);
    
    if (post) {
      targetUserId = post.authorId;
      isAnonymous = !!post.isAnonymous;
      postTitle = post.title;
    }
  }

  if (!targetUserId || !isAnonymous) {
    res.status(400).json({ message: "This content is not anonymous or author not found" });
    return;
  }

  if (targetUserId === userId) {
    res.status(400).json({ message: "You cannot connect with yourself" });
    return;
  }

  // Check if target is blocked
  const [targetUser] = await db
    .select({ status: usersTable.status })
    .from(usersTable)
    .where(eq(usersTable.id, targetUserId))
    .limit(1);

  if (targetUser?.status === "blocked") {
    res.status(403).json({ message: "Target user is blocked" });
    return;
  }

  // Check for existing pending request
  const [existing] = await db
    .select()
    .from(connectRequestsTable)
    .where(and(
      eq(connectRequestsTable.requesterId, userId),
      eq(connectRequestsTable.targetUserId, targetUserId),
      eq(connectRequestsTable.sourcePostId, sourcePostId),
      sourceCommentId ? eq(connectRequestsTable.sourceCommentId, sourceCommentId) : sql`${connectRequestsTable.sourceCommentId} IS NULL`,
      eq(connectRequestsTable.status, "pending")
    ))
    .limit(1);

  if (existing) {
    res.json({ id: existing.id, status: existing.status });
    return;
  }

  // Create request and notification
  const requestId = await db.transaction(async (tx) => {
    const [request] = await tx
      .insert(connectRequestsTable)
      .values({
        requesterId: userId,
        targetUserId: targetUserId!,
        sourcePostId,
        sourceCommentId: sourceCommentId || null,
        status: "pending",
      })
      .returning({ id: connectRequestsTable.id });

    await tx.insert(notificationsTable).values({
      userId: targetUserId!,
      actorId: userId,
      type: "connect_request",
      postId: sourcePostId,
      postTitle: postTitle,
      actorName: "Someone", // Keep it generic
      connectRequestId: request.id,
    });

    return request.id;
  });

  res.status(201).json({ id: requestId, status: "pending" });
});

// 2.2 POST /connect-requests/:id/accept
router.post("/connect-requests/:id/accept", async (req, res) => {
  const userId = req.session.userId!;
  const { id } = req.params;

  const [request] = await db
    .select()
    .from(connectRequestsTable)
    .where(eq(connectRequestsTable.id, id))
    .limit(1);

  if (!request || request.targetUserId !== userId) {
    res.status(404).json({ message: "Request not found" });
    return;
  }

  if (request.status !== "pending") {
    res.status(400).json({ message: "Request already handled" });
    return;
  }

  const conversationId = await db.transaction(async (tx) => {
    // 1. Mark accepted
    await tx
      .update(connectRequestsTable)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(connectRequestsTable.id, id));

    // 2. Create/Get conversation
    const p1 = aliasedTable(conversationParticipantsTable, "p1");
    const p2 = aliasedTable(conversationParticipantsTable, "p2");
    
    const [existingConv] = await tx
      .select({ id: p1.conversationId })
      .from(p1)
      .innerJoin(p2, eq(p1.conversationId, p2.conversationId))
      .where(and(eq(p1.userId, request.requesterId), eq(p2.userId, userId)))
      .limit(1);

    let convId = existingConv?.id;

    if (!convId) {
      const [newConv] = await tx
        .insert(conversationsTable)
        .values({})
        .returning({ id: conversationsTable.id });
      
      await tx.insert(conversationParticipantsTable).values([
        { conversationId: newConv.id, userId: request.requesterId },
        { conversationId: newConv.id, userId: userId },
      ]);
      convId = newConv.id;
    }

    // 3. Update request with conversationId
    await tx
      .update(connectRequestsTable)
      .set({ conversationId: convId })
      .where(eq(connectRequestsTable.id, id));

    // 4. Mark notification as read
    await tx
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.connectRequestId, id)
      ));

    // 5. Send notification to requester
    await tx.insert(notificationsTable).values({
      userId: request.requesterId,
      actorId: userId,
      type: "connect_accepted",
      postId: request.sourcePostId,
      actorName: "User", // We can use display name now since it's accepted
      conversationId: convId,
    });

    return convId;
  });

  res.json({ conversationId });
});

// 2.3 POST /connect-requests/:id/decline
router.post("/connect-requests/:id/decline", async (req, res) => {
  const userId = req.session.userId!;
  const { id } = req.params;

  const [request] = await db
    .select()
    .from(connectRequestsTable)
    .where(eq(connectRequestsTable.id, id))
    .limit(1);

  if (!request || request.targetUserId !== userId) {
    res.status(404).json({ message: "Request not found" });
    return;
  }

  if (request.status !== "pending") {
    res.status(400).json({ message: "Request already handled" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(connectRequestsTable)
      .set({ status: "declined", respondedAt: new Date() })
      .where(eq(connectRequestsTable.id, id));

    await tx
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.connectRequestId, id)
      ));
  });

  res.json({ ok: true });
});

// 2.5 GET /conversations/:id - 获取单个会话详情 (用于 Header)
router.get("/conversations/:id", async (req, res) => {
  const userId = req.session.userId!;
  const { id } = req.params;

  const isParticipant = await checkParticipation(userId, id);
  if (!isParticipant) {
    res.status(404).json({ message: "Conversation not found" });
    return;
  }

  const otherParticipants = aliasedTable(conversationParticipantsTable, "other_participants");

  const [result] = await db
    .select({
      id: conversationsTable.id,
      otherUser: {
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
      },
    })
    .from(conversationsTable)
    .innerJoin(
      otherParticipants,
      and(
        eq(conversationsTable.id, otherParticipants.conversationId),
        ne(otherParticipants.userId, userId)
      )
    )
    .innerJoin(usersTable, eq(otherParticipants.userId, usersTable.id))
    .where(eq(conversationsTable.id, id))
    .limit(1);

  res.json(result);
});

// Helper to check if user is in conversation
async function checkParticipation(userId: number, conversationId: string) {
  const [participation] = await db
    .select()
    .from(conversationParticipantsTable)
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, conversationId),
        eq(conversationParticipantsTable.userId, userId)
      )
    )
    .limit(1);
  return !!participation;
}

// 3. GET /conversations/:id/messages - 获取消息列表
router.get("/conversations/:id/messages", async (req, res) => {
  const userId = req.session.userId!;
  const { id } = req.params;
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

  const isParticipant = await checkParticipation(userId, id);
  if (!isParticipant) {
    res.status(404).json({ message: "Conversation not found" });
    return;
  }

  const filters = [
    eq(messagesTable.conversationId, id),
    sql`${messagesTable.deletedAt} IS NULL`
  ];
  
  if (cursor) {
    filters.push(lt(messagesTable.createdAt, new Date(cursor)));
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(and(...filters))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  const nextCursor = messages.length === limit ? messages[messages.length - 1].createdAt.toISOString() : null;

  res.json({
    messages: messages.reverse(), // Return in chronological order
    nextCursor
  });
});

// 4. POST /conversations/:id/messages - 发送消息
const SendMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

router.post("/conversations/:id/messages", async (req, res) => {
  const userId = req.session.userId!;
  const { id } = req.params;
  const parsed = SendMessageSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "Invalid message body (must not be empty or too long)" });
    return;
  }

  const isParticipant = await checkParticipation(userId, id);
  if (!isParticipant) {
    res.status(404).json({ message: "Conversation not found" });
    return;
  }

  // Check if the other participant is blocked
  const [otherParticipant] = await db
    .select({ id: usersTable.id, status: usersTable.status, displayName: usersTable.displayName })
    .from(conversationParticipantsTable)
    .innerJoin(usersTable, eq(conversationParticipantsTable.userId, usersTable.id))
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, id),
        ne(conversationParticipantsTable.userId, userId)
      )
    )
    .limit(1);

  if (otherParticipant?.status === "blocked") {
    res.status(403).json({ message: "Cannot send messages to a blocked user" });
    return;
  }

  const [newMessage] = await db.transaction(async (tx) => {
    const [msg] = await tx
      .insert(messagesTable)
      .values({
        conversationId: id,
        senderId: userId,
        body: parsed.data.body,
      })
      .returning();

    await tx
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, id));

    // Send notification to recipient
    if (otherParticipant) {
      await tx.insert(notificationsTable).values({
        userId: otherParticipant.id,
        actorId: userId,
        type: "dm_message",
        conversationId: id,
        actorName: "Someone", // Default for privacy, can be updated later
        metadata: { excerpt: parsed.data.body.slice(0, 50) },
      });
    }

    return [msg];
  });

  res.status(201).json(newMessage);
});

// 5. POST /conversations/:id/read - 标记已读
router.post("/conversations/:id/read", async (req, res) => {
  const userId = req.session.userId!;
  const { id } = req.params;

  const isParticipant = await checkParticipation(userId, id);
  if (!isParticipant) {
    res.status(404).json({ message: "Conversation not found" });
    return;
  }

  await db
    .update(conversationParticipantsTable)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, id),
        eq(conversationParticipantsTable.userId, userId)
      )
    );

  res.json({ ok: true });
});

export default router;
