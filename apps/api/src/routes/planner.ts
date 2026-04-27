import { Router } from "express";
import { db } from "@workspace/db";
import { courses, courseVersions, courseRequirements, courseOfferings, subjectBreadth } from "@workspace/db/schema";
import { eq, ilike, or, and, sql, not } from "drizzle-orm";

const router = Router();

// Search courses
router.get("/courses", async (req, res) => {
  try {
    const { q, subject, level } = req.query;
    
    let whereClause = [];
    
    if (q && typeof q === "string") {
      const normalizedSearch = q.replace(/\s+/g, '');
      whereClause.push(or(
        ilike(courses.courseId, `%${q}%`),
        ilike(courseVersions.title, `%${q}%`),
        ilike(courses.subjectCode, `%${q}%`),
        ilike(courses.catalogNumber, `%${q}%`),
        // Support searching for "CS135" or "CS 135"
        sql`(${courses.subjectCode} || ${courses.catalogNumber}) ILIKE ${'%' + normalizedSearch + '%'}`
      ));
    }
    
    if (subject && subject !== "All" && typeof subject === "string") {
      whereClause.push(eq(courses.subjectCode, subject));
    }
    
    if (level && level !== "All" && typeof level === "string") {
      if (level === "Other") {
        // Not 1xx, 2xx, 3xx, 4xx
        const undergraduateLevels = or(
          ilike(courses.catalogNumber, '1%'),
          ilike(courses.catalogNumber, '2%'),
          ilike(courses.catalogNumber, '3%'),
          ilike(courses.catalogNumber, '4%')
        );
        if (undergraduateLevels) {
          whereClause.push(not(undergraduateLevels));
        }
      } else {
        // level is e.g. "100"
        whereClause.push(ilike(courses.catalogNumber, `${level.substring(0, 1)}%`));
      }
    }

    const results = await db
      .selectDistinctOn([courses.courseId], {
        courseId: courses.courseId,
        subjectCode: courses.subjectCode,
        catalogNumber: courses.catalogNumber,
        units: courses.units,
        title: courseVersions.title,
        description: courseVersions.description,
        breadthCategory: subjectBreadth.category,
        prereqRaw: courseRequirements.prereqRaw,
      })
      .from(courses)
      .leftJoin(courseVersions, eq(courses.courseId, courseVersions.courseId))
      .leftJoin(subjectBreadth, eq(courses.subjectCode, subjectBreadth.subjectCode))
      .leftJoin(courseRequirements, eq(courses.courseId, courseRequirements.courseId))
      .where(whereClause.length > 0 ? and(...whereClause) : undefined)
      .orderBy(courses.courseId, sql`${courseVersions.versionId} DESC`)
      .limit(100);

    console.log(`[Planner API] q=${q}, sub=${subject}, lvl=${level}. Found ${results.length} raw results.`);

    // Filter duplicates in memory for now if any
    const uniqueResults = Array.from(new Map(results.map(item => [item.courseId, item])).values());

    res.json(uniqueResults);
  } catch (error) {
    console.error("Failed to fetch courses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get single course details with requirements and history
router.get("/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Get core course info and requirements
    const courseData = await db
      .select({
        course: courses,
        version: courseVersions,
        requirements: courseRequirements,
      })
      .from(courses)
      .leftJoin(courseVersions, eq(courses.courseId, courseVersions.courseId))
      .leftJoin(courseRequirements, eq(courses.courseId, courseRequirements.courseId))
      .where(eq(courses.courseId, id))
      .orderBy(sql`${courseVersions.versionId} DESC`)
      .limit(1);

    if (courseData.length === 0) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    // 2. Get offering history
    const offerings = await db
      .select({
        termCode: courseOfferings.termCode,
      })
      .from(courseOfferings)
      .where(eq(courseOfferings.courseId, id))
      .orderBy(sql`${courseOfferings.termCode} DESC`);

    // Deduplicate terms for history
    const history = Array.from(new Set(offerings.map(o => o.termCode))).filter(Boolean);

    const { course, version, requirements } = courseData[0];

    res.json({
      ...course,
      title: version?.title,
      description: version?.description,
      requirementsRaw: version?.requirements,
      prereqJson: requirements?.prereqJson,
      prereqRaw: requirements?.prereqRaw,
      coreqRaw: requirements?.coreqRaw,
      antireqRaw: requirements?.antireqRaw,
      offeringHistory: history,
    });
  } catch (error) {
    console.error("Failed to fetch course details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
