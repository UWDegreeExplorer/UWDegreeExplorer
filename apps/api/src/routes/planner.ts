import { Router } from "express";
import { db } from "@workspace/db";
import { courses, courseVersions, courseRequirements } from "@workspace/db/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";

const router = Router();

// Search courses
router.get("/courses", async (req, res) => {
  try {
    const { q, subject, level } = req.query;
    
    let whereClause = [];
    
    if (q && typeof q === "string") {
      whereClause.push(or(
        ilike(courses.courseId, `%${q}%`),
        ilike(courseVersions.title, `%${q}%`)
      ));
    }
    
    if (subject && subject !== "All" && typeof subject === "string") {
      whereClause.push(eq(courses.subjectCode, subject));
    }
    
    if (level && level !== "All" && typeof level === "string") {
      // level is e.g. "100"
      whereClause.push(ilike(courses.catalogNumber, `${level.substring(0, 1)}%`));
    }

    const results = await db
      .select({
        courseId: courses.courseId,
        subjectCode: courses.subjectCode,
        catalogNumber: courses.catalogNumber,
        title: courseVersions.title,
        description: courseVersions.description,
      })
      .from(courses)
      .leftJoin(courseVersions, eq(courses.courseId, courseVersions.courseId))
      .where(and(...whereClause))
      .limit(50);

    console.log(`Search query: q=${q}, sub=${subject}, lvl=${level}. Found ${results.length} results.`);

    // Filter duplicates in memory for now if any
    const uniqueResults = Array.from(new Map(results.map(item => [item.courseId, item])).values());

    res.json(uniqueResults);
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
      res.status(404).json({ error: "Course not found" });
      return;
    }
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
