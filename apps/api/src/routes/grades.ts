import { Router } from "express";
import { db } from "@workspace/db";
import { userCourseGrades, userGradeComponents, userSchedules } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// 1. Get all grade summaries for the user
router.get("/", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const grades = await db
      .select()
      .from(userCourseGrades)
      .where(eq(userCourseGrades.userId, userId))
      .orderBy(sql`${userCourseGrades.term} DESC`, userCourseGrades.courseCode);

    return res.json(grades);
  } catch (error) {
    logger.error({ error }, "Failed to fetch grades");
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. Sync courses from user_schedules
router.post("/sync", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Get all schedules
    const schedules = await db
      .select()
      .from(userSchedules)
      .where(eq(userSchedules.userId, userId));

    for (const schedule of schedules) {
      const courses = (schedule.data as any[]) || [];
      for (const course of courses) {
        const courseCode = course.courseCode;
        if (!courseCode) continue;

        // Upsert course grade entry
        await db
          .insert(userCourseGrades)
          .values({
            userId,
            term: schedule.term,
            courseCode,
          })
          .onConflictDoNothing();
      }
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to sync grades");
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. Get detailed breakdown for a course
router.get("/:term/:courseCode", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { term, courseCode } = req.params;

  try {
    const [courseGrade] = await db
      .select()
      .from(userCourseGrades)
      .where(
        and(
          eq(userCourseGrades.userId, userId),
          eq(userCourseGrades.term, term),
          eq(userCourseGrades.courseCode, courseCode)
        )
      )
      .limit(1);

    if (!courseGrade) {
      return res.status(404).json({ error: "Course not found in grades" });
    }

    const components = await db
      .select()
      .from(userGradeComponents)
      .where(eq(userGradeComponents.courseGradeId, courseGrade.id))
      .orderBy(userGradeComponents.id);

    return res.json({ ...courseGrade, components });
  } catch (error) {
    logger.error({ error }, "Failed to fetch course grade details");
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// 4. Upsert a grade component
router.post("/components", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { id, courseGradeId, parentId, name, weight, score, isLeaf } = req.body;

  try {
    // Verify ownership
    const [courseGrade] = await db
      .select()
      .from(userCourseGrades)
      .where(and(eq(userCourseGrades.id, courseGradeId), eq(userCourseGrades.userId, userId)))
      .limit(1);

    if (!courseGrade) return res.status(403).json({ error: "Forbidden" });

    if (id) {
      // Update
      const [updated] = await db
        .update(userGradeComponents)
        .set({ parentId, name, weight, score, isLeaf, updatedAt: new Date() })
        .where(eq(userGradeComponents.id, id))
        .returning();
      return res.json(updated);
    } else {
      // Create
      const [created] = await db
        .insert(userGradeComponents)
        .values({ courseGradeId, parentId, name, weight, score, isLeaf })
        .returning();
      return res.json(created);
    }
  } catch (error) {
    logger.error({ error }, "Failed to save grade component");
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// 5. Delete a grade component
router.delete("/components/:id", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;

  try {
    // Verify ownership via join or subquery
    const [component] = await db
      .select({ id: userGradeComponents.id })
      .from(userGradeComponents)
      .innerJoin(userCourseGrades, eq(userGradeComponents.courseGradeId, userCourseGrades.id))
      .where(and(eq(userGradeComponents.id, Number(id)), eq(userCourseGrades.userId, userId)))
      .limit(1);

    if (!component) return res.status(403).json({ error: "Forbidden" });

    await db.delete(userGradeComponents).where(eq(userGradeComponents.id, Number(id)));
    return res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to delete component");
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
