import { Router } from "express";
import { db } from "@workspace/db";
import { courses, courseVersions, courseRequirements } from "@workspace/db/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";

const router = Router();

// Search courses
router.get("/courses", async (req, res) => {
  try {
    const { q, subject, level } = req.query;
    
    let query = db
      .select({
        courseId: courses.courseId,
        subjectCode: courses.subjectCode,
        catalogNumber: courses.catalogNumber,
        title: courseVersions.title,
        description: courseVersions.description,
        requirements: courseVersions.requirements,
      })
      .from(courses)
      .leftJoin(courseVersions, eq(courses.courseId, courseVersions.courseId))
      // Filter for the most recent term's version or just any version if we don't have term logic yet
      .where(
        and(
          // Ensure we don't get duplicate versions (simplified)
          sql`${courseVersions.versionId} IN (
            SELECT MAX(v2.version_id) 
            FROM planner_course_versions v2 
            GROUP BY v2.course_id
          )`,
          q ? or(
            ilike(courses.courseId, `%${q}%`),
            ilike(courseVersions.title, `%${q}%`),
            ilike(courseVersions.description, `%${q}%`)
          ) : undefined,
          subject ? eq(courses.subjectCode, subject as string) : undefined,
          level ? ilike(courses.catalogNumber, `${level}%`) : undefined
        )
      )
      .limit(50);

    const results = await query;
    res.json(results);
  } catch (error) {
    console.error("Failed to fetch courses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get single course details
router.get("/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db
      .select()
      .from(courses)
      .leftJoin(courseVersions, eq(courses.courseId, courseVersions.courseId))
      .leftJoin(courseRequirements, eq(courses.courseId, courseRequirements.courseId))
      .where(eq(courses.courseId, id))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
