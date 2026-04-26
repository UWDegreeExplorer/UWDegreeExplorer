import { db } from "../packages/db/src/index.ts";
import { courseVersions } from "../packages/db/src/schema/planner.ts";
import { sql } from "drizzle-orm";

async function check() {
  const count = await db.select({ count: sql`count(*)` }).from(courseVersions);
  console.log("Version Count:", count);
  process.exit(0);
}

check();
