import { Router } from "express";
import { logger } from "../lib/logger";
import { parseQuestSchedule } from "../utils/scheduleParser";
import { generateICS } from "../utils/icsGenerator";
import { db, userSchedules } from "@workspace/db";
import { courses, courseVersions, courseRequirements, courseOfferings, subjectBreadth, userWorkloads } from "@workspace/db/schema";
import { eq, ilike, or, and, sql, not } from "drizzle-orm";
import * as analyzer from "../utils/workloadAnalyzer";

// Initialize Geo Data
analyzer.initGeoData();

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
      .selectDistinctOn([courses.subjectCode, courses.catalogNumber], {
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
      .orderBy(courses.subjectCode, courses.catalogNumber, sql`${courseVersions.versionId} DESC`)
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

// --- CALENDAR ROUTES ---

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

    const { course, version, requirements } = courseData[0];

    // 2. Fetch UWFlow ratings in parallel
    const uwflowRating = await analyzer.fetchUWFlowRatings(
      course.subjectCode || "", 
      course.catalogNumber || ""
    );

    // 3. Get offering history
    const offerings = await db
      .select({
        termCode: courseOfferings.termCode,
      })
      .from(courseOfferings)
      .where(eq(courseOfferings.courseId, id))
      .orderBy(sql`${courseOfferings.termCode} DESC`);

    // Deduplicate terms for history
    const history = Array.from(new Set(offerings.map(o => o.termCode))).filter(Boolean);

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
      uwflowRating,
    });
  } catch (error) {
    console.error("Failed to fetch course details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Parse Quest Schedule Text
router.post("/parse-schedule", (req, res) => {
  const { text } = req.body;
  if (!text) {
    logger.warn("Parse schedule called with no text");
    res.status(400).json({ error: "No text provided" });
    return;
  }
  
  logger.info({ textLength: text.length }, "Starting schedule parse");
  
  try {
    const result = parseQuestSchedule(text);
    logger.info({ 
      coursesFound: result.courses.length,
      term: result.term 
    }, "Schedule parse completed");
    
    res.json(result);
  } catch (error) {
    logger.error({ error }, "Failed to parse schedule");
    res.status(500).json({ error: "Failed to parse schedule" });
  }
});

// Generate ICS File
router.post("/generate-ics", (req, res) => {
  const { courses } = req.body;
  if (!courses || !Array.isArray(courses)) {
    res.status(400).json({ error: "Invalid courses data" });
    return;
  }
  try {
    const ics = generateICS(courses);
    res.setHeader("Content-Type", "text/calendar");
    res.setHeader("Content-Disposition", "attachment; filename=uw_schedule.ics");
    res.send(ics);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate ICS" });
  }
});

// --- PERSISTENCE ROUTES ---

// List all saved terms for current user
router.get("/schedules", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const schedules = await db
      .select({ term: userSchedules.term, updatedAt: userSchedules.updatedAt })
      .from(userSchedules)
      .where(eq(userSchedules.userId, userId))
      .orderBy(sql`${userSchedules.term} DESC`);

    res.json(schedules);
  } catch (error) {
    logger.error({ error }, "Failed to fetch saved schedules");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Save or Update a schedule for a term
router.post("/schedules", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { term, courses } = req.body;
  if (!term || !courses) {
    res.status(400).json({ error: "Missing term or courses data" });
    return;
  }

  try {
    await db
      .insert(userSchedules)
      .values({
        userId,
        term,
        data: courses,
      })
      .onConflictDoUpdate({
        target: [userSchedules.userId, userSchedules.term],
        set: {
          data: courses,
          updatedAt: new Date(),
        },
      });

    res.json({ success: true, term });
  } catch (error) {
    logger.error({ error }, "Failed to save schedule");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get detailed schedule for a specific term
router.get("/schedules/:term", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { term } = req.params;

  try {
    const [schedule] = await db
      .select()
      .from(userSchedules)
      .where(and(eq(userSchedules.userId, userId), eq(userSchedules.term, term)))
      .limit(1);

    if (!schedule) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }

    res.json(schedule);
  } catch (error) {
    logger.error({ error }, "Failed to fetch schedule detail");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete a saved schedule
router.delete("/schedules/:term", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { term } = req.params;

  try {
    await db
      .delete(userSchedules)
      .where(and(eq(userSchedules.userId, userId), eq(userSchedules.term, term)));

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to delete schedule");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- WORKLOAD CALCULATOR ROUTES ---

router.post("/workload/analyze", async (req, res) => {
  const { text, courses, term } = req.body;
  
  // Debug log to see what's coming in
  console.log(`[Workload Analyze] Request received. Text length: ${text?.length || 0}, Courses: ${courses?.length || 0}, Term: ${term}`);

  if (!text && (!courses || !term)) {
    return res.status(400).json({ error: "No text or course data provided" });
  }

  try {
    let data;
    if (courses && term) {
      // Normalize courses if coming from DB (they use startTime/endTime/days instead of a single time string)
      const normalizedCourses = courses.map((c: any) => {
        // If it's already a string, keep it. If it's an array, join it.
        const dayStr = Array.isArray(c.days) ? c.days.join("") : (c.days || "");
        if (!c.time && dayStr && c.startTime && c.endTime) {
          return { ...c, time: `${dayStr} ${c.startTime} ${c.endTime}` };
        }
        return c;
      });
      data = { term, courses: normalizedCourses };
    } else {
      data = parseQuestSchedule(text);
    }
    
    // Fetch all ratings and analyze commute in parallel
    const courseResults = await Promise.all(data.courses.map(async (c: any) => {
      const code = c.courseCode || "Unknown Unknown";
      const [subject, catalog] = code.split(" ");
      const [courseRatings, profRatings] = await Promise.all([
        analyzer.fetchUWFlowRatings(subject || "Unknown", catalog || "Unknown"),
        analyzer.fetchUWFlowProfRatings(c.instructor || "")
      ]);
      return { ...c, courseRatings, profRatings };
    }));

    // Organize by day for commute analysis
    const dayMap: any = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri" };
    const dayStruct: any = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] };

    courseResults.forEach((c: any) => {
      const timeStr = c.time || "";
      const parts = timeStr.split(" ");
      if (parts.length < 3) return;
      const daysStr = parts[0];
      const startStr = parts[1];
      const endStr = parts[parts.length - 1];
      
      const roomStr = c.room || "Unknown";
      const bParts = roomStr.split(" ");
      const bCode = bParts[0];
      const bFloor = (bParts[1] && bParts[1][0]) || "1";

      // Improved day parsing to handle both MO/TU and M/T/Th
      let i = 0;
      while (i < daysStr.length) {
        let dKey = "";
        // Check for 2-letter codes first (MO, TU, WE, TH, FR)
        const nextTwo = daysStr.substring(i, i + 2);
        if (["MO", "TU", "WE", "TH", "FR"].includes(nextTwo)) {
          dKey = nextTwo;
          i += 2;
        } 
        // Then check for legacy/Quest style
        else if (daysStr[i] === "T" && daysStr[i+1] === "h") {
          dKey = "TH";
          i += 2;
        } else {
          // Map single letters to standard keys
          const singleMap: any = { 'M': 'MO', 'T': 'TU', 'W': 'WE', 'F': 'FR' };
          dKey = singleMap[daysStr[i]] || daysStr[i];
          i += 1;
        }

        const dayName = dayMap[dKey];
        if (dayName) {
          const startDate = new Date(`1970-01-01T${startStr}:00`);
          const endDate = new Date(`1970-01-01T${endStr}:00`);

          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            dayStruct[dayName].push({
              start: startDate,
              end: endDate,
              bCode,
              bFloor,
              ref: c
            });
          }
        }
      }
    });

    // Run commute analysis per day
    Object.keys(dayStruct).forEach((day) => {
      const dailyCourses = dayStruct[day].sort((a: any, b: any) => a.start - b.start);
      for (let i = 0; i < dailyCourses.length - 1; i++) {
        const curr = dailyCourses[i];
        const nxt = dailyCourses[i+1];
        if (curr.bCode !== "ONLN" && nxt.bCode !== "ONLN") {
          const wTime = analyzer.getWalkingTime(curr.bCode, curr.bFloor, nxt.bCode, nxt.bFloor);
          const gap = (nxt.start - curr.end) / 60000;
          const stress = wTime > gap ? "impossible" : (wTime > 15 || gap - wTime < 5) ? "high" : "low";
          
          if (!curr.ref.commute) curr.ref.commute = [];
          curr.ref.commute.push({ to: nxt.ref.courseCode, walk: wTime, gap, stress, day });
        }
      }
    });

    const finalScore = analyzer.calculateWorkloadScore(data.term, courseResults);
    return res.json({ term: data.term, courses: courseResults, score: finalScore });
  } catch (error: any) {
    logger.error({ error }, "Workload analysis failed");
    return res.status(500).json({ error: error.message || "Analysis failed" });
  }
});

router.get("/workload", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const results = await db
      .select({ term: userWorkloads.term, score: userWorkloads.score, updatedAt: userWorkloads.updatedAt })
      .from(userWorkloads)
      .where(eq(userWorkloads.userId, userId))
      .orderBy(sql`${userWorkloads.term} DESC`);
    return res.json(results);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/workload", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { term, courses, score } = req.body;
  try {
    await db.insert(userWorkloads).values({ userId, term, data: courses, score }).onConflictDoUpdate({
      target: [userWorkloads.userId, userWorkloads.term],
      set: { data: courses, score, updatedAt: new Date() }
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/workload/:term", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [result] = await db
      .select()
      .from(userWorkloads)
      .where(and(eq(userWorkloads.userId, userId), eq(userWorkloads.term, req.params.term)))
      .limit(1);
    if (!result) return res.status(404).json({ error: "Not found" });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/workload/:term", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { term } = req.params;

  try {
    await db.delete(userWorkloads).where(and(eq(userWorkloads.userId, userId), eq(userWorkloads.term, term)));
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;

// Final production build trigger comment
