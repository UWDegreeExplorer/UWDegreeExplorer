import { db } from "../packages/db/src/index.ts";
import { courses } from "../packages/db/src/schema/planner.ts";
import { sql } from "drizzle-orm";

async function check() {
  const count = await db.select({ count: sql`count(*)` }).from(courses);
  console.log("Course Count:", count);
  process.exit(0);
}

check();
