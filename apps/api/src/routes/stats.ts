import { Router } from "express";
import { db, postsTable, postViewsTable } from "@workspace/db";
import { desc, sql, count, and, eq, notExists } from "drizzle-orm";

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
// Logged out: latest 5 visible posts. Logged in: latest 5 visible posts the user has not opened.
router.get("/recent-activity", async (req, res) => {
  try {
    const userId = req.session.userId;
    const filters = [sql`${postsTable.status} != 'hidden'`];

    if (userId) {
      filters.push(
        notExists(
          db
            .select({ value: sql`1` })
            .from(postViewsTable)
            .where(and(
              eq(postViewsTable.userId, userId),
              eq(postViewsTable.postId, postsTable.id),
            )),
        ),
      );
    }

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
      .where(and(...filters))
      .orderBy(desc(postsTable.createdAt))
      .limit(5);

    res.json(recentPosts);
  } catch (err) {
    console.error("stats/recent-activity error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
