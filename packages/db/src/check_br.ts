import { db } from "./index";
import { subjectBreadth, courses } from "./schema/planner";
import { inArray } from "drizzle-orm";

async function check() {
  const br = await db.select().from(subjectBreadth);
  console.log("BR Subjects Count:", br.length);
  
  if (br.length > 0) {
    const codes = br.map(s => s.subjectCode);
    const count = await db.select().from(courses).where(inArray(courses.subjectCode, codes));
    console.log("Courses in BR Subjects:", count.length);
  }
  process.exit(0);
}

check();
