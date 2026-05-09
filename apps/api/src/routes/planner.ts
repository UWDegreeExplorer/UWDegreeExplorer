import { Router } from "express";
import { logger } from "../lib/logger";
import { parseQuestSchedule } from "../utils/scheduleParser";
import { generateICS } from "../utils/icsGenerator";
import { db, userSchedules } from "@workspace/db";
import { courses, courseVersions, courseRequirements, courseOfferings, subjectBreadth, userWorkloads, degreeRequirements, userAuditStates, communicationList } from "@workspace/db/schema";
import { eq, ilike, or, and, sql, not, inArray } from "drizzle-orm";
import * as analyzer from "../utils/workloadAnalyzer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DegreeEngine } from "../services/planner/DegreeEngine";
import multer from "multer";
import pdfParse from "pdf-parse";

const upload = multer({ storage: multer.memoryStorage() });

// Initialize the geographical data for location-based workload analysis
analyzer.initGeoData();

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const formatProgramLabel = (slug: string) =>
  slug
    .replace(/^2025-2026-/, "")
    .replace(/_0$/, "")
    .split("-")
    .map((part) => {
      const upper = part.toUpperCase();
      if (["BCS", "BMATH", "CS", "AI", "HCI"].includes(upper)) return upper;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");

router.get("/degree-rules", async (_req, res) => {
  try {
    const results = await db.select({ slug: degreeRequirements.slug, label: degreeRequirements.label }).from(degreeRequirements).orderBy(degreeRequirements.label);
    return res.json({ programs: results });
  } catch (error) {
    logger.error({ error }, "Failed to list degree rules from DB");
    return res.status(500).json({ error: "Failed to list degree rules" });
  }
});

router.get("/degree-rules/:program", async (req, res) => {
  try {
    const program = req.params.program;
    const [row] = await db.select().from(degreeRequirements).where(eq(degreeRequirements.slug, program)).limit(1);

    if (!row) {
      res.status(404).json({ error: "Program rules not found" });
      return;
    }

    const rules = row.rules as any[];
    const creditUnits = rules
      .filter((rule: any) => !rule.isConstraint)
      .reduce((sum: number, rule: any) => sum + Number(rule.unitsRequired || 0), 0);
    const constraintCount = rules.filter((rule: any) => !!rule.isConstraint).length;

    return res.json({
      program: {
        slug: row.slug,
        label: row.label,
        checklistFile: row.checklistFile,
        creditUnits,
        constraintCount,
      },
      rules,
    });
  } catch (error) {
    logger.error({ error }, "Failed to read degree rules from DB");
    return res.status(500).json({ error: "Failed to read degree rules" });
  }
});

/**
 * POST /planner/audit
 * Evaluates a student transcript against a specific degree program.
 */
router.post("/audit", async (req, res) => {
  const { programSlugs, transcriptText, assignments, options } = req.body;
  
  if (!programSlugs || !Array.isArray(programSlugs) || programSlugs.length === 0 || !transcriptText) {
    return res.status(400).json({ error: "Missing programSlugs or transcriptText" });
  }

  try {
    const rows = await db.select().from(degreeRequirements).where(inArray(degreeRequirements.slug, programSlugs));
    if (rows.length === 0) return res.status(404).json({ error: "No matching programs found" });

    // 1. Process transcript text to get subject/catalog list
    const studentCourses: string[] = [];
    const lines = transcriptText.split('\n');
    for (const line of lines) {
        const match = line.match(/([A-Z]{2,})\s*(\d+[A-Z]*)/);
        if (match) studentCourses.push(`${match[1]} ${match[2]}`);
    }

    // 2. Resolve courses from DB
    const resolvedCourses = await Promise.all(studentCourses.map(async (c) => {
        const [sub, cat] = c.split(' ');
        const [courseRes] = await db.select({
            units: courses.units,
            category: subjectBreadth.category
        }).from(courses)
          .leftJoin(subjectBreadth, eq(courses.subjectCode, subjectBreadth.subjectCode))
          .where(and(eq(courses.subjectCode, sub), eq(courses.catalogNumber, cat)))
          .limit(1);

        const [commRes] = await db.select().from(communicationList).where(eq(communicationList.courseCode, c)).limit(1);

        return {
            courseCode: c,
            subject: sub,
            catalog: cat,
            units: parseFloat(courseRes?.units || "0.5"),
            category: courseRes?.category || undefined,
            isList1: commRes?.listType === 1,
            isList2: commRes?.listType === 2
        };
    }));

    // 3. Run evaluation for each program
    const results = rows.map(row => {
        const engine = new DegreeEngine(row.rules as any[]);
        const report = engine.evaluate(resolvedCourses, assignments || {});
        const constraintsReport = engine.evaluateConstraints(resolvedCourses, options || {});
        return {
            programSlug: row.slug,
            programLabel: row.label,
            report,
            constraintsReport
        };
    });

    return res.json({ results });
  } catch (error) {
    logger.error({ error }, "Multi-degree audit failed");
    return res.status(500).json({ error: "Audit failed" });
  }
});

/**
 * GET /audit/state
 * Retrieves the user's saved audit state
 */
router.get("/audit/state", async (req: any, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  
  try {
    const [state] = await db.select().from(userAuditStates).where(eq(userAuditStates.userId, req.user.id)).limit(1);
    return res.json({ state: state || null });
  } catch (error) {
    logger.error({ error }, "Failed to load audit state");
    return res.status(500).json({ error: "Failed to load audit state" });
  }
});

/**
 * POST /audit/state
 * Saves the user's audit state
 */
router.post("/audit/state", async (req: any, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  
  const { programSlugs, transcriptText, assignments, options } = req.body;
  
  try {
    await db.insert(userAuditStates)
      .values({
        userId: req.user.id,
        programSlugs: programSlugs || [],
        transcriptText: transcriptText || "",
        assignments: assignments || {},
        options: options || {},
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: userAuditStates.userId,
        set: {
          programSlugs: programSlugs || [],
          transcriptText: transcriptText || "",
          assignments: assignments || {},
          options: options || {},
          updatedAt: new Date()
        }
      });
      
    return res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to save audit state");
    return res.status(500).json({ error: "Failed to save audit state" });
  }
});

/**
 * POST /audit/parse-transcript
 * Parses an uploaded PDF transcript and returns the extracted text for the editor.
 */
router.post("/audit/parse-transcript", upload.single("transcript"), async (req: any, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    const data = await pdfParse(req.file.buffer);
    const text = data.text;
    
    // Naive course extraction matching "SUBJECT  CATALOGTitle"
    // e.g. "CS  135Designing..."
    const regex = /([A-Z]{2,10})\s+(\d{3}[A-Z]?)/g;
    let match;
    const coursesFound = [];
    
    while ((match = regex.exec(text)) !== null) {
      const subject = match[1];
      const catalog = match[2];
      coursesFound.push(`${subject} ${catalog} 0.50`);
    }

    // Deduplicate
    const uniqueCourses = Array.from(new Set(coursesFound));
    
    return res.json({ transcriptText: uniqueCourses.join("\n") });
  } catch (error) {
    logger.error({ error }, "Failed to parse transcript PDF");
    return res.status(500).json({ error: "Failed to parse transcript PDF" });
  }
});

/**
 * GET /courses
 * Searches for courses based on query string, subject, and academic level.
 */
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
        // Support searching for concatenated codes (e.g., "CS135") by normalizing whitespace
        sql`(${courses.subjectCode} || ${courses.catalogNumber}) ILIKE ${'%' + normalizedSearch + '%'}`
      ));
    }

    if (subject && subject !== "All" && typeof subject === "string") {
      whereClause.push(eq(courses.subjectCode, subject));
    }

    if (level && level !== "All" && typeof level === "string") {
      if (level === "Other") {
        // Filter for courses that do not match standard 1xx-4xx levels
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
        // Filter by the first digit of the catalog number (e.g., "100" matches "1%")
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

    // Deduplicate results in-memory using courseId as the unique key
    const uniqueResults = Array.from(new Map(results.map(item => [item.courseId, item])).values());

    res.json(uniqueResults);
  } catch (error) {
    console.error("Failed to fetch courses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- CALENDAR & COURSE DETAIL ROUTES ---

/**
 * GET /courses/:id
 * Fetches full details for a single course, including its requirements and offering history.
 * Supports both numeric Kuali IDs and alphanumeric course codes (e.g., CS135).
 */
router.get("/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Retrieve the primary course metadata and its requirement rules
    let courseQuery = db
      .select({
        course: courses,
        version: courseVersions,
        requirements: courseRequirements,
      })
      .from(courses)
      .leftJoin(courseVersions, eq(courses.courseId, courseVersions.courseId))
      .leftJoin(courseRequirements, eq(courses.courseId, courseRequirements.courseId));

    let courseData: any[] = [];

    // Determine if the provided ID is a standard 6-digit numeric Kuali code
    if (/^\d{6}$/.test(id)) {
      courseData = await courseQuery
        .where(eq(courses.courseId, id))
        .orderBy(sql`${courseVersions.versionId} DESC`)
        .limit(1);
    } else {
      // Fallback: Attempt to resolve as an alphanumeric alias (e.g., "CS135" or "CS 135")
      const match = id.match(/^([A-Z]+)\s*([0-9][A-Z0-9]*)$/i);
      if (match) {
        const sub = match[1].toUpperCase();
        const cat = match[2].toUpperCase();
        courseData = await courseQuery
          .where(and(eq(courses.subjectCode, sub), eq(courses.catalogNumber, cat)))
          .orderBy(sql`${courseVersions.versionId} DESC`)
          .limit(1);
      } else {
        courseData = [];
      }
    }

    if (courseData.length === 0) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const { course, version, requirements } = courseData[0];

    // 2. Fetch community ratings from UWFlow asynchronously
    const uwflowRating = await analyzer.fetchUWFlowRatings(
      course.subjectCode || "",
      course.catalogNumber || ""
    );

    // 3. Retrieve the historical term offerings for this course
    const offerings = await db
      .select({
        termCode: courseOfferings.termCode,
      })
      .from(courseOfferings)
      .where(eq(courseOfferings.courseId, id))
      .orderBy(sql`${courseOfferings.termCode} DESC`);

    // Extract unique term codes to build the history timeline
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

/**
 * POST /parse-schedule
 * Parses raw text from Quest (UWaterloo student portal) into a structured schedule object.
 */
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

/**
 * POST /generate-ics
 * Converts a list of course sessions into a downloadable iCalendar (.ics) file.
 */
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

// --- USER DATA PERSISTENCE ROUTES ---

/**
 * GET /schedules
 * Returns a list of saved schedule metadata for the authenticated user.
 */
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

/**
 * POST /schedules
 * Saves or updates a full term schedule for the authenticated user.
 */
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

/**
 * GET /schedules/:term
 * Returns the full JSON payload of a saved schedule for a specific term.
 */
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

/**
 * DELETE /schedules/:term
 * Removes a saved schedule record from the database.
 */
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

// --- ACADEMIC WORKLOAD ANALYZER ROUTES ---

router.post("/workload/analyze", async (req, res) => {
  const { text, courses, term } = req.body;

  // Log the incoming analysis request for monitoring and debugging
  console.log(`[Workload Analyze] Request received. Text length: ${text?.length || 0}, Courses: ${courses?.length || 0}, Term: ${term}`);

  if (!text && (!courses || !term)) {
    return res.status(400).json({ error: "No text or course data provided" });
  }

  try {
    let data;
    if (courses && term) {
      // Standardize input course objects if they originate from the database persistence layer
      const normalizedCourses = courses.map((c: any) => {
        // Ensure the 'days' field is formatted as a single string
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

    // Concurrently fetch difficulty ratings and perform commute stress analysis
    const courseResults = await Promise.all(data.courses.map(async (c: any) => {
      const code = c.courseCode || "Unknown Unknown";
      const [subject, catalog] = code.split(" ");
      const [courseRatings, profRatings] = await Promise.all([
        analyzer.fetchUWFlowRatings(subject || "Unknown", catalog || "Unknown"),
        analyzer.fetchUWFlowProfRatings(c.instructor || "")
      ]);
      return { ...c, time: c.time || "", courseRatings, profRatings };
    }));

    // Group class sessions by day of the week to calculate travel times between buildings
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

      // Robust day parser handling Quest codes (MO, TU), legacy codes (M, T), and special cases (Th)
      let i = 0;
      while (i < daysStr.length) {
        let dKey = "";
        // Match two-letter standard codes first
        const nextTwo = daysStr.substring(i, i + 2);
        if (["MO", "TU", "WE", "TH", "FR"].includes(nextTwo)) {
          dKey = nextTwo;
          i += 2;
        }
        // Handle Quest-specific 'Th' for Thursday
        else if (daysStr[i] === "T" && daysStr[i + 1] === "h") {
          dKey = "TH";
          i += 2;
        } else {
          // Fallback to single-letter mapping
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

    // Calculate walking time and stress level for back-to-back classes
    Object.keys(dayStruct).forEach((day) => {
      const dailyCourses = dayStruct[day].sort((a: any, b: any) => a.start - b.start);
      for (let i = 0; i < dailyCourses.length - 1; i++) {
        const curr = dailyCourses[i];
        const nxt = dailyCourses[i + 1];
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

// --- BREADTH CONSTELLATION GRAPH ROUTES ---

/**
 * GET /breadth/graph
 * Returns nodes and edges for visualizing breadth requirement course chains.
 */
router.get("/breadth/graph", async (req, res) => {
  try {
    const { category } = req.query;

    console.log(`[Graph API] Fetching data for category: ${category || 'All'}`);

    // 1. Fetch all subjects and their breadth categories
    const brSubjects = await db.select().from(subjectBreadth);
    const subjectToCategory = new Map(brSubjects.map(s => [s.subjectCode, s.category]));
    const brSubjectCodes = brSubjects.map(s => s.subjectCode).filter(Boolean) as string[];

    console.log(`[Graph API] Found ${brSubjectCodes.length} BR subjects.`);

    if (brSubjectCodes.length === 0) {
      return res.json({ nodes: [], links: [] });
    }

    // 2. Fetch all courses in these subjects along with their requirements
    // Simplified query to avoid subquery issues during debug
    const rawCourses = await db
      .select({
        courseId: courses.courseId,
        subjectCode: courses.subjectCode,
        catalogNumber: courses.catalogNumber,
        title: courseVersions.title,
        prereqIds: courseRequirements.prereqIds,
      })
      .from(courses)
      .innerJoin(courseVersions, eq(courses.courseId, courseVersions.courseId))
      .leftJoin(courseRequirements, eq(courses.courseId, courseRequirements.courseId))
      .where(inArray(courses.subjectCode, brSubjectCodes));

    console.log(`[Graph API] Fetched ${rawCourses.length} raw course records.`);

    // 3. Build Nodes and Edges
    const nodesMap = new Map();
    const links: any[] = [];

    // First pass: Deduplicate and store courses
    const tempNodes = new Map();
    rawCourses.forEach(course => {
      const existing = tempNodes.get(course.courseId);
      if (!existing || (course.prereqIds?.length || 0) > (existing.prereqIds?.length || 0)) {
        tempNodes.set(course.courseId, course);
      }
    });

    // Map of subjectCode -> Array of categories
    const subjectToCategories = new Map();
    brSubjects.forEach(s => {
      const existing = subjectToCategories.get(s.subjectCode) || [];
      existing.push(s.category);
      subjectToCategories.set(s.subjectCode, existing);
    });

    // Second pass: Identify connections
    const connectedNodeIds = new Set();
    tempNodes.forEach(course => {
      if (course.prereqIds) {
        const prereqs = course.prereqIds.split(",").map((id: string) => id.trim());
        prereqs.forEach((pId: string) => {
          if (tempNodes.has(pId)) {
            links.push({ source: pId, target: course.courseId });
            connectedNodeIds.add(pId);
            connectedNodeIds.add(course.courseId);
          }
        });
      }
    });

    // Third pass: Collect nodes to return
    const nodesToReturn: any[] = [];
    const maxNodes = 1000;

    tempNodes.forEach((course, id) => {
      const cats = subjectToCategories.get(course.subjectCode || []) || [];
      
      // If filtering by category, check if this subject is in that category
      if (category && !cats.includes(category)) return;
      
      const isConnected = connectedNodeIds.has(id);
      
      // If we are over the limit, prioritize connected nodes
      if (!category && nodesToReturn.length >= maxNodes && !isConnected) return;

      nodesToReturn.push({
        id: id,
        code: `${course.subjectCode} ${course.catalogNumber}`,
        title: course.title,
        category: cats[0] || "Other", // For color, just pick first one or default
      });
      nodesMap.set(id, true);
    });

    // Final pass: Filter links to only those where both nodes are in nodesToReturn
    const finalLinks = links.filter(l => nodesMap.has(l.source) && nodesMap.has(l.target));

    console.log(`[Graph API] Returning ${nodesToReturn.length} nodes and ${finalLinks.length} links.`);
    return res.json({ nodes: nodesToReturn, links: finalLinks });
  } catch (error) {
    console.error("[Graph API Error]", error);
    return res.status(500).json({ error: "Failed to build course graph" });
  }
});

/**
 * GET /breadth/categories
 * Returns unique breadth categories stored in the database.
 */
router.get("/breadth/categories", async (req, res) => {
  try {
    const categories = await db
      .selectDistinct({ category: subjectBreadth.category })
      .from(subjectBreadth);
    
    const list = categories.map(c => c.category).filter(Boolean);
    return res.json(list);
  } catch (error) {
    console.error("[Categories API Error]", error);
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default router;

// Trigger comment for continuous deployment validation
