import { Router } from "express";
import { db } from "@workspace/db";
import { draftsTable } from "@workspace/db/schema/drafts";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const DraftSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  section: z.string().optional(),
  postId: z.number().optional().nullable(),
  parentId: z.number().optional().nullable(),
  isAnonymous: z.boolean().optional(),
});

// Get all drafts for current user
router.get("/", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Not logged in" });
    return;
  }

  const drafts = await db.execute(sql`
    SELECT 
      d.*,
      p.title as post_title
    FROM drafts d
    LEFT JOIN posts p ON d.post_id = p.id
    WHERE d.user_id = ${userId}
    ORDER BY d.updated_at DESC
  `);

  res.json(drafts.rows);
});

// Create or update a draft
// If ID is provided, update. Otherwise create.
router.post("/", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Not logged in" });
    return;
  }

  const parsed = DraftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid draft data" });
    return;
  }

  const { id } = req.body;

  if (id) {
    // Update existing
    const updated = await db
      .update(draftsTable)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(and(eq(draftsTable.id, id), eq(draftsTable.userId, userId)))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ message: "Draft not found" });
      return;
    }
    res.json(updated[0]);
  } else {
    // Create new
    const inserted = await db
      .insert(draftsTable)
      .values({
        ...parsed.data,
        userId,
      })
      .returning();
    res.json(inserted[0]);
  }
});

// Delete a draft
router.delete("/:id", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ message: "Not logged in" });
    return;
  }

  const id = Number(req.params.id);
  const deleted = await db
    .delete(draftsTable)
    .where(and(eq(draftsTable.id, id), eq(draftsTable.userId, userId)))
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ message: "Draft not found" });
    return;
  }

  res.json({ ok: true });
});

export default router;
