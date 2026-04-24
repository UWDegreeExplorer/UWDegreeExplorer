import { Router } from "express";
import { db, postsTable, commentsTable } from "@workspace/db";
import { desc, sql, count } from "drizzle-orm";

const SECTION_LABELS: Record<string, string> = {
  carpool: "Carpool",
  academic: "Academic",
  roommate: "Find Roommate",
  other: "Other",
};

const router = Router();

// GET /api/stats/sections
// Returns post count + last activity time per section
router.get("/sections", async (_req, res) => {
  try {
    const rows = await db
      .select({
        section: postsTable.section,
        postCount: count(postsTable.id),
        lastActivityAt: sql<string | null>`max(${postsTable.lastActivityAt})`,
      })
      .from(postsTable)
      .groupBy(postsTable.section);

    // Build a map so we can fill in zero-count sections
    const bySection = new Map(rows.map((r) => [r.section, r]));

    const result = Object.keys(SECTION_LABELS).map((s) => {
      const row = bySection.get(s);
      return {
        section: s,
        label: SECTION_LABELS[s],
        postCount: row ? Number(row.postCount) : 0,
        lastActivityAt: row?.lastActivityAt ?? null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("stats/sections error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/stats/recent-activity
// Returns the most recent 20 items (posts + comments), merged and sorted
router.get("/recent-activity", async (_req, res) => {
  try {
    const recentPosts = await db
      .select({
        kind: sql<string>`'post'`,
        postId: postsTable.id,
        postTitle: postsTable.title,
        section: postsTable.section,
        authorName: postsTable.authorNameSnapshot,
        snippet: sql<string>`substring(${postsTable.body}, 1, 120)`,
        createdAt: postsTable.createdAt,
      })
      .from(postsTable)
      .orderBy(desc(postsTable.createdAt))
      .limit(20);

    const recentComments = await db
      .select({
        kind: sql<string>`'comment'`,
        postId: commentsTable.postId,
        postTitle: postsTable.title,
        section: postsTable.section,
        authorName: commentsTable.authorNameSnapshot,
        snippet: sql<string>`substring(${commentsTable.body}, 1, 120)`,
        createdAt: commentsTable.createdAt,
      })
      .from(commentsTable)
      .innerJoin(postsTable, sql`${commentsTable.postId} = ${postsTable.id}`)
      .orderBy(desc(commentsTable.createdAt))
      .limit(20);

    const merged = [...recentPosts, ...recentComments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    res.json(merged);
  } catch (err) {
    console.error("stats/recent-activity error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;