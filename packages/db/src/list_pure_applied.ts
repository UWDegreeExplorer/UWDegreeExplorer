import { db } from "./index";
import { subjectBreadth } from "./schema";
import { eq } from "drizzle-orm";

async function listPureApplied() {
  const subjects = await db.select().from(subjectBreadth).where(eq(subjectBreadth.category, "Pure and Applied Sciences"));
  console.log("Subjects in Pure and Applied Sciences:", subjects.map(s => s.subjectCode));
  process.exit(0);
}

listPureApplied().catch(err => {
  console.error(err);
  process.exit(1);
});
