import { Router, type IRouter } from "express";
import { db, postsTable, commentsTable } from "@workspace/db";
import { sql, desc, eq } from "drizzle-orm";
import { SECTION_LABELS, SECTION_ORDER, excerpt } from "../lib/sections";

const router: IRouter = Router();

router.get("/sections", async (_req, res) => {
  const rows = await db
    .select({
      section: postsTable.section,
      postCount: sql<number>`COUNT(*)`,
      lastActivityAt: sql<Date | null>`MAX(${postsTable.lastActivityAt})`,
    })
    .from(postsTable)
    .groupBy(postsTable.section);

  const map = new Map<
    string,
    { postCount: number; lastActivityAt: string | null }
  >();
  for (const r of rows) {
    const raw = r.lastActivityAt as unknown;
    let iso: string | null = null;
    if (raw instanceof Date) {
      iso = raw.toISOString();
    } else if (typeof raw === "string" && raw.length > 0) {
      const d = new Date(raw);
      iso = isNaN(d.getTime()) ? null : d.toISOString();
    }
    map.set(r.section, {
      postCount: Number(r.postCount),
      lastActivityAt: iso,
    });
  }

  res.json(
    SECTION_ORDER.map((section) => {
      const stat = map.get(section);
      return {
        section,
        label: SECTION_LABELS[section] ?? section,
        postCount: stat?.postCount ?? 0,
        lastActivityAt: stat?.lastActivityAt ?? null,
      };
    }),
  );
});

router.get("/recent-activity", async (_req, res) => {
  const recentPosts = await db
    .select({
      id: postsTable.id,
      section: postsTable.section,
      title: postsTable.title,
      body: postsTable.body,
      authorNameSnapshot: postsTable.authorNameSnapshot,
      createdAt: postsTable.createdAt,
    })
    .from(postsTable)
    .orderBy(desc(postsTable.createdAt))
    .limit(15);

  const recentComments = await db
    .select({
      id: commentsTable.id,
      postId: commentsTable.postId,
      body: commentsTable.body,
      authorNameSnapshot: commentsTable.authorNameSnapshot,
      createdAt: commentsTable.createdAt,
      postTitle: postsTable.title,
      section: postsTable.section,
    })
    .from(commentsTable)
    .innerJoin(postsTable, eq(commentsTable.postId, postsTable.id))
    .orderBy(desc(commentsTable.createdAt))
    .limit(15);

  type Item = {
    kind: "post" | "comment";
    postId: number;
    postTitle: string;
    section: string;
    authorName: string;
    snippet: string;
    createdAt: string;
    sortDate: number;
  };

  const items: Item[] = [
    ...recentPosts.map((p) => ({
      kind: "post" as const,
      postId: p.id,
      postTitle: p.title,
      section: p.section,
      authorName: p.authorNameSnapshot,
      snippet: excerpt(p.body, 140),
      createdAt: p.createdAt.toISOString(),
      sortDate: p.createdAt.getTime(),
    })),
    ...recentComments.map((c) => ({
      kind: "comment" as const,
      postId: c.postId,
      postTitle: c.postTitle,
      section: c.section,
      authorName: c.authorNameSnapshot,
      snippet: excerpt(c.body, 140),
      createdAt: c.createdAt.toISOString(),
      sortDate: c.createdAt.getTime(),
    })),
  ];

  items.sort((a, b) => b.sortDate - a.sortDate);
  res.json(
    items.slice(0, 20).map(({ sortDate: _s, ...rest }) => rest),
  );
});

export default router;
